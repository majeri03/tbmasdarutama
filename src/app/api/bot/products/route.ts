import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  requireBotRead,
  requireBotWrite,
  botOk,
  botErr,
  sanitizeBotError,
  parseBotPagination,
  toNum,
  writeBotAudit,
  getBotActorUserId,
} from "@/lib/bot-auth";

// Pesan auth gagal — sama dengan yang dipakai WS-B (GET):
// 401 "Kunci bot tidak valid.", 429 "Terlalu banyak permintaan...".
// 403 (tulis oleh Level 2/3): pesan sopan sesuai keputusan desain.
function botAuthFail(status: 401 | 403 | 429) {
  if (status === 403)
    return botErr(
      "Maaf, akun ini hanya bisa melihat, tidak bisa mengubah data.",
      403
    );
  if (status === 429)
    return botErr("Terlalu banyak permintaan. Coba lagi sebentar lagi.", 429);
  return botErr("Kunci bot tidak valid.", 401);
}

// Audit log tidak boleh menggagalkan request yang sudah berhasil ditulis:
// kalau pencatatan audit gagal, catat di log server dan tetap kembalikan sukses.
async function auditSafe(
  entry: Parameters<typeof writeBotAudit>[0]
): Promise<void> {
  try {
    await writeBotAudit(entry);
  } catch (error) {
    console.error("[API_BOT_AUDIT_ERROR]", error);
  }
}

// Angka dari body JSON: terima number, atau string numerik ("10000").
function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// Serializer: buyPrice TIDAK PERNAH dikembalikan di respons mana pun.
function serializeProductUnit(pu: {
  id: string;
  productId: string;
  unitId: string;
  conversionValue: number;
  sellPrice: Prisma.Decimal;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
  unit: { id: string; name: string; symbol: string | null };
}) {
  return {
    id: pu.id,
    productId: pu.productId,
    unitId: pu.unitId,
    unit: { id: pu.unit.id, name: pu.unit.name, symbol: pu.unit.symbol },
    conversionValue: pu.conversionValue,
    sellPrice: toNum(pu.sellPrice),
    isPrimary: pu.isPrimary,
    createdAt: pu.createdAt,
    updatedAt: pu.updatedAt,
  };
}

function serializeProduct(p: {
  id: string;
  code: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: string;
  subCategoryId: string | null;
  supplierId: string | null;
  minStock: number;
  currentStock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string };
  productUnits: Array<{
    id: string;
    productId: string;
    unitId: string;
    conversionValue: number;
    sellPrice: Prisma.Decimal;
    isPrimary: boolean;
    createdAt: Date;
    updatedAt: Date;
    unit: { id: string; name: string; symbol: string | null };
  }>;
}) {
  return {
    id: p.id,
    code: p.code,
    barcode: p.barcode,
    name: p.name,
    description: p.description,
    categoryId: p.categoryId,
    category: { id: p.category.id, name: p.category.name },
    subCategoryId: p.subCategoryId,
    supplierId: p.supplierId,
    minStock: p.minStock,
    currentStock: p.currentStock,
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    units: p.productUnits.map(serializeProductUnit),
  };
}

// Pola yang sama dengan generateProductCode di
// src/lib/actions/product.actions.ts: pindai semua kode PRD-, ambil angka
// terbesar, +1, format PRD-xxxxx (5 digit).
async function generateProductCode(
  tx: Prisma.TransactionClient
): Promise<string> {
  const prdProducts = await tx.product.findMany({
    where: { code: { startsWith: "PRD-" } },
    select: { code: true },
  });
  let maxNumber = 0;
  for (const p of prdProducts) {
    const parts = p.code.split("-");
    if (parts.length === 2) {
      const num = parseInt(parts[1], 10);
      if (!isNaN(num) && num > maxNumber) maxNumber = num;
    }
  }
  return `PRD-${(maxNumber + 1).toString().padStart(5, "0")}`;
}

