import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function authCheck(request: Request) {
  const clientApiKey = request.headers.get("x-api-key");
  return clientApiKey && clientApiKey === process.env.BOT_API_KEY;
}

// GET /api/bot/reports?type=financial|inventory|debts|sales&period=daily|weekly|monthly
export async function GET(request: Request) {
  if (!authCheck(request)) {
    return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "financial";
    const period = searchParams.get("period") || "monthly";

    const now = new Date();
    let dateFrom: Date;

    if (period === "daily") {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "weekly") {
      dateFrom = new Date(now);
      dateFrom.setDate(now.getDate() - 7);
    } else {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    if (type === "financial") {
      const [salesAgg, purchasesAgg, debtAgg, supplierDebtAgg] = await Promise.all([
        prisma.sale.aggregate({
          where: { status: "COMPLETED", saleDate: { gte: dateFrom } },
          _sum: { grandTotal: true, discount: true },
          _count: true,
        }),
        prisma.purchase.aggregate({
          where: { status: "RECEIVED", purchaseDate: { gte: dateFrom } },
          _sum: { grandTotal: true },
          _count: true,
        }),
        prisma.customerDebt.aggregate({
          where: { status: { in: ["UNPAID", "PARTIAL"] } },
          _sum: { remainingDebt: true },
        }),
        prisma.supplierDebt.aggregate({
          where: { status: { in: ["UNPAID", "PARTIAL"] } },
          _sum: { remainingDebt: true },
        }),
      ]);

      return NextResponse.json({
        status: "success",
        type: "financial",
        period,
        data: {
          omzet: Number(salesAgg._sum.grandTotal || 0),
          jumlahTransaksi: salesAgg._count,
          totalDiskon: Number(salesAgg._sum.discount || 0),
          totalPembelian: Number(purchasesAgg._sum.grandTotal || 0),
          jumlahPO: purchasesAgg._count,
          sisaPiutangCustomer: Number(debtAgg._sum.remainingDebt || 0),
          sisaUtangSupplier: Number(supplierDebtAgg._sum.remainingDebt || 0),
        },
      });
    }

    if (type === "inventory") {
      const [totalProducts, lowStock, outOfStock] = await Promise.all([
        prisma.product.count({ where: { isActive: true, deletedAt: null } }),
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count FROM products
          WHERE "isActive" = true AND "deletedAt" IS NULL
          AND "currentStock" <= "minStock" AND "currentStock" > 0
        `.catch(() => [{ count: BigInt(0) }]),
        prisma.product.count({
          where: { isActive: true, deletedAt: null, currentStock: { lte: 0 } },
        }),
      ]);

      return NextResponse.json({
        status: "success",
        type: "inventory",
        data: {
          totalProduk: totalProducts,
          stokRendah: Number(lowStock[0]?.count || 0),
          stokHabis: outOfStock,
          stokAman: totalProducts - Number(lowStock[0]?.count || 0) - outOfStock,
        },
      });
    }

    if (type === "debts") {
      const [custDebt, suppDebt] = await Promise.all([
        prisma.customerDebt.aggregate({
          where: { status: { in: ["UNPAID", "PARTIAL"] } },
          _sum: { totalDebt: true, paidAmount: true, remainingDebt: true },
          _count: true,
        }),
        prisma.supplierDebt.aggregate({
          where: { status: { in: ["UNPAID", "PARTIAL"] } },
          _sum: { totalDebt: true, paidAmount: true, remainingDebt: true },
          _count: true,
        }),
      ]);

      return NextResponse.json({
        status: "success",
        type: "debts",
        data: {
          piutangCustomer: {
            jumlah: custDebt._count,
            totalPiutang: Number(custDebt._sum.totalDebt || 0),
            sudahBayar: Number(custDebt._sum.paidAmount || 0),
            sisaPiutang: Number(custDebt._sum.remainingDebt || 0),
          },
          utangSupplier: {
            jumlah: suppDebt._count,
            totalUtang: Number(suppDebt._sum.totalDebt || 0),
            sudahBayar: Number(suppDebt._sum.paidAmount || 0),
            sisaUtang: Number(suppDebt._sum.remainingDebt || 0),
          },
        },
      });
    }

    if (type === "sales") {
      const salesAgg = await prisma.sale.aggregate({
        where: { status: "COMPLETED", saleDate: { gte: dateFrom } },
        _sum: { grandTotal: true, discount: true, tax: true },
        _count: true,
      });

      // Top 5 produk terlaris
      const topProducts = await prisma.saleItem.groupBy({
        by: ["productId"],
        where: { sale: { status: "COMPLETED", saleDate: { gte: dateFrom } } },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      });

      const productIds = topProducts.map((t) => t.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      });
      const productMap = new Map(products.map((p) => [p.id, p.name]));

      return NextResponse.json({
        status: "success",
        type: "sales",
        period,
        data: {
          totalOmzet: Number(salesAgg._sum.grandTotal || 0),
          jumlahTransaksi: salesAgg._count,
          totalDiskon: Number(salesAgg._sum.discount || 0),
          totalPajak: Number(salesAgg._sum.tax || 0),
          produkTerlaris: topProducts.map((t) => ({
            produk: productMap.get(t.productId) || "?",
            terjual: t._sum.quantity,
            pendapatan: Number(t._sum.subtotal || 0),
          })),
        },
      });
    }

    return NextResponse.json({ status: "error", message: "Tipe laporan tidak valid" }, { status: 400 });
  } catch (error) {
    console.error("[BOT] Error fetch reports:", error);
    return NextResponse.json({ status: "error", message: "Gagal mengambil laporan" }, { status: 500 });
  }
}
