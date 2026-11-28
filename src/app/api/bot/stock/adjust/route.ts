import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireBotWrite,
  botOk,
  botErr,
  sanitizeBotError,
  writeBotAudit,
  getBotActorUserId,
} from "@/lib/bot-auth";

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

// Sentinel untuk penolakan stok minus tanpa alasan di dalam transaksi.
const NEGATIVE_WITHOUT_REASON = "NEGATIVE_WITHOUT_REASON";

/**
 * POST /api/bot/stock/adjust — Level 1 saja.
 * Penyesuaian stok: quantity adalah DELTA (boleh negatif, tidak boleh 0),
 * reason wajib. Di dalam satu transaksi: Product.currentStock += quantity
 * dan satu StockMovement { type: 'ADJUSTMENT', quantity: delta,
 * referenceType: 'Adjustment', notes: reason }.
 *
 * Aturan stok minus (perintah user: "stok tidak boleh minus tanpa alasan"):
 * reason wajib diisi — jadi stok akhir negatif HANYA bisa terjadi bila ada
 * alasan, dan alasan itu dicatat jelas di StockMovement.notes + audit log.
 * Pertahanan berlapis: bila reason kosong dan hasil akhir negatif, tolak 400.
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

    const productId =
      typeof body.productId === "string" ? body.productId.trim() : "";
    if (!productId) return botErr("Produk wajib dipilih.", 400);

    const quantity = asNumber(body.quantity);
    if (quantity === null || !Number.isInteger(quantity))
      return botErr("Jumlah penyesuaian harus bilangan bulat.", 400);
    if (quantity === 0)
      return botErr(
        "Jumlah penyesuaian tidak boleh 0 — tidak ada perubahan stok.",
        400
      );

    const reason =
      typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason)
      return botErr("Alasan penyesuaian stok wajib diisi.", 400);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, code: true, name: true, currentStock: true, deletedAt: true },
    });
    if (!product || product.deletedAt)
      return botErr("Produk tidak ditemukan.", 404);

    const actorId = await getBotActorUserId();
    if (!actorId) return botErr("Terjadi kesalahan internal server.", 500);

    // Baca stok + hitung + catat SEMUA di dalam satu transaksi (pola M-5
    // di stock.actions.ts) supaya dua adjustment bersamaan tidak saling
    // menimpa.
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        const fresh = await tx.product.findUnique({
          where: { id: productId },
          select: { currentStock: true },
        });
        if (!fresh) throw new Error("PRODUCT_NOT_FOUND");

        const newStock = fresh.currentStock + quantity;

        // Pertahanan berlapis: stok minus tanpa alasan ditolak.
        // (Tidak terjangkau bila validasi reason di atas lolos — reason
        // wajib — tapi tetap dijaga di sini supaya aturannya tidak hilang
        // kalau validasi di atas berubah.)
        if (newStock < 0 && !reason) throw new Error(NEGATIVE_WITHOUT_REASON);

        const movement = await tx.stockMovement.create({
          data: {
            productId,
            type: "ADJUSTMENT",
            quantity,
            referenceType: "Adjustment",
            notes: reason,
            createdById: actorId,
          },
        });

        await tx.product.update({
          where: { id: productId },
          data: { currentStock: newStock },
        });

        return {
          movement,
          previousStock: fresh.currentStock,
          newStock,
        };
      });
    } catch (error) {
      if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND")
        return botErr("Produk tidak ditemukan.", 404);
      if (error instanceof Error && error.message === NEGATIVE_WITHOUT_REASON)
        return botErr(
          "Stok tidak boleh minus tanpa alasan. Isi alasan penyesuaian dulu.",
          400
        );
      throw error;
    }

    await auditSafe({
      level: auth.level,
      sender: auth.sender,
      method: "POST",
      endpoint: "/api/bot/stock/adjust",
      entityType: "StockMovement",
      entityId: result.movement.id,
      before: { productCode: product.code, currentStock: result.previousStock },
      after: {
        currentStock: result.newStock,
        quantity,
        reason,
        ...(result.newStock < 0
          ? { note: "Stok akhir negatif, diizinkan karena ada alasan." }
          : {}),
      },
      success: true,
    });

    return botOk({
      productId: product.id,
      code: product.code,
      name: product.name,
      previousStock: result.previousStock,
      quantity,
      currentStock: result.newStock,
      movementId: result.movement.id,
      isNegative: result.newStock < 0,
    });
  } catch (error) {
    console.error("[API_BOT_STOCK_ADJUST_POST_ERROR]", error);
    return botErr(sanitizeBotError(error), 500);
  }
}
