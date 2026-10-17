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
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("search");

    const whereCondition: Prisma.ProductWhereInput = {
      isActive: true,
      deletedAt: null,
    };

    // Pencarian ganda: Nama Produk ATAU Nama Kategori
    if (searchQuery) {
      whereCondition.OR = [
        { name: { contains: searchQuery, mode: "insensitive" } },
        { category: { name: { contains: searchQuery, mode: "insensitive" } } }
      ];
    }

    const products = await prisma.product.findMany({
      where: whereCondition,
      select: {
        id: true,      // productId — dibutuhkan AI untuk siapkan_orderan_otomatis
        code: true,
        name: true,
        currentStock: true,
        productUnits: {
          where: { isPrimary: true },
          select: {
            id: true,        // unitId - dibutuhkan AI untuk siapkan_orderan_otomatis
            unitId: true,
            sellPrice: true,
            unit: { select: { name: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const formattedProducts = products.map((product) => {
      const primaryUnit = product.productUnits[0];
      return {
        id: product.id,               // productId
        kode: product.code,
        nama: product.name,
        stok: product.currentStock,
        satuan: primaryUnit?.unit?.name || "-",
        unitId: primaryUnit?.unitId || null, // unitId
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

export async function POST(request: Request) {
  const clientApiKey = request.headers.get("x-api-key");
  const serverApiKey = process.env.BOT_API_KEY;

  if (!clientApiKey || clientApiKey !== serverApiKey) {
    return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, categoryName, unitName, price } = body;

    if (!name || !unitName || !price) {
      return NextResponse.json({ status: "error", message: "name, unitName, dan price wajib diisi" }, { status: 400 });
    }

    // 1. Cari atau buat Kategori
    let category = null;
    if (categoryName) {
      category = await prisma.category.findFirst({ where: { name: { equals: categoryName, mode: "insensitive" } } });
      if (!category) {
        category = await prisma.category.create({ data: { name: categoryName } });
      }
    } else {
      category = await prisma.category.findFirst();
    }

    if (!category) {
      return NextResponse.json({ status: "error", message: "Tidak ada kategori yang tersedia" }, { status: 500 });
    }

    // 2. Cari atau buat Unit
    let unit = await prisma.unit.findFirst({ where: { name: { equals: unitName, mode: "insensitive" } } });
    if (!unit) {
      unit = await prisma.unit.create({ data: { name: unitName, symbol: unitName.substring(0, 3).toLowerCase() } });
    }

    // 3. Buat Produk
    // Cari kode unik
    const lastProduct = await prisma.product.findFirst({
      where: { code: { startsWith: "P-WA-" } },
      orderBy: { createdAt: "desc" }
    });
    let nextNum = 1;
    if (lastProduct) {
      const parts = lastProduct.code.split("-");
      const lastVal = parseInt(parts[parts.length - 1] || "0");
      if (!isNaN(lastVal)) nextNum = lastVal + 1;
    }
    const newCode = `P-WA-${String(nextNum).padStart(4, "0")}`;

    const newProduct = await prisma.product.create({
      data: {
        code: newCode,
        name: name,
        categoryId: category.id,
        currentStock: 0,
        minStock: 0,
        productUnits: {
          create: [{
            unitId: unit.id,
            buyPrice: Number(price), // Default buy = sell
            sellPrice: Number(price),
            isPrimary: true
          }]
        }
      }
    });

    return NextResponse.json({
      status: "success",
      message: `Produk ${name} berhasil ditambahkan!`,
      data: {
        id: newProduct.id,
        kode: newProduct.code,
        nama: newProduct.name
      }
    });

  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json({ status: "error", message: "Gagal membuat produk" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const clientApiKey = request.headers.get("x-api-key");
  const serverApiKey = process.env.BOT_API_KEY;

  if (!clientApiKey || clientApiKey !== serverApiKey) {
    return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { productId, code, name, price } = body; // bisa edit berdasarkan ID, kode, atau kecocokan nama

    if (!price) {
      return NextResponse.json({ status: "error", message: "Harga baru (price) wajib diisi" }, { status: 400 });
    }

    let product = null;

    if (productId) {
      product = await prisma.product.findUnique({ where: { id: productId }, include: { productUnits: { where: { isPrimary: true } } } });
    } else if (code) {
      product = await prisma.product.findUnique({ where: { code }, include: { productUnits: { where: { isPrimary: true } } } });
    } else if (name) {
      // Cari berdasar nama
      product = await prisma.product.findFirst({
        where: { name: { contains: name, mode: "insensitive" }, isActive: true },
        include: { productUnits: { where: { isPrimary: true } } },
        orderBy: { name: "asc" }
      });
    }

    if (!product) {
      return NextResponse.json({ status: "error", message: "Produk tidak ditemukan" }, { status: 404 });
    }

    const primaryUnit = product.productUnits[0];
    if (!primaryUnit) {
      return NextResponse.json({ status: "error", message: "Produk tidak memiliki satuan utama" }, { status: 400 });
    }

    // Update harga di satuan utama
    await prisma.productUnit.update({
      where: { id: primaryUnit.id },
      data: { sellPrice: Number(price) }
    });

    return NextResponse.json({
      status: "success",
      message: `Harga ${product.name} berhasil diubah menjadi Rp ${Number(price).toLocaleString('id-ID')}`,
      data: {
        id: product.id,
        nama: product.name,
        hargaBaru: price
      }
    });

  } catch (error) {
    console.error("Error updating product price:", error);
    return NextResponse.json({ status: "error", message: "Gagal mengubah harga produk" }, { status: 500 });
  }
}