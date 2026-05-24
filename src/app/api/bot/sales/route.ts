import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma, SaleStatus } from "@prisma/client";

export async function GET(request: Request) {
  const clientApiKey = request.headers.get("x-api-key");
  const serverApiKey = process.env.BOT_API_KEY;
  if (!clientApiKey || clientApiKey !== serverApiKey) {
    return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const customerId = searchParams.get("customerId");
    const status = searchParams.get("status") as SaleStatus | null;
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);

    const where: Prisma.SaleWhereInput = {};
    const conditions: Prisma.SaleWhereInput[] = [];

    if (search) {
      conditions.push({
        OR: [
          { invoiceNumber: { contains: search, mode: "insensitive" } },
          { customer: { name: { contains: search, mode: "insensitive" } } },
        ]
      });
    }
    if (customerId) conditions.push({ customerId });
    if (status) conditions.push({ status });
    if (dateFrom) conditions.push({ saleDate: { gte: new Date(dateFrom) } });
    if (dateTo) conditions.push({ saleDate: { lte: new Date(dateTo) } });

    if (conditions.length > 0) where.AND = conditions;

    const sales = await prisma.sale.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        saleDate: true,
        grandTotal: true,
        discount: true,
        paymentMethod: true,
        status: true,
        notes: true,
        customer: { select: { name: true, phone: true } },
        cashier: { select: { name: true } },
        saleItems: {
          select: {
            quantity: true,
            unitPrice: true,
            subtotal: true,
            product: { select: { name: true, code: true } },
            unit: { select: { name: true } },
          },
        },
      },
      orderBy: { saleDate: "desc" },
      take: limit,
    });

    const formatted = sales.map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      tanggal: s.saleDate,
      customer: s.customer?.name || "Umum",
      kasir: s.cashier.name,
      grandTotal: Number(s.grandTotal),
      diskon: Number(s.discount),
      metode: s.paymentMethod,
      status: s.status,
      catatan: s.notes,
      items: s.saleItems.map((i) => ({
        produk: i.product.name,
        kode: i.product.code,
        qty: i.quantity,
        satuan: i.unit.name,
        harga: Number(i.unitPrice),
        subtotal: Number(i.subtotal),
      })),
    }));

    return NextResponse.json({ status: "success", count: formatted.length, data: formatted });
  } catch (error) {
    console.error("[BOT] Error fetch sales:", error);
    return NextResponse.json({ status: "error", message: "Gagal mengambil data" }, { status: 500 });
  }
}
