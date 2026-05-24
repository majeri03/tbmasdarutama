import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function authCheck(request: Request) {
  const clientApiKey = request.headers.get("x-api-key");
  const serverApiKey = process.env.BOT_API_KEY;
  return clientApiKey && clientApiKey === serverApiKey;
}

// GET /api/bot/customers?search=keyword
export async function GET(request: Request) {
  if (!authCheck(request)) {
    return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const customers = await prisma.customer.findMany({
      where: {
        isActive: true,
        ...(search ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { code: { contains: search, mode: "insensitive" } },
          ]
        } : {}),
      },
      select: {
        id: true, code: true, name: true, phone: true, address: true, type: true,
      },
      orderBy: { name: "asc" },
      take: 10,
    });

    return NextResponse.json({ status: "success", count: customers.length, data: customers });
  } catch (error) {
    console.error("[BOT] Error fetch customers:", error);
    return NextResponse.json({ status: "error", message: "Gagal mengambil data" }, { status: 500 });
  }
}

// POST /api/bot/customers — Auto-create atau find customer
// Body: { name, phone?, address?, source? }
export async function POST(request: Request) {
  if (!authCheck(request)) {
    return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, phone, address } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ status: "error", message: "Nama customer wajib diisi (min 2 karakter)" }, { status: 400 });
    }

    const cleanName = name.trim();
    const cleanPhone = phone ? String(phone).replace(/[^0-9+]/g, "") : undefined;

    // Cari customer yang sudah ada (by name atau phone)
    const existing = await prisma.customer.findFirst({
      where: {
        isActive: true,
        OR: [
          { name: { equals: cleanName, mode: "insensitive" } },
          ...(cleanPhone ? [{ phone: cleanPhone }] : []),
        ],
      },
      select: { id: true, code: true, name: true, phone: true, address: true, type: true },
    });

    if (existing) {
      return NextResponse.json({
        status: "success",
        isNew: false,
        message: `Customer "${existing.name}" sudah ada`,
        data: existing,
      });
    }

    // Generate kode customer baru: CUST-WA-001 (prefix WA = dari WhatsApp Bot)
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
        address: address || null,
        type: "UMUM",
        isActive: true,
      },
      select: { id: true, code: true, name: true, phone: true, address: true, type: true },
    });

    return NextResponse.json({
      status: "success",
      isNew: true,
      message: `Customer baru "${newCustomer.name}" berhasil dibuat (${newCustomer.code})`,
      data: newCustomer,
    }, { status: 201 });

  } catch (error) {
    console.error("[BOT] Error create customer:", error);
    return NextResponse.json({ status: "error", message: "Gagal membuat customer" }, { status: 500 });
  }
}
