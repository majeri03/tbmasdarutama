import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Perhatikan penambahan parameter 'request: Request'
export async function GET(request: Request) {
  try {
    // ==========================================
    // SISTEM KEAMANAN: VALIDASI API KEY
    // ==========================================
    const clientApiKey = request.headers.get("x-api-key");
    const serverApiKey = process.env.BOT_API_KEY;

    // Jika kunci tidak ada, atau tidak cocok, langsung tolak!
    if (!clientApiKey || clientApiKey !== serverApiKey) {
      return NextResponse.json(
        { status: "error", message: "Akses Ditolak: API Key tidak valid (Unauthorized)" },
        { status: 401 }
      );
    }
    // ==========================================

    // Jika kunci benar, jalankan pengambilan data ke database
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      select: {
        code: true,
        name: true,
        productUnits: {
          where: { isPrimary: true },
          select: {
            sellPrice: true,
            unit: { select: { name: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const formattedProducts = products.map((product) => {
      const primaryUnit = product.productUnits[0]; 
      return {
        kode: product.code,
        nama: product.name,
        satuan: primaryUnit?.unit?.name || "-",
        harga: primaryUnit?.sellPrice ? Number(primaryUnit.sellPrice) : 0,
      };
    });

    return NextResponse.json({
      status: "success",
      count: formattedProducts.length,
      data: formattedProducts,
    });

  } catch (error) {
    console.error("Error fetching products for bot:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal mengambil data produk" },
      { status: 500 }
    );
  }
}