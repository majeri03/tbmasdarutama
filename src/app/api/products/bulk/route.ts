import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse, errorResponse } from "@/lib/utils/api";
import { createProduct } from "@/lib/actions/product.actions";
import { hasPermission } from "@/lib/utils/role";
import prisma from "@/lib/prisma";
import { confirmR2Files } from "@/lib/utils/r2-tracking";
import { revalidatePath } from "next/cache";

interface BulkProductItem {
  name: string;
  barcode?: string | null;
  description?: string | null;
  categoryId: string;
  subCategoryId?: string | null;
  supplierId?: string | null;
  minStock?: number;
  isActive?: boolean;
  units: Array<{
    unitId: string;
    conversionValue: number;
    buyPrice: number;
    sellPrice: number;
    isPrimary: boolean;
  }>;
  images?: Array<{
    imageUrl: string;
    isPrimary: boolean;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "CREATE_PRODUCT")) {
      return errorResponse("Anda tidak memiliki izin untuk menambah produk", 403);
    }

    const body = await request.json();
    const { products } = body as { products: BulkProductItem[] };

    if (!products || !Array.isArray(products) || products.length === 0) {
      return errorResponse("Data produk tidak boleh kosong", 400);
    }

    if (products.length > 100) {
      return errorResponse("Maksimal 100 produk sekaligus", 400);
    }

    // PENTEST FIX (22 Nov 2026, M26): bulk ATOMIK — semua produk disimpan
    // dalam satu transaksi. Satu produk gagal -> SEMUA batal, tidak ada
    // hasil parsial yang sulit di-reconcile (sebelumnya loop tanpa
    // transaksi: sebagian sukses, sebagian gagal). Pesan gagal memakai
    // prefix BULK_FAIL: supaya catch di bawah bisa membedakan kegagalan
    // bisnis (pesan aman, tampil ke user) dari error tak terduga (pesan
    // generik, detail hanya di log server).
    const created = await prisma.$transaction(async (tx) => {
      const out: Array<{ name: string; code?: string; id: string; images: Array<{ imageUrl: string }> }> = [];
      for (const product of products) {
        // Validate required fields
        if (!product.name || !product.categoryId || !product.units || product.units.length === 0) {
          throw new Error(
            `BULK_FAIL:"${product.name || "Produk tanpa nama"}": Nama, kategori, dan minimal 1 satuan wajib diisi`
          );
        }

        const primaryUnits = product.units.filter((u) => u.isPrimary);
        if (primaryUnits.length !== 1) {
          throw new Error(`BULK_FAIL:"${product.name}": Harus ada tepat 1 satuan utama`);
        }

        const result = await createProduct(
          {
            name: product.name,
            barcode: product.barcode || null,
            description: product.description || null,
            categoryId: product.categoryId,
            subCategoryId: product.subCategoryId || null,
            supplierId: product.supplierId || null,
            minStock: product.minStock || 0,
            isActive: product.isActive ?? true,
            units: product.units,
            images: product.images || [],
          },
          { tx, skipSideEffects: true }
        );

        // createProduct mengembalikan union (sukses: data, gagal: error)
        // — akses via cast supaya tsc tidak protes.
        const createdProduct = (result as { data?: { id: string; code: string } }).data;
        if (!result.success || !createdProduct) {
          const reason = (result as { error?: string }).error || "Gagal menyimpan";
          throw new Error(`BULK_FAIL:"${product.name}": ${reason}`);
        }
        out.push({
          name: product.name,
          code: createdProduct.code,
          id: createdProduct.id,
          images: product.images || [],
        });
      }
      return out;
    });

    // Transaksi sudah commit: konfirmasi gambar R2 + revalidate sekali.
    for (const item of created) {
      if (item.images.length > 0) {
        await confirmR2Files(
          item.images.map((i) => i.imageUrl),
          "PRODUCT",
          item.id
        );
      }
    }
    revalidatePath("/dashboard/products");

    const results = created.map((c) => ({ success: true, name: c.name, code: c.code }));

    return NextResponse.json({
      success: true,
      message: `${results.length} produk berhasil disimpan`,
      results,
      summary: { total: products.length, success: results.length, failed: 0 },
    });
  } catch (err) {
    const error = err as Error;
    console.error("[BULK_PRODUCT_ERROR]", error);
    // Kegagalan bisnis (validasi / duplikat / FK): pesannya aman.
    if (error.message?.startsWith("BULK_FAIL:")) {
      const detail = error.message.slice("BULK_FAIL:".length);
      return NextResponse.json(
        {
          success: false,
          error: `Gagal menyimpan produk massal — tidak ada produk yang tersimpan. ${detail}`,
          results: [],
          summary: { total: 0, success: 0, failed: 0 },
        },
        { status: 400 }
      );
    }
    // PENTEST FIX (L24): pesan error mentah (Prisma) jangan dikembalikan
    // ke klien — hanya pesan generik, detail di log server.
    return errorResponse("Terjadi kesalahan server saat menyimpan produk massal", 500);
  }
}
