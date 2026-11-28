import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
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

/**
 * POST /api/bot/products/[id]/units — Level 1 saja.
 * Tambah satuan ke produk. buyPrice boleh dikirim tapi TIDAK PERNAH
 * dikembalikan di respons.
 * Aturan mengikuti skema web (product.schema.ts): harga positif,
 * sellPrice >= buyPrice, satuan utama conversionValue harus 1.
 * Bila isPrimary=true, semua satuan lain produk ini dijadikan non-primary
 * dulu (di dalam transaksi yang sama).
 * Satuan yang sama untuk produk yang sama ditolak sopan (unique
 * [productId, unitId] Prisma → P2002).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireBotWrite(request, [1]);
    if (!auth.ok) return botAuthFail(auth.status);

    const { id: productId } = await context.params;
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, code: true, deletedAt: true },
    });
    if (!product || product.deletedAt)
      return botErr("Produk tidak ditemukan.", 404);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return botErr("Format data (JSON) tidak valid.", 400);
    }

    const unitId =
      typeof body.unitId === "string" ? body.unitId.trim() : "";
    if (!unitId) return botErr("Satuan wajib dipilih.", 400);

    const conversionValue =
      body.conversionValue === undefined ? 1 : asNumber(body.conversionValue);
    if (
      conversionValue === null ||
      !Number.isInteger(conversionValue) ||
      conversionValue < 1
    )
      return botErr("Nilai konversi harus bilangan bulat 1 atau lebih.", 400);

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

    const isPrimary =
      body.isPrimary === undefined ? false : body.isPrimary;
    if (typeof isPrimary !== "boolean")
      return botErr("Penanda satuan utama harus true atau false.", 400);
    if (isPrimary && conversionValue !== 1)
      return botErr("Satuan utama harus memiliki nilai konversi 1.", 400);

    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) return botErr("Satuan tidak ditemukan.", 400);

    let created;
    try {
      created = await prisma.$transaction(async (tx) => {
        if (isPrimary) {
          // Jadikan semua satuan lain produk ini non-primary dulu.
          await tx.productUnit.updateMany({
            where: { productId },
            data: { isPrimary: false },
          });
        }
        return tx.productUnit.create({
          data: {
            productId,
            unitId,
            conversionValue,
            buyPrice,
            sellPrice,
            isPrimary,
          },
          include: {
            unit: { select: { id: true, name: true, symbol: true } },
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return botErr("Satuan ini sudah ada untuk produk tersebut.", 400);
      }
      throw error;
    }

    await auditSafe({
      level: auth.level,
      sender: auth.sender,
      method: "POST",
      endpoint: `/api/bot/products/${productId}/units`,
      entityType: "ProductUnit",
      entityId: created.id,
      before: {},
      after: {
        productCode: product.code,
        unit: unit.name,
        conversionValue,
        sellPrice,
        isPrimary,
      },
      success: true,
    });

    return botOk({
      id: created.id,
      productId: created.productId,
      unitId: created.unitId,
      unit: {
        id: created.unit.id,
        name: created.unit.name,
        symbol: created.unit.symbol,
      },
      conversionValue: created.conversionValue,
      sellPrice: toNum(created.sellPrice),
      isPrimary: created.isPrimary,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    });
  } catch (error) {
    console.error("[API_BOT_PRODUCT_UNITS_POST_ERROR]", error);
    return sanitizeBotError(error);
  }
}
