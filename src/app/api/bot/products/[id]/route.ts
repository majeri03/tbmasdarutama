import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  requireBotRead,
  requireBotWrite,
  botOk,
  botErr,
  sanitizeBotError,
  toNum,
  writeBotAudit,
} from "@/lib/bot-auth";

type RouteContext = { params: Promise<{ id: string }> };

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

async function auditSafe(
  entry: Parameters<typeof writeBotAudit>[0]
): Promise<void> {
  try {
    await writeBotAudit(entry);
  } catch (error) {
    console.error("[API_BOT_AUDIT_ERROR]", error);
  }
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

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
  subCategory: { id: string; name: string } | null;
  supplier: { id: string; code: string; name: string } | null;
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
    subCategory: p.subCategory
      ? { id: p.subCategory.id, name: p.subCategory.name }
      : null,
    supplierId: p.supplierId,
    supplier: p.supplier
      ? { id: p.supplier.id, code: p.supplier.code, name: p.supplier.name }
      : null,
    minStock: p.minStock,
    currentStock: p.currentStock,
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    units: p.productUnits.map(serializeProductUnit),
  };
}

// Produk yang sudah di-soft-delete dari web (deletedAt terisi) dianggap
// tidak ada — sama seperti getProductById di product.actions.ts.
async function findBotProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      subCategory: { select: { id: true, name: true } },
      supplier: { select: { id: true, code: true, name: true } },
      productUnits: {
        include: {
          unit: { select: { id: true, name: true, symbol: true } },
        },
        orderBy: { isPrimary: "desc" },
      },
    },
  });
  if (!product || product.deletedAt) return null;
  return product;
}

/**
 * GET /api/bot/products/[id]
 * Detail produk + semua units (sellPrice saja, tanpa buyPrice).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireBotRead(request);
    if (!auth.ok) return botAuthFail(auth.status);

    const { id } = await context.params;
    const product = await findBotProduct(id);
    if (!product) return botErr("Produk tidak ditemukan.", 404);

    return botOk(serializeProduct(product));
  } catch (error) {
    console.error("[API_BOT_PRODUCT_ID_GET_ERROR]", error);
    return sanitizeBotError(error);
  }
}

/**
 * PUT /api/bot/products/[id] — Level 1 saja.
 * Ubah nama, minStock, isActive. HARGA JUAL tidak diubah di sini —
 * ubah lewat PUT /api/bot/products/[id]/units/[unitId].
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireBotWrite(request, [1]);
    if (!auth.ok) return botAuthFail(auth.status);

    const { id } = await context.params;
    const product = await findBotProduct(id);
    if (!product) return botErr("Produk tidak ditemukan.", 404);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return botErr("Format data (JSON) tidak valid.", 400);
    }

    const data: { name?: string; minStock?: number; isActive?: boolean } =
      {};
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return botErr("Nama produk tidak boleh kosong.", 400);
      if (name.length > 100)
        return botErr("Nama produk maksimal 100 karakter.", 400);
      if (name !== product.name) {
        data.name = name;
        before.name = product.name;
        after.name = name;
      }
    }

    if (body.minStock !== undefined) {
      const minStock = asNumber(body.minStock);
      if (minStock === null || !Number.isInteger(minStock) || minStock < 0)
        return botErr(
          "Stok minimum harus bilangan bulat 0 atau lebih.",
          400
        );
      if (minStock !== product.minStock) {
        data.minStock = minStock;
        before.minStock = product.minStock;
        after.minStock = minStock;
      }
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean")
        return botErr("Status aktif harus true atau false.", 400);
      if (body.isActive !== product.isActive) {
        data.isActive = body.isActive;
        before.isActive = product.isActive;
        after.isActive = body.isActive;
      }
    }

    if (Object.keys(data).length === 0)
      return botErr("Tidak ada data yang diubah.", 400);

    const updated = await prisma.product.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
        supplier: { select: { id: true, code: true, name: true } },
        productUnits: {
          include: {
            unit: { select: { id: true, name: true, symbol: true } },
          },
          orderBy: { isPrimary: "desc" },
        },
      },
    });

    await auditSafe({
      level: auth.level,
      sender: auth.sender,
      method: "PUT",
      endpoint: `/api/bot/products/${id}`,
      entityType: "Product",
      entityId: id,
      before,
      after,
      success: true,
    });

    return botOk(serializeProduct(updated));
  } catch (error) {
    console.error("[API_BOT_PRODUCT_ID_PUT_ERROR]", error);
    return sanitizeBotError(error);
  }
}

/**
 * DELETE /api/bot/products/[id] — Level 1 saja.
 * Soft-delete: isActive=false (produk bisa diaktifkan lagi lewat PUT).
 * Tidak menghapus baris dan tidak menyentuh riwayat penjualan/pembelian.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireBotWrite(request, [1]);
    if (!auth.ok) return botAuthFail(auth.status);

    const { id } = await context.params;
    const product = await findBotProduct(id);
    if (!product) return botErr("Produk tidak ditemukan.", 404);

    if (!product.isActive)
      return botErr(`Produk "${product.name}" sudah nonaktif.`, 400);

    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    await auditSafe({
      level: auth.level,
      sender: auth.sender,
      method: "DELETE",
      endpoint: `/api/bot/products/${id}`,
      entityType: "Product",
      entityId: id,
      before: { name: product.name, code: product.code, isActive: true },
      after: { isActive: false },
      success: true,
    });

    return botOk({
      id: product.id,
      code: product.code,
      name: product.name,
      isActive: false,
    });
  } catch (error) {
    console.error("[API_BOT_PRODUCT_ID_DELETE_ERROR]", error);
    return sanitizeBotError(error);
  }
}
