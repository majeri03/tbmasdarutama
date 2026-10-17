import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const clientApiKey = request.headers.get("x-api-key");
  const serverApiKey = process.env.BOT_API_KEY;
  if (!clientApiKey || clientApiKey !== serverApiKey) {
    return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
  }

  try {
    const now = new Date();
    const last30Days = new Date(now);
    last30Days.setDate(now.getDate() - 30);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      salesTotal30d,
      salesToday,
      totalCustomers,
      totalProducts,
      totalDebt,
      totalSupplierDebt,
      pendingOrders,
      lowStockCount,
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: { status: "COMPLETED", saleDate: { gte: last30Days } },
        _sum: { grandTotal: true },
        _count: true,
      }),
      prisma.sale.aggregate({
        where: { status: "COMPLETED", saleDate: { gte: todayStart } },
        _sum: { grandTotal: true },
        _count: true,
      }),
      prisma.customer.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: true, deletedAt: null } }),
      prisma.customerDebt.aggregate({
        where: { status: { in: ["UNPAID", "PARTIAL"] } },
        _sum: { remainingDebt: true },
        _count: true,
      }),
      prisma.supplierDebt.aggregate({
        where: { status: { in: ["UNPAID", "PARTIAL"] } },
        _sum: { remainingDebt: true },
        _count: true,
      }),
      prisma.waOrder.count({ where: { status: "PENDING" } }),
      prisma.product.count({
        where: {
          isActive: true,
          deletedAt: null,
          currentStock: { lte: prisma.product.fields.minStock },
        },
      }).catch(() => 0), // fallback if comparison fails
    ]);

    return NextResponse.json({
      status: "success",
      data: {
        penjualanHariIni: {
          total: Number(salesToday._sum.grandTotal || 0),
          jumlahTransaksi: salesToday._count,
        },
        penjualan30Hari: {
          total: Number(salesTotal30d._sum.grandTotal || 0),
          jumlahTransaksi: salesTotal30d._count,
        },
        totalCustomer: totalCustomers,
        totalProduk: totalProducts,
        piutangCustomer: {
          totalSisa: Number(totalDebt._sum.remainingDebt || 0),
          jumlah: totalDebt._count,
        },
        utangSupplier: {
          totalSisa: Number(totalSupplierDebt._sum.remainingDebt || 0),
          jumlah: totalSupplierDebt._count,
        },
        orderanPending: pendingOrders,
        produkStokRendah: lowStockCount,
      },
    });
  } catch (error) {
    console.error("[BOT] Error fetch dashboard:", error);
    return NextResponse.json({ status: "error", message: "Gagal mengambil data" }, { status: 500 });
  }
}
