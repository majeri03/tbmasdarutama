import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DebtStatus } from "@prisma/client";

export async function GET(request: Request) {
  const clientApiKey = request.headers.get("x-api-key");
  const serverApiKey = process.env.BOT_API_KEY;
  if (!clientApiKey || clientApiKey !== serverApiKey) {
    return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "customer"; // customer | supplier
    const search = searchParams.get("search");
    const customerId = searchParams.get("customerId");
    const supplierId = searchParams.get("supplierId");
    const status = searchParams.get("status") as DebtStatus | null;
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);

    if (type === "supplier") {
      const supplierDebts = await prisma.supplierDebt.findMany({
        where: {
          AND: [
            supplierId ? { supplierId } : {},
            status ? { status } : {},
            search ? { supplier: { name: { contains: search, mode: "insensitive" } } } : {},
          ],
        },
        select: {
          id: true, debtNumber: true, totalDebt: true, paidAmount: true,
          remainingDebt: true, dueDate: true, status: true, notes: true, createdAt: true,
          supplier: { select: { name: true, phone: true } },
          purchase: { select: { poNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      const totalRemaining = await prisma.supplierDebt.aggregate({
        where: { status: { in: ["UNPAID", "PARTIAL"] } },
        _sum: { remainingDebt: true },
        _count: true,
      });

      const formatted = supplierDebts.map((d) => ({
        debtNumber: d.debtNumber,
        supplier: d.supplier.name,
        poNumber: d.purchase.poNumber,
        totalUtang: Number(d.totalDebt),
        sudahBayar: Number(d.paidAmount),
        sisaUtang: Number(d.remainingDebt),
        jatuhTempo: d.dueDate,
        status: d.status,
      }));

      return NextResponse.json({
        status: "success",
        type: "supplier",
        summary: {
          totalSisaUtang: Number(totalRemaining._sum.remainingDebt || 0),
          jumlahUtangAktif: totalRemaining._count,
        },
        count: formatted.length,
        data: formatted,
      });
    }

    // Default: Customer debts (piutang)
    const customerDebts = await prisma.customerDebt.findMany({
      where: {
        AND: [
          customerId ? { customerId } : {},
          status ? { status } : {},
          search ? { customer: { name: { contains: search, mode: "insensitive" } } } : {},
        ],
      },
      select: {
        id: true, debtNumber: true, totalDebt: true, paidAmount: true,
        remainingDebt: true, dueDate: true, status: true, notes: true, createdAt: true,
        customer: { select: { name: true, phone: true } },
        sale: { select: { invoiceNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const totalRemaining = await prisma.customerDebt.aggregate({
      where: { status: { in: ["UNPAID", "PARTIAL"] } },
      _sum: { remainingDebt: true },
      _count: true,
    });

    const formatted = customerDebts.map((d) => ({
      debtNumber: d.debtNumber,
      customer: d.customer.name,
      telp: d.customer.phone,
      invoice: d.sale.invoiceNumber,
      totalPiutang: Number(d.totalDebt),
      sudahBayar: Number(d.paidAmount),
      sisaPiutang: Number(d.remainingDebt),
      jatuhTempo: d.dueDate,
      status: d.status,
    }));

    return NextResponse.json({
      status: "success",
      type: "customer",
      summary: {
        totalSisaPiutang: Number(totalRemaining._sum.remainingDebt || 0),
        jumlahPiutangAktif: totalRemaining._count,
      },
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error("[BOT] Error fetch debts:", error);
    return NextResponse.json({ status: "error", message: "Gagal mengambil data" }, { status: 500 });
  }
}
