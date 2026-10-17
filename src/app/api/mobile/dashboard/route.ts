import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/utils/api";
import { db } from "@/lib/db";
import { SaleStatus } from "@prisma/client";

/**
 * GET /api/mobile/dashboard
 * Mengembalikan ringkasan satu-request untuk halaman Beranda Flutter
 * Tidak membutuhkan param apapun — berdasarkan hari ini
 */
export async function GET() {
  const session = await getAuthenticatedUser();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const [
    debtSummary,
    todaySales,
    deliverySummary,
  ] = await Promise.all([
    // Piutang pelanggan aktif
    db.customerDebt.aggregate({
      _sum: { remainingDebt: true },
      _count: { id: true },
      where: { status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] } },
    }),

    // Kas masuk hari ini dari penjualan lunas
    db.sale.aggregate({
      _sum: { totalAmount: true },
      _count: { id: true },
      where: {
        createdAt: { gte: todayStart, lt: todayEnd },
        status: SaleStatus.COMPLETED,
      },
    }),

    // Pengiriman hari ini
    db.deliveryOrder.groupBy({
      by: ["status"],
      _count: { id: true },
      where: {
        deliveryDate: { gte: todayStart, lt: todayEnd },
      },
    }),
  ]);

  // Overdue — lewat 14 hari
  const overdueThreshold = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  const overdue = await db.customerDebt.aggregate({
    _sum: { remainingDebt: true },
    _count: { id: true },
    where: {
      status: { in: ["UNPAID", "PARTIAL"] },
      dueDate: { lt: overdueThreshold },
    },
  });

  const deliveryMap: Record<string, number> = {};
  for (const row of deliverySummary) {
    deliveryMap[row.status] = row._count.id;
  }

  return NextResponse.json({
    success: true,
    data: {
      totalDebt:       Number(debtSummary._sum?.remainingDebt ?? 0),
      todayIncome:     Number(todaySales._sum?.totalAmount ?? 0),
      todayOrders:     todaySales._count?.id ?? 0,
      overdueDebt:     Number(overdue._sum?.remainingDebt ?? 0),
      overdueCount:    overdue._count?.id ?? 0,
      deliveryCount:   Object.values(deliveryMap).reduce((a, b) => a + b, 0),
      deliveryDone:    deliveryMap["DELIVERED"] ?? 0,
      deliveryProcess: deliveryMap["PENDING"] ?? 0,
    },
  });
}
