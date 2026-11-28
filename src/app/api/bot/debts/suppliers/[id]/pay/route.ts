import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireBotWrite,
  botOk,
  botErr,
  sanitizeBotError,
  writeBotAudit,
  getBotActorUserId,
  toNum,
} from "@/lib/bot-auth";
import { withUniqueRetry } from "@/lib/utils/stock-units";
import { DebtStatus, PaymentMethod } from "@prisma/client";

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

const VALID_METHODS: PaymentMethod[] = [
  "CASH",
  "TRANSFER",
  "CREDIT",
  "DEBIT_CARD",
  "QRIS",
];

// Sentinel untuk klaim atomik di dalam transaksi (pola M-15 di
// supplier-debt.actions.ts): updateMany hanya berhasil kalau utang belum
// lunas DAN sisa >= jumlah bayar.
const PAY_CLAIM_FAILED = "PAY_CLAIM_FAILED";

// WS-F minor batch 5 (disalin dari supplier-debt.actions.ts
// resolvePaymentDate): paymentDate "YYYY-MM-DD" diparse JS sebagai tengah
// malam UTC (00:00Z = 08:00 WITA). Kalau datang tepat tengah malam UTC
// (= tanggal saja, tanpa jam), isi jamnya dengan jam sebenarnya saat
// pembayaran dicatat (jam WITA saat ini dipasang pada tanggal yang
// dipilih); kalau sudah membawa jam, dipakai apa adanya.
const WITA_OFFSET_MS = 8 * 60 * 60 * 1000;
function resolvePaymentDate(input: Date): Date {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return new Date();
  const isMidnightUtc =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;
  if (!isMidnightUtc) return d;
  const nowWita = new Date(Date.now() + WITA_OFFSET_MS);
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      nowWita.getUTCHours(),
      nowWita.getUTCMinutes(),
      nowWita.getUTCSeconds(),
      nowWita.getUTCMilliseconds()
    ) - WITA_OFFSET_MS
  );
}

