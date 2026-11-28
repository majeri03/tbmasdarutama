import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireBotRead,
  botOk,
  botErr,
  sanitizeBotError,
  parseBotPagination,
  toNum,
} from "@/lib/bot-auth";

/**
 * GET /api/bot/stock
 * Daftar produk + stok untuk bot WhatsApp (baca saja).
 * Query: search (nama/kode produk), low=true (currentStock <= minStock),
 * page (default 1), limit (default 20, maks 50).
 * TIDAK PERNAH mengembalikan buyPrice.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireBotRead(request);
    if (!auth.ok) {
      return botErr(
        auth.status === 429
          ? "Terlalu banyak permintaan. Coba lagi sebentar lagi."
          : "Kunci bot tidak valid.",
        auth.status
      );
    }

    const { searchParams } = new URL(request.url);
    const { page, limit } = parseBotPagination(searchParams);
    const search = searchParams.get("search")?.trim() || undefined;
    const lowOnly = searchParams.get("low") === "true";

    // Prisma tidak bisa membandingkan dua kolom (currentStock <= minStock)
    // di where — jadi filter "low" dilakukan di memori setelah query.
    // Daftar produk toko jumlahnya kecil, jadi ini aman.
    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        currentStock: true,
        minStock: true,
        isActive: true,
        productUnits: {
          where: { isPrimary: true },
          take: 1,
          select: {
            sellPrice: true,
            unit: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const mapped = products
      .map((p) => {
        const primary = p.productUnits[0] ?? null;
        return {
          id: p.id,
          code: p.code,
          name: p.name,
          currentStock: p.currentStock,
          minStock: p.minStock,
          isActive: p.isActive,
          unit: primary
            ? {
                id: primary.unit.id,
                name: primary.unit.name,
                sellPrice: toNum(primary.sellPrice),
              }
            : null,
        };
      })
      .filter((p) => !lowOnly || p.currentStock <= p.minStock);

    const total = mapped.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const data = mapped.slice((page - 1) * limit, page * limit);

    return botOk(data, { page, limit, total, totalPages });
  } catch (error) {
    console.error("[API_BOT_STOCK_GET_ERROR]", error);
    return sanitizeBotError(error);
  }
}
