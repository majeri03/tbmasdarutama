import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireBotWrite,
  botOk,
  botErr,
  sanitizeBotError,
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
 * POST /api/bot/customers/[id]/points — Level 1 saja.
 * Sesuaikan poin pelanggan: delta int (boleh negatif), reason wajib.
 * Hasil poin tidak boleh < 0 (dibatasi di 0 — pola adjustCustomerPoints
 * di customer.actions.ts). Customer UMUM tidak punya poin — ditolak.
 * Alasan dicatat di audit log.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireBotWrite(request, [1]);
    if (!auth.ok) return botAuthFail(auth.status);

    const { id } = await context.params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { id: true, code: true, name: true, type: true, points: true },
    });
    if (!customer) return botErr("Customer tidak ditemukan.", 404);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return botErr("Format data (JSON) tidak valid.", 400);
    }

    const delta = asNumber(body.delta);
    if (delta === null || !Number.isInteger(delta))
      return botErr("Jumlah penyesuaian poin harus bilangan bulat.", 400);
    if (delta === 0)
      return botErr(
        "Jumlah penyesuaian poin harus bilangan bulat bukan nol.",
        400
      );

    const reason =
      typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason)
      return botErr("Alasan penyesuaian poin wajib diisi.", 400);

    if (customer.type === "UMUM")
      return botErr("Customer Umum tidak memiliki poin.", 400);

    // Baca + hitung + tulis di dalam satu transaksi supaya dua penyesuaian
    // bersamaan tidak saling menimpa (pola yang sama dengan penyesuaian
    // stok di stock.actions.ts).
    const updated = await prisma.$transaction(async (tx) => {
      const fresh = await tx.customer.findUnique({
        where: { id },
        select: { id: true, name: true, type: true, points: true },
      });
      if (!fresh) throw new Error("CUSTOMER_NOT_FOUND");
      if (fresh.type === "UMUM") throw new Error("CUSTOMER_IS_UMUM");
      const nextPoints = Math.max(0, fresh.points + delta);
      return tx.customer.update({
        where: { id },
        data: { points: nextPoints },
        select: { id: true, code: true, name: true, points: true },
      });
    });

    await auditSafe({
      level: auth.level,
      sender: auth.sender,
      method: "POST",
      endpoint: `/api/bot/customers/${id}/points`,
      entityType: "Customer",
      entityId: id,
      before: { points: customer.points },
      after: { points: updated.points, delta, reason },
      success: true,
    });

    return botOk({
      id: updated.id,
      code: updated.code,
      name: updated.name,
      points: updated.points,
      delta,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND")
      return botErr("Customer tidak ditemukan.", 404);
    if (error instanceof Error && error.message === "CUSTOMER_IS_UMUM")
      return botErr("Customer Umum tidak memiliki poin.", 400);
    console.error("[API_BOT_CUSTOMER_POINTS_POST_ERROR]", error);
    return botErr(sanitizeBotError(error), 500);
  }
}
