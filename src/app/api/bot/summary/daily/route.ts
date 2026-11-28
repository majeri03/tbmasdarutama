import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireBotRead,
  botOk,
  botErr,
  sanitizeBotError,
  toNum,
} from "@/lib/bot-auth";

// ---------------------------------------------------------------------------
// Batas "hari ini": hari kalender WITA (Asia/Makassar, UTC+8, tanpa DST).
// Pola yang SAMA dengan kode laporan yang ada
// (src/lib/actions/report.actions.ts: startOfWitaDay/endOfWitaDay):
// 00:00:00.000 WITA s.d. 23:59:59.999 WITA. Bukan zona lokal server
// (Vercel = UTC), supaya transaksi sekitar tengah malam WITA tidak
// masuk/keluar ringkasan yang salah.
// ---------------------------------------------------------------------------
const WITA_TIME_ZONE = "Asia/Makassar";
const WITA_OFFSET_MS = 8 * 60 * 60 * 1000;

function witaDayParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: WITA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function startOfWitaDay(date: Date): Date {
  const { year, month, day } = witaDayParts(date);
  return new Date(Date.UTC(year, month - 1, day) - WITA_OFFSET_MS);
}

function endOfWitaDay(date: Date): Date {
  const { year, month, day } = witaDayParts(date);
  return new Date(Date.UTC(year, month - 1, day + 1) - WITA_OFFSET_MS - 1);
}

/**
 * GET /api/bot/summary/daily
 * Ringkasan hari ini (hari kalender WITA) untuk bot WhatsApp (baca saja):
 * - penjualan hari ini (hanya status COMPLETED): jumlah transaksi + total Rp
 * - piutang baru hari ini: jumlah + total Rp (totalDebt)
 * - utang supplier belum lunas (UNPAID/PARTIAL/OVERDUE): jumlah + total sisa Rp
 * - jumlah produk stok menipis (currentStock <= minStock, produk aktif,
 *   bukan yang sudah dihapus)
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

    const now = new Date();
    const dayStart = startOfWitaDay(now);
    const dayEnd = endOfWitaDay(now);
    const { year, month, day } = witaDayParts(now);
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const [salesAgg, newDebtsAgg, supplierDebtsAgg, stockRows] =
      await Promise.all([
        prisma.sale.aggregate({
          where: {
            status: "COMPLETED",
            saleDate: { gte: dayStart, lte: dayEnd },
          },
          _count: true,
          _sum: { grandTotal: true },
        }),
        prisma.customerDebt.aggregate({
          where: { createdAt: { gte: dayStart, lte: dayEnd } },
          _count: true,
          _sum: { totalDebt: true },
        }),
        prisma.supplierDebt.aggregate({
          where: { status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] } },
          _count: true,
          _sum: { remainingDebt: true },
        }),
        // Prisma tidak bisa membandingkan dua kolom (currentStock <=
        // minStock) di where — hitung di memori (daftar produk toko kecil).
        prisma.product.findMany({
          where: { deletedAt: null, isActive: true },
          select: { currentStock: true, minStock: true },
        }),
      ]);

    const lowStockCount = stockRows.filter(
      (p) => p.currentStock <= p.minStock
    ).length;

    return botOk({
      date,
      timezone: WITA_TIME_ZONE,
      salesToday: {
        transactionCount: salesAgg._count,
        totalAmount: toNum(salesAgg._sum.grandTotal),
      },
      newCustomerDebtsToday: {
        count: newDebtsAgg._count,
        totalAmount: toNum(newDebtsAgg._sum.totalDebt),
      },
      unpaidSupplierDebts: {
        count: supplierDebtsAgg._count,
        totalRemainingAmount: toNum(supplierDebtsAgg._sum.remainingDebt),
      },
      lowStockProducts: lowStockCount,
    });
  } catch (error) {
    console.error("[API_BOT_SUMMARY_DAILY_GET_ERROR]", error);
    return sanitizeBotError(error);
  }
}