/**
 * POST /api/bot/debts/suppliers/[id]/pay — Level 1 & 2.
 * Bayar utang supplier. Meniru addSupplierDebtPayment di
 * supplier-debt.actions.ts:
 * - amount positif, TIDAK BOLEH melebihi remainingDebt; utang PAID ditolak.
 * - Nomor pembayaran PAY-YYYYMMDD-NNN (urut hari ini, dari pembayaran
 *   terakhir hari ini + 1).
 * - Transaksi Prisma: potong sisa utang secara atomik, catat DebtPayment,
 *   status baru PAID bila sisa 0, kalau tidak PARTIAL; Purchase ikut naik
 *   paidAmount-nya (M-16). Status Purchase TIDAK diubah — status itu
 *   status penerimaan barang, bukan status bayar.
 * - DebtPayment.adminId diisi id SUPER_ADMIN pertama (getBotActorUserId),
 *   karena bot tidak punya user id.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireBotWrite(request, [1, 2]);
    if (!auth.ok) return botAuthFail(auth.status);

    const { id: debtId } = await context.params;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return botErr("Format data (JSON) tidak valid.", 400);
    }

    const amount = asNumber(body.amount);
    if (amount === null || amount <= 0)
      return botErr("Jumlah pembayaran harus angka lebih dari 0.", 400);
    // Batas atas sama seperti addSupplierPaymentSchema (FIX PENTEST L11).
    if (amount > 1_000_000_000)
      return botErr("Jumlah pembayaran terlalu besar.", 400);

    const paymentMethod =
      typeof body.paymentMethod === "string"
        ? body.paymentMethod.trim()
        : "";
    if (!VALID_METHODS.includes(paymentMethod as PaymentMethod))
      return botErr(
        "Metode pembayaran tidak valid. Pilihan: CASH, TRANSFER, CREDIT, DEBIT_CARD, QRIS.",
        400
      );

    let paymentDate = new Date();
    if (
      body.paymentDate !== undefined &&
      body.paymentDate !== null &&
      body.paymentDate !== ""
    ) {
      const parsed = new Date(String(body.paymentDate));
      if (Number.isNaN(parsed.getTime()))
        return botErr("Tanggal pembayaran tidak valid.", 400);
      paymentDate = resolvePaymentDate(parsed);
    }

    const notes =
      typeof body.notes === "string" ? body.notes.trim() : "";
    if (notes.length > 500)
      return botErr("Catatan maksimal 500 karakter.", 400);

    const debt = await prisma.supplierDebt.findUnique({
      where: { id: debtId },
      select: {
        id: true,
        debtNumber: true,
        purchaseId: true,
        totalDebt: true,
        paidAmount: true,
        remainingDebt: true,
        status: true,
      },
    });
    if (!debt) return botErr("Utang supplier tidak ditemukan.", 404);
    if (debt.status === DebtStatus.PAID)
      return botErr("Utang supplier ini sudah lunas.", 400);
    const remaining = toNum(debt.remainingDebt) ?? 0;
    if (amount > remaining)
      return botErr(
        `Jumlah pembayaran melebihi sisa utang (Rp ${remaining.toLocaleString(
          "id-ID"
        )}).`,
        400
      );

    const actorId = await getBotActorUserId();
    if (!actorId) return botErr("Terjadi kesalahan internal server.", 500);

    const before = {
      debtNumber: debt.debtNumber,
      totalDebt: toNum(debt.totalDebt),
      paidAmount: toNum(debt.paidAmount),
      remainingDebt: remaining,
      status: debt.status,
    };

    let result;
    try {
      result = await withUniqueRetry(() =>
        prisma.$transaction(async (tx) => {
          // A. Potong sisa hutang secara atomik (M-15).
          const claimed = await tx.supplierDebt.updateMany({
            where: {
              id: debtId,
              status: { not: DebtStatus.PAID },
              remainingDebt: { gte: amount },
            },
            data: {
              paidAmount: { increment: amount },
              remainingDebt: { decrement: amount },
            },
          });
          if (claimed.count === 0) throw new Error(PAY_CLAIM_FAILED);

          // B. Baca sisa terbaru (di dalam transaksi) untuk status baru.
          // OVERDUE yang dicicil ikut jadi PARTIAL / PAID (kondisi di
          // atas hanya mengecualikan PAID — sama seperti web).
          const fresh = await tx.supplierDebt.findUnique({
            where: { id: debtId },
          });
          if (!fresh) throw new Error("DEBT_NOT_FOUND");
          const newRemaining = Number(fresh.remainingDebt);
          const newStatus =
            newRemaining === 0 ? DebtStatus.PAID : DebtStatus.PARTIAL;
          const updated = await tx.supplierDebt.update({
            where: { id: debtId },
            data: { status: newStatus },
          });

          // C. Nomor pembayaran harian PAY-YYYYMMDD-NNN (pola web).
          const today = new Date();
          const dateStr = today
            .toISOString()
            .split("T")[0]
            .replace(/-/g, "");
          const lastPayment = await tx.debtPayment.findFirst({
            where: { paymentNumber: { startsWith: `PAY-${dateStr}` } },
            orderBy: { createdAt: "desc" },
            select: { paymentNumber: true },
          });
          const lastNum = lastPayment
            ? parseInt(lastPayment.paymentNumber.split("-").pop() || "0")
            : 0;
          const paymentNumber = `PAY-${dateStr}-${String(
            (Number.isFinite(lastNum) ? lastNum : 0) + 1
          ).padStart(3, "0")}`;

          // D. Catat pembayaran.
          const payment = await tx.debtPayment.create({
            data: {
              paymentNumber,
              supplierDebtId: debtId,
              amount,
              paymentMethod: paymentMethod as PaymentMethod,
              paymentDate,
              notes: notes || null,
              adminId: actorId,
            },
          });

          // E. Purchase.paidAmount naik bersamaan (M-16). Status Purchase
          // TIDAK diubah (status penerimaan barang, bukan status bayar).
          if (debt.purchaseId) {
            await tx.purchase.update({
              where: { id: debt.purchaseId },
              data: { paidAmount: { increment: amount } },
            });
          }

          return { payment, debt: updated };
        })
      );
    } catch (error) {
      if (error instanceof Error && error.message === PAY_CLAIM_FAILED)
        return botErr(
          "Jumlah pembayaran melebihi sisa utang atau utang sudah lunas.",
          400
        );
      if (error instanceof Error && error.message === "DEBT_NOT_FOUND")
        return botErr("Utang supplier tidak ditemukan.", 404);
      throw error;
    }

    await auditSafe({
      level: auth.level,
      sender: auth.sender,
      method: "POST",
      endpoint: "/api/bot/debts/suppliers/[id]/pay",
      entityType: "SupplierDebt",
      entityId: debtId,
      before,
      after: {
        remainingDebt: toNum(result.debt.remainingDebt),
        paidAmount: toNum(result.debt.paidAmount),
        status: result.debt.status,
        paymentNumber: result.payment.paymentNumber,
        amount,
        paymentMethod,
      },
      success: true,
    });

    return botOk({
      payment: {
        id: result.payment.id,
        paymentNumber: result.payment.paymentNumber,
        amount: toNum(result.payment.amount),
        paymentMethod: result.payment.paymentMethod,
        paymentDate: result.payment.paymentDate,
        notes: result.payment.notes,
      },
      debt: {
        id: result.debt.id,
        debtNumber: result.debt.debtNumber,
        totalDebt: toNum(result.debt.totalDebt),
        paidAmount: toNum(result.debt.paidAmount),
        remainingDebt: toNum(result.debt.remainingDebt),
        status: result.debt.status,
      },
    });
  } catch (error) {
    console.error("[API_BOT_DEBTS_SUPPLIERS_PAY_POST_ERROR]", error);
    return botErr(sanitizeBotError(error), 500);
  }
}
