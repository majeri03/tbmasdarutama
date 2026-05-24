import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const clientApiKey = request.headers.get("x-api-key");
  const serverApiKey = process.env.BOT_API_KEY;
  if (!clientApiKey || clientApiKey !== serverApiKey) {
    return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const suppliers = await prisma.supplier.findMany({
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
        id: true, code: true, name: true, phone: true, address: true, city: true,
      },
      orderBy: { name: "asc" },
      take: 10,
    });

    return NextResponse.json({ status: "success", count: suppliers.length, data: suppliers });
  } catch (error) {
    console.error("[BOT] Error fetch suppliers:", error);
    return NextResponse.json({ status: "error", message: "Gagal mengambil data" }, { status: 500 });
  }
}
