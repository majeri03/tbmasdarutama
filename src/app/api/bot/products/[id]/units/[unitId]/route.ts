import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireBotWrite,
  botOk,
  botErr,
  sanitizeBotError,
  toNum,
  writeBotAudit,
} from "@/lib/bot-auth";

type RouteContext = {
  params: Promise<{ id: string; unitId: string }>;
};

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
  sellPrice: import("@prisma/client").Prisma.Decimal;
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

// Cari baris relasi ProductUnit lewat unique [productId, unitId].
// Param [unitId] di URL adalah ID SATUAN (Unit), bukan ID ProductUnit.
async function findProductUnit(productId: string, unitId: string) {
  return prisma.productUnit.findUnique({
    where: { productId_unitId: { productId, unitId } },
    include: {
      unit: { select: { id: true, name: true, symbol: true } },
      product: { select: { id: true, name: true, code: true, deletedAt: true } },
    },
  });
}

/**
 * PUT /api/bot/products/[id]/units/[unitId] — Level 1 saja.
 * Ubah sellPrice / buyPrice / conversionValue / isPrimary satu satuan.
 * buyPrice boleh dikirim tapi TIDAK PERNAH dikembalikan di respons.
 * Aturan mengikuti skema web: sellPrice >= buyPrice, satuan utama
 * conversionValue harus 1, produk harus punya tepat 1 satuan utama.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireBotWrite(request, [1]);
    if (!auth.ok) return botAuthFail(auth.status);

    const { id: productId, unitId } = await context.params;
    const existing = await findProductUnit(productId, unitId);
    if (!existing || !existing.product || existing.product.deletedAt)
      return botErr("Satuan produk tidak ditemukan.", 404);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return botErr("Format data (JSON) tidak valid.", 400);
    }

    const data: {
      sellPrice?: number;
      buyPrice?: number;
      conversionValue?: number;
      isPrimary?: boolean;
    } = {};
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    const currentSell = toNum(existing.sellPrice);
    const currentBuy = toNum(existing.buyPrice);

    if (body.sellPrice !== undefined) {
      const sellPrice = asNumber(body.sellPrice);
      if (sellPrice === null || sellPrice <= 0)
        return botErr("Harga jual harus angka positif.", 400);
      if (sellPrice !== currentSell) {
        data.sellPrice = sellPrice;
        before.sellPrice = currentSell;
        after.sellPrice = sellPrice;
      }
    }
    if (body.buyPrice !== undefined) {
      const buyPrice = asNumber(body.buyPrice);
      if (buyPrice === null || buyPrice <= 0)
        return botErr("Harga beli harus angka positif.", 400);
      if (buyPrice !== currentBuy) {
        data.buyPrice = buyPrice;
        before.buyPrice = currentBuy;
        after.buyPrice = buyPrice;
      }
    }
    if (body.conversionValue !== undefined) {
      const conversionValue = asNumber(body.conversionValue);
      if (
        conversionValue === null ||
        !Number.isInteger(conversionValue) ||
        conversionValue < 1
      )
        return botErr(
          "Nilai konversi harus bilangan bulat 1 atau lebih.",
          400
        );
      if (conversionValue !== existing.conversionValue) {
        data.conversionValue = conversionValue;
        before.conversionValue = existing.conversionValue;
        after.conversionValue = conversionValue;
      }
    }
    if (body.isPrimary !== undefined) {
      if (typeof body.isPrimary !== "boolean")
        return botErr("Penanda satuan utama harus true atau false.", 400);
      if (body.isPrimary !== existing.isPrimary) {
        data.isPrimary = body.isPrimary;
        before.isPrimary = existing.isPrimary;
        after.isPrimary = body.isPrimary;
      }
    }

    if (Object.keys(data).length === 0)
      return botErr("Tidak ada data yang diubah.", 400);

    // Nilai efektif sesudah update — untuk validasi aturan harga & primary.
    const effSell = data.sellPrice ?? currentSell;
    const effBuy = data.buyPrice ?? currentBuy;
    const effConversion = data.conversionValue ?? existing.conversionValue;
    const effPrimary = data.isPrimary ?? existing.isPrimary;

    // toNum() mengembalikan number | null; di skema, sellPrice/buyPrice
    // satuan yang sudah ada tidak pernah null — guard ini hanya untuk
    // memuaskan strict null check tsc, tanpa mengubah perilaku validasi.
    if (effSell !== null && effBuy !== null && effSell < effBuy)
      return botErr(
        "Harga jual harus lebih besar atau sama dengan harga beli.",
        400
      );
    if (effPrimary && effConversion !== 1)
      return botErr("Satuan utama harus memiliki nilai konversi 1.", 400);

    // Melepas status primary dari satu-satunya satuan utama ditolak —
    // produk harus punya tepat 1 satuan utama (aturan skema web).
    if (data.isPrimary === false && existing.isPrimary) {
      const primaryCount = await prisma.productUnit.count({
        where: { productId, isPrimary: true },
      });
      if (primaryCount <= 1)
        return botErr(
          "Produk harus memiliki satu satuan utama. Jadikan satuan lain sebagai utama dulu.",
          400
        );
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (data.isPrimary === true) {
        await tx.productUnit.updateMany({
          where: { productId, unitId: { not: unitId } },
          data: { isPrimary: false },
        });
      }
      return tx.productUnit.update({
        where: { productId_unitId: { productId, unitId } },
        data,
        include: {
          unit: { select: { id: true, name: true, symbol: true } },
        },
      });
    });

    await auditSafe({
      level: auth.level,
      sender: auth.sender,
      method: "PUT",
      endpoint: `/api/bot/products/${productId}/units/${unitId}`,
      entityType: "ProductUnit",
      entityId: existing.id,
      before,
      after,
      success: true,
    });

    return botOk(serializeProductUnit(updated));
  } catch (error) {
    console.error("[API_BOT_PRODUCT_UNIT_PUT_ERROR]", error);
    return sanitizeBotError(error);
  }
}

/**
 * DELETE /api/bot/products/[id]/units/[unitId] — Level 1 saja.
 * Hapus baris relasi satuan (bukan data bisnis).
 * Ditolak bila satuan itu isPrimary, atau sudah pernah dipakai di SaleItem.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireBotWrite(request, [1]);
    if (!auth.ok) return botAuthFail(auth.status);

    const { id: productId, unitId } = await context.params;
    const existing = await findProductUnit(productId, unitId);
    if (!existing || !existing.product || existing.product.deletedAt)
      return botErr("Satuan produk tidak ditemukan.", 404);

    if (existing.isPrimary)
      return botErr(
        "Satuan utama tidak bisa dihapus. Jadikan satuan lain sebagai utama dulu.",
        400
      );

    const usedInSales = await prisma.saleItem.count({
      where: { productId, unitId },
    });
    if (usedInSales > 0)
      return botErr(
        `Satuan "${existing.unit.name}" sudah pernah dipakai di ${usedInSales} penjualan, jadi tidak bisa dihapus.`,
        400
      );

    await prisma.productUnit.delete({
      where: { productId_unitId: { productId, unitId } },
    });

    await auditSafe({
      level: auth.level,
      sender: auth.sender,
      method: "DELETE",
      endpoint: `/api/bot/products/${productId}/units/${unitId}`,
      entityType: "ProductUnit",
      entityId: existing.id,
      before: {
        productCode: existing.product.code,
        unit: existing.unit.name,
        conversionValue: existing.conversionValue,
        sellPrice: toNum(existing.sellPrice),
        isPrimary: false,
      },
      after: { deleted: true },
      success: true,
    });

    return botOk({
      productId,
      unitId,
      unitName: existing.unit.name,
      deleted: true,
    });
  } catch (error) {
    console.error("[API_BOT_PRODUCT_UNIT_DELETE_ERROR]", error);
    return sanitizeBotError(error);
  }
}
