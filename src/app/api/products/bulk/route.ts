import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse, errorResponse } from "@/lib/utils/api";
import { createProduct } from "@/lib/actions/product.actions";
import { hasPermission } from "@/lib/utils/role";
import { auth } from "@/lib/auth";

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

    const results: { success: boolean; name: string; error?: string; code?: string }[] = [];

    for (const product of products) {
      // Validate required fields
      if (!product.name || !product.categoryId || !product.units || product.units.length === 0) {
        results.push({
          success: false,
          name: product.name || "Produk tanpa nama",
          error: "Nama, kategori, dan minimal 1 satuan wajib diisi",
        });
        continue;
      }

      const primaryUnits = product.units.filter((u) => u.isPrimary);
      if (primaryUnits.length !== 1) {
        results.push({
          success: false,
          name: product.name,
          error: "Harus ada tepat 1 satuan utama",
        });
        continue;
      }

      try {
        const result = await createProduct({
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
        });

        if (result.success) {
          results.push({ success: true, name: product.name, code: result.data?.code });
        } else {
          results.push({ success: false, name: product.name, error: result.error });
        }
      } catch (err: any) {
        results.push({ success: false, name: product.name, error: err.message || "Gagal menyimpan" });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `${successCount} produk berhasil disimpan, ${failCount} gagal`,
      results,
      summary: { total: products.length, success: successCount, failed: failCount },
    });
  } catch (error: any) {
    console.error("[BULK_PRODUCT_ERROR]", error);
    return errorResponse(error.message || "Terjadi kesalahan server", 500);
  }
}
