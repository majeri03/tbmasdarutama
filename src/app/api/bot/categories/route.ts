import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  // 1. Validasi Keamanan (Satpam API)
  const clientApiKey = request.headers.get("x-api-key");
  const serverApiKey = process.env.BOT_API_KEY;

  if (!clientApiKey || clientApiKey !== serverApiKey) {
    return NextResponse.json(
      { status: "error", message: "Akses Ditolak: API Key tidak valid" },
      { status: 401 }
    );
  }

  try {
    // 2. Ambil semua kategori dari database
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { name: true } // Hanya ambil nama kategorinya saja biar ringan
    });

    // Ubah format menjadi array teks biasa: ["Besi", "Semen", "Cat"]
    const categoryNames = categories.map(c => c.name);

    return NextResponse.json({
      status: "success",
      count: categoryNames.length,
      data: categoryNames,
    });

  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json({ status: "error", message: "Gagal mengambil kategori" }, { status: 500 });
  }
}