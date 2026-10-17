import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function authCheck(request: Request) {
  const clientApiKey = request.headers.get("x-api-key");
  return clientApiKey && clientApiKey === process.env.BOT_API_KEY;
}

// GET /api/bot/invoices?invoiceNumber=INV-xxx&customerId=xxx
export async function GET(request: Request) {
  if (!authCheck(request)) {
    return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const invoiceNumber = searchParams.get("invoiceNumber");
    const customerId = searchParams.get("customerId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "5"), 10);

    const where: Record<string, unknown> = {};
    if (invoiceNumber) where.invoiceNumber = { contains: invoiceNumber, mode: "insensitive" };
    if (customerId) where.customerId = customerId;

    const sales = await prisma.sale.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        saleDate: true,
        totalAmount: true,
        discount: true,
        tax: true,
        grandTotal: true,
        paidAmount: true,
        changeAmount: true,
        paymentMethod: true,
        status: true,
        notes: true,
        customer: { select: { name: true, phone: true, code: true } },
        cashier: { select: { name: true } },
        saleItems: {
          select: {
            quantity: true,
            unitPrice: true,
            discount: true,
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
      invoiceNumber: s.invoiceNumber,
      tanggal: s.saleDate,
      customer: s.customer ? {
        nama: s.customer.name,
        telp: s.customer.phone,
        kode: s.customer.code,
      } : null,
      kasir: s.cashier.name,
      totalBarang: Number(s.totalAmount),
      diskon: Number(s.discount),
      pajak: Number(s.tax),
      grandTotal: Number(s.grandTotal),
      dibayar: Number(s.paidAmount),
      kembalian: Number(s.changeAmount),
      metodeBayar: s.paymentMethod,
      status: s.status,
      catatan: s.notes,
      items: s.saleItems.map((i) => ({
        produk: i.product.name,
        kode: i.product.code,
        qty: i.quantity,
        satuan: i.unit.name,
        harga: Number(i.unitPrice),
        diskon: Number(i.discount),
        subtotal: Number(i.subtotal),
      })),
    }));

    return NextResponse.json({ status: "success", count: formatted.length, data: formatted });
  } catch (error) {
    console.error("[BOT] Error fetch invoices:", error);
    return NextResponse.json({ status: "error", message: "Gagal mengambil data invoice" }, { status: 500 });
  }
}
