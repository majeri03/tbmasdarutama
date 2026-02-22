import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  // Validasi Keamanan
  const clientApiKey = request.headers.get("x-api-key");
  const serverApiKey = process.env.BOT_API_KEY;

  if (!clientApiKey || clientApiKey !== serverApiKey) {
    return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
  }

  try {
    // 1. Ubah parameter tangkapan menjadi "search" (bukan category)
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("search");

    // 2. Gunakan tipe data Prisma yang Anda buat
    const whereCondition: Prisma.ProductWhereInput = {
      isActive: true,
      deletedAt: null,
    };

    // 3. LOGIKA PENCARIAN GANDA: Nama Produk ATAU Nama Kategori
    if (searchQuery) {
      whereCondition.OR = [
        { name: { contains: searchQuery, mode: "insensitive" } }, 
        { category: { name: { contains: searchQuery, mode: "insensitive" } } }
      ];
    }

    const products = await prisma.product.findMany({
      where: whereCondition,
      select: {
        code: true,
        name: true,
        productUnits: {
          where: { isPrimary: true },
          select: { sellPrice: true, unit: { select: { name: true } } },
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
    console.error("Error fetching products:", error);
    return NextResponse.json({ status: "error", message: "Gagal mengambil data produk" }, { status: 500 });
  }
}