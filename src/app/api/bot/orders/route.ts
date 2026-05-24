import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { WaOrderStatus } from "@prisma/client";

function authCheck(request: Request) {
  const clientApiKey = request.headers.get("x-api-key") || request.headers.get("x-bot-api-key");
  const serverApiKey = process.env.BOT_API_KEY || process.env.WA_BOT_API_KEY;
  return clientApiKey && clientApiKey === serverApiKey;
}

// GET /api/bot/orders?status=PENDING|CONFIRMED&limit=10
export async function GET(request: Request) {
  if (!authCheck(request)) {
    return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as WaOrderStatus | null;
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);

    const orders = await prisma.waOrder.findMany({
      where: status ? { status } : {},
      select: {
        id: true,
        rawMessage: true,
        senderPhone: true,
        senderName: true,
        customerName: true,
        groupName: true,
        status: true,
        notes: true,
        parsedItems: true,
        receivedAt: true,
        confirmedAt: true,
        confirmedBy: { select: { name: true } },
      },
      orderBy: { receivedAt: "desc" },
      take: limit,
    });

    const formatted = orders.map((o) => ({
      id: o.id,
      pengirim: o.senderName,
      telp: o.senderPhone,
      customer: o.customerName || "-",
      pesan: o.rawMessage.length > 150 ? o.rawMessage.substring(0, 150) + "..." : o.rawMessage,
      items: o.parsedItems, // Sudah terstruktur dari AI
      status: o.status,
      catatan: o.notes,
      diterima: o.receivedAt,
      dikonfirmasi: o.confirmedAt,
      oleh: o.confirmedBy?.name || null,
    }));

    const pendingCount = await prisma.waOrder.count({ where: { status: "PENDING" } });

    return NextResponse.json({
      status: "success",
      pendingCount,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error("[BOT] Error fetch orders:", error);
    return NextResponse.json({ status: "error", message: "Gagal mengambil data" }, { status: 500 });
  }
}

// POST /api/bot/orders — Buat orderan WA baru via AI (dengan auto-create customer)
// Body: { rawMessage, senderPhone, senderName, groupName?, customerName, notes?, parsedItems? }
// parsedItems format: [{ productName, productCode?, productId?, unitId?, quantity, unit, price? }]
export async function POST(request: Request) {
  if (!authCheck(request)) {
    return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { rawMessage, senderPhone, senderName, groupName, customerName, notes, parsedItems } = body;

    if (!rawMessage || !senderPhone || !senderName) {
      return NextResponse.json(
        { status: "error", message: "rawMessage, senderPhone, senderName wajib" },
        { status: 400 }
      );
    }

    // ==================== AUTO-CREATE / FIND CUSTOMER ====================
    let resolvedCustomerName = customerName || senderName;
    let customerId: string | null = null;

    if (resolvedCustomerName && resolvedCustomerName.trim().length >= 2) {
      const cleanName = resolvedCustomerName.trim();
      const cleanPhone = senderPhone ? String(senderPhone).replace(/[^0-9+]/g, "") : null;

      // Cari existing customer
      const existing = await prisma.customer.findFirst({
        where: {
          isActive: true,
          OR: [
            { name: { equals: cleanName, mode: "insensitive" } },
            ...(cleanPhone ? [{ phone: cleanPhone }] : []),
          ],
        },
        select: { id: true, name: true, code: true },
      });

      if (existing) {
        customerId = existing.id;
        resolvedCustomerName = existing.name;
      } else {
        // Auto-create customer baru dari WA
        const lastCustomer = await prisma.customer.findFirst({
          where: { code: { startsWith: "CUST-WA-" } },
          orderBy: { createdAt: "desc" },
          select: { code: true },
        });

        let nextNum = 1;
        if (lastCustomer?.code) {
          const parts = lastCustomer.code.split("-");
          const lastNum = parseInt(parts[parts.length - 1] || "0");
          if (!isNaN(lastNum)) nextNum = lastNum + 1;
        }
        const newCode = `CUST-WA-${String(nextNum).padStart(3, "0")}`;

        const newCustomer = await prisma.customer.create({
          data: {
            code: newCode,
            name: cleanName,
            phone: cleanPhone || null,
            address: null,
            type: "UMUM",
            isActive: true,
          },
          select: { id: true, name: true, code: true },
        });

        customerId = newCustomer.id;
        resolvedCustomerName = newCustomer.name;
        console.log(`[BOT] ✅ Auto-created customer: ${newCustomer.name} (${newCustomer.code})`);
      }
    }

    // ==================== SIMPAN ORDER ====================
    const order = await prisma.waOrder.create({
      data: {
        rawMessage,
        senderPhone,
        senderName,
        groupName: groupName || "WA Bot AI",
        parsedItems: parsedItems || null,
        customerName: resolvedCustomerName || null,
        notes: notes || null,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      status: "success",
      message: "Orderan berhasil dicatat",
      data: {
        id: order.id,
        status: order.status,
        customerId,
        customerName: resolvedCustomerName,
        itemCount: Array.isArray(parsedItems) ? parsedItems.length : 0,
      },
    }, { status: 201 });

  } catch (error) {
    console.error("[BOT] Error create order:", error);
    return NextResponse.json({ status: "error", message: "Gagal membuat orderan" }, { status: 500 });
  }
}
