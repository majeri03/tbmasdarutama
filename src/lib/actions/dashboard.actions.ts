"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { startOfMonth, subDays } from "date-fns";

export async function getDashboardStats() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const now = new Date();
    const startMonth = startOfMonth(now);
    const last30Days = subDays(now, 30);
    const last7Days = subDays(now, 7);

    // Parallel queries untuk performa
    const [
      totalSales,
      lastMonthSales,
      totalProducts,
      lastMonthProducts,
      totalCustomers,
      lastMonthCustomers,
      totalDebt,
      lastMonthDebt,
      salesChart,
      lowStockProducts,
    ] = await Promise.all([
      // Total Penjualan (30 hari)
      prisma.sale.aggregate({
        where: {
          status: "COMPLETED",
          createdAt: { gte: last30Days },
        },
        _sum: { grandTotal: true },
      }),

      // Penjualan bulan lalu (untuk growth %)
      prisma.sale.aggregate({
        where: {
          status: "COMPLETED",
          createdAt: {
            gte: subDays(last30Days, 30),
            lt: last30Days,
          },
        },
        _sum: { grandTotal: true },
      }),

      // Total Produk
      prisma.product.count({
        where: { isActive: true, deletedAt: null },
      }),

      // Produk bulan lalu
      prisma.product.count({
        where: {
          isActive: true,
          deletedAt: null,
          createdAt: { lt: startMonth },
        },
      }),

      // Total Customer
      prisma.customer.count({
        where: { isActive: true },
      }),

      // Customer bulan lalu
      prisma.customer.count({
        where: {
          isActive: true,
          createdAt: { lt: startMonth },
        },
      }),

      // Total Utang Customer
      prisma.customerDebt.aggregate({
        where: {
          status: { in: ["UNPAID", "PARTIAL"] },
        },
        _sum: { remainingDebt: true },
      }),

      // Utang bulan lalu
      prisma.customerDebt.aggregate({
        where: {
          status: { in: ["UNPAID", "PARTIAL"] },
          createdAt: { lt: startMonth },
        },
        _sum: { remainingDebt: true },
      }),

      // ✅ FIX: Chart data (7 hari terakhir) - Gunakan nama tabel yang benar: "sales"
      prisma.$queryRaw<Array<{ date: Date; total: number }>>`
        SELECT 
          DATE("saleDate") as date,
          SUM("grandTotal")::numeric as total
        FROM sales
        WHERE status = 'COMPLETED'
          AND "saleDate" >= ${last7Days}
        GROUP BY DATE("saleDate")
        ORDER BY date ASC
      `,

      // ✅ FIX: Low stock products - Gunakan nama tabel yang benar: "products"
      prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          currentStock: number;
          minStock: number;
          unit: string;
        }>
      >`
        SELECT 
          p.id,
          p.name,
          p."currentStock",
          p."minStock",
          COALESCE(u.name, 'Pcs') as unit
        FROM products p
        LEFT JOIN product_units pu ON p.id = pu."productId" AND pu."isPrimary" = true
        LEFT JOIN units u ON pu."unitId" = u.id
        WHERE p."isActive" = true
          AND p."deletedAt" IS NULL
          AND p."currentStock" < p."minStock"
        ORDER BY p."currentStock" ASC
        LIMIT 5
      `,
    ]);

    // Calculate growth percentages
    const salesGrowth = calculateGrowth(
      Number(totalSales._sum.grandTotal || 0),
      Number(lastMonthSales._sum.grandTotal || 0)
    );

    const productGrowth = calculateGrowth(totalProducts, lastMonthProducts);

    const customerGrowth = calculateGrowth(totalCustomers, lastMonthCustomers);

    const debtChange = calculateGrowth(
      Number(totalDebt._sum.remainingDebt || 0),
      Number(lastMonthDebt._sum.remainingDebt || 0)
    );

    return {
      success: true,
      data: {
        sales: {
          total: Number(totalSales._sum.grandTotal || 0),
          growth: salesGrowth,
        },
        products: {
          total: totalProducts,
          growth: productGrowth,
          newThisMonth: totalProducts - lastMonthProducts,
        },
        customers: {
          total: totalCustomers,
          growth: customerGrowth,
          newThisMonth: totalCustomers - lastMonthCustomers,
        },
        debt: {
          total: Number(totalDebt._sum.remainingDebt || 0),
          change: debtChange,
        },
        chart: (salesChart as Array<{ date: Date; total: number }>).map(
          (item) => ({
            date: item.date.toISOString().split("T")[0],
            total: Number(item.total),
          })
        ),
        lowStock: lowStockProducts.map((p) => ({
          id: p.id,
          name: p.name,
          stock: p.currentStock,
          minStock: p.minStock,
          unit: p.unit,
        })),
      },
    };
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return {
      success: false,
      error: "Gagal mengambil data dashboard",
    };
  }
}

function calculateGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}