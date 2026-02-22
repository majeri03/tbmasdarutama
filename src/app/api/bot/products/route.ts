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
    // Menangkap parameter filter kategori dari URL bot
    const { searchParams } = new URL(request.url);
    const categoryFilter = searchParams.get("category");

    // Kondisi pencarian default (Aktif & Belum dihapus)
    const whereCondition: Prisma.ProductWhereInput = {
      isActive: true,
      deletedAt: null,
    };

    // Jika bot mengirimkan filter kategori, tambahkan pencarian relasi ke tabel Category
    if (categoryFilter) {
      whereCondition.category = {
        name: {
          equals: categoryFilter,
          mode: "insensitive" // Mengabaikan huruf besar/kecil (Semen = semen)
        }
      };
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