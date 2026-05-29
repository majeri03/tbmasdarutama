import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function authCheck(request: Request) {
  const clientApiKey = request.headers.get("x-api-key") || request.headers.get("x-bot-api-key");
  const serverApiKey = process.env.BOT_API_KEY || process.env.WA_BOT_API_KEY;
  return clientApiKey && clientApiKey === serverApiKey;
}

// GET /api/bot/delivery-queue
// Daftar antrian pengiriman (Surat Jalan PENDING + IN_TRANSIT)
// Ringan: hanya field yang perlu untuk ditampilkan di WA bot
export async function GET(request: Request) {
  if (!authCheck(request)) {
    return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status"); // opsional filter

    const whereStatus = statusParam
      ? [statusParam]
      : ["PENDING", "IN_TRANSIT"];

    const deliveries = await prisma.deliveryOrder.findMany({
      where: {
        status: { in: whereStatus as any[] },
      },
      select: {
        id: true,
        doNumber: true,
        deliveryDate: true,
        status: true,
        driver: true,
        notes: true,
        customer: {
          select: {
            name: true,
            phone: true,
            address: true,
          },
        },
        deliveryItems: {
          select: {
            quantity: true,
            product: { select: { name: true } },
            unit: { select: { name: true } },
          },
        },
      },
      orderBy: { deliveryDate: "asc" },
      take: 20,
    });

    const formatted = deliveries.map((d) => ({
      no: d.doNumber,
      status: d.status,
      tanggal: new Date(d.deliveryDate).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        timeZone: "Asia/Makassar",
      }),
      customer: d.customer.name,
      telepon: d.customer.phone || "-",
      alamat: d.customer.address || "-",
      sopir: d.driver || "-",
      catatan: d.notes || null,
      barang: d.deliveryItems.map((i) => `${i.quantity} ${i.unit.name} ${i.product.name}`),
    }));

    return NextResponse.json({
      status: "success",
      count: formatted.length,
      antrian: formatted,
    });
  } catch (error) {
    console.error("[BOT] Error fetch delivery queue:", error);
    return NextResponse.json({ status: "error", message: "Gagal mengambil antrian" }, { status: 500 });
  }
}