/**
 * GET /api/bot/products
 * Daftar produk (semua level boleh baca). Search nama/kode/barcode,
 * page/limit. Units disertakan dengan sellPrice SAJA — tanpa buyPrice.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireBotRead(request);
    if (!auth.ok) return botAuthFail(auth.status);

    const { searchParams } = new URL(request.url);
    const { page, limit } = parseBotPagination(searchParams);
    const search = searchParams.get("search")?.trim() || "";
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      AND: [
        // Produk yang di-soft-delete dari web (deletedAt terisi) disembunyikan,
        // sama seperti getProducts di product.actions.ts.
        { deletedAt: null },
        search
          ? {
              OR: [
                { code: { contains: search, mode: "insensitive" } },
                { barcode: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          category: { select: { id: true, name: true } },
          productUnits: {
            include: {
              unit: { select: { id: true, name: true, symbol: true } },
            },
            orderBy: { isPrimary: "desc" },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return botOk(
      products.map(serializeProduct),
      { page, limit, total, totalPages: Math.ceil(total / limit) }
    );
  } catch (error) {
    console.error("[API_BOT_PRODUCTS_GET_ERROR]", error);
    return sanitizeBotError(error);
  }
}

/**
 * POST /api/bot/products — Level 1 saja.
 * Buat produk baru + satuan utamanya. Kode produk dibuat server (PRD-xxxxx).
 * categoryId WAJIB (skema Product.categoryId tidak nullable — dicek dulu).
 * buyPrice BOLEH dikirim di body (wajib, karena skema tidak punya default),
 * tapi TIDAK PERNAH dikembalikan di respons.
 * Aturan harga mengikuti skema web (createProductSchema): harga positif dan
 * sellPrice >= buyPrice; satuan utama conversionValue harus 1.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireBotWrite(request, [1]);
    if (!auth.ok) return botAuthFail(auth.status);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return botErr("Format data (JSON) tidak valid.", 400);
    }

    // --- Validasi input ---
    const name =
      typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return botErr("Nama produk wajib diisi.", 400);
    if (name.length > 100)
      return botErr("Nama produk maksimal 100 karakter.", 400);

    const categoryId =
      typeof body.categoryId === "string" ? body.categoryId.trim() : "";
    if (!categoryId) return botErr("Kategori wajib dipilih.", 400);

    const subCategoryId =
      typeof body.subCategoryId === "string" &&
      body.subCategoryId.trim() !== ""
        ? body.subCategoryId.trim()
        : null;
    const supplierId =
      typeof body.supplierId === "string" && body.supplierId.trim() !== ""
        ? body.supplierId.trim()
        : null;
    const description =
      typeof body.description === "string" && body.description.trim() !== ""
        ? body.description.trim()
        : null;
    const barcode =
      typeof body.barcode === "string" && body.barcode.trim() !== ""
        ? body.barcode.trim()
        : null;

    const unitId =
      typeof body.unitId === "string" ? body.unitId.trim() : "";
    if (!unitId) return botErr("Satuan utama wajib dipilih.", 400);

    const sellPrice = asNumber(body.sellPrice);
    if (sellPrice === null || sellPrice <= 0)
      return botErr("Harga jual harus angka positif.", 400);
    const buyPrice = asNumber(body.buyPrice);
    if (buyPrice === null || buyPrice <= 0)
      return botErr("Harga beli harus angka positif.", 400);
    if (sellPrice < buyPrice)
      return botErr(
        "Harga jual harus lebih besar atau sama dengan harga beli.",
        400
      );

    const minStock =
      body.minStock === undefined ? 0 : asNumber(body.minStock);
    if (minStock === null || !Number.isInteger(minStock) || minStock < 0)
      return botErr("Stok minimum harus bilangan bulat 0 atau lebih.", 400);

    const currentStock =
      body.currentStock === undefined ? 0 : asNumber(body.currentStock);
    if (
      currentStock === null ||
      !Number.isInteger(currentStock) ||
      currentStock < 0
    )
      return botErr("Stok awal harus bilangan bulat 0 atau lebih.", 400);

    // --- Validasi relasi (pola yang sama dengan createProduct di web) ---
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) return botErr("Kategori tidak ditemukan.", 400);

    if (subCategoryId) {
      const subCategory = await prisma.subCategory.findUnique({
        where: { id: subCategoryId },
      });
      if (!subCategory)
        return botErr("Sub-kategori tidak ditemukan.", 400);
      if (subCategory.categoryId !== categoryId)
        return botErr(
          "Sub-kategori tidak termasuk dalam kategori yang dipilih.",
          400
        );
    }

    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
      });
      if (!supplier) return botErr("Supplier tidak ditemukan.", 400);
    }

    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) return botErr("Satuan tidak ditemukan.", 400);

    if (barcode) {
      const existingBarcode = await prisma.product.findUnique({
        where: { barcode },
      });
      if (existingBarcode)
        return botErr(
          `Produk dengan barcode "${barcode}" sudah ada.`,
          400
        );
    }

    // StockMovement butuh createdById (User) — kalau aktor bot tidak ada,
    // gagal generik (jangan buat produk tanpa jejak stok awal).
    const actorId = await getBotActorUserId();
    if (!actorId) return botErr("Terjadi kesalahan internal server.", 500);

    // --- Tulis dalam satu transaksi ---
    let created;
    try {
      created = await prisma.$transaction(async (tx) => {
        const code = await generateProductCode(tx);

        const product = await tx.product.create({
          data: {
            code,
            barcode,
            name,
            description,
            categoryId,
            subCategoryId,
            supplierId,
            minStock,
            currentStock,
            isActive: true,
          },
        });

        await tx.productUnit.create({
          data: {
            productId: product.id,
            unitId,
            conversionValue: 1,
            buyPrice,
            sellPrice,
            isPrimary: true,
          },
        });

        // Jejak stok awal (pola createProductRecords di web: movement awal
        // selalu dicatat). Stok awal > 0 dicatat sebagai IN sebesar stok
        // awal; stok 0 dicatat sebagai ADJUSTMENT 0 seperti di web.
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            type: currentStock > 0 ? "IN" : "ADJUSTMENT",
            quantity: currentStock,
            referenceType: "Initial Stock",
            notes: "Stok awal produk (via bot)",
            createdById: actorId,
          },
        });

        return product;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const targets = (error.meta?.target as string[]) || [];
        if (targets.includes("barcode"))
          return botErr("Barcode sudah digunakan produk lain.", 400);
        if (targets.includes("code"))
          return botErr("Kode produk sudah digunakan, coba lagi.", 400);
        return botErr("Data sudah digunakan produk lain.", 400);
      }
      throw error;
    }

    const full = await prisma.product.findUnique({
      where: { id: created.id },
      include: {
        category: { select: { id: true, name: true } },
        productUnits: {
          include: {
            unit: { select: { id: true, name: true, symbol: true } },
          },
          orderBy: { isPrimary: "desc" },
        },
      },
    });
    if (!full) return botErr("Terjadi kesalahan internal server.", 500);

    await auditSafe({
      level: auth.level,
      sender: auth.sender,
      method: "POST",
      endpoint: "/api/bot/products",
      entityType: "Product",
      entityId: created.id,
      before: {},
      after: {
        code: created.code,
        name,
        sellPrice,
        currentStock,
      },
      success: true,
    });

    return botOk(serializeProduct(full));
  } catch (error) {
    console.error("[API_BOT_PRODUCTS_POST_ERROR]", error);
    return sanitizeBotError(error);
  }
}
