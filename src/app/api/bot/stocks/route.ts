import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function authCheck(request: Request) {
  const clientApiKey = request.headers.get("x-api-key");
  return clientApiKey && clientApiKey === process.env.BOT_API_KEY;
}

// GET /api/bot/stocks?search=&lowStockOnly=true&limit=20
export async function GET(request: Request) {
  if (!authCheck(request)) {
    return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const lowStockOnly = searchParams.get("lowStockOnly") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(search ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { code: { contains: search, mode: "insensitive" } },
            { category: { name: { contains: search, mode: "insensitive" } } },
          ]
        } : {}),
        // Filter stok rendah: currentStock <= minStock
        ...(lowStockOnly ? { currentStock: { lte: 0 } } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        currentStock: true,
        minStock: true,
        category: { select: { name: true } },
        productUnits: {
          where: { isPrimary: true },
          select: { unit: { select: { name: true } } },
        },
      },
      orderBy: { currentStock: "asc" },
      take: limit,
    });

    // Jika lowStockOnly, filter manual berdasarkan minStock
    const filtered = lowStockOnly
      ? products.filter(p => p.currentStock <= p.minStock)
      : products;

    const formatted = filtered.map(p => ({
      id: p.id,
      kode: p.code,
      nama: p.name,
      kategori: p.category.name,
      stokSekarang: p.currentStock,
      stokMinimum: p.minStock,
      satuan: p.productUnits[0]?.unit?.name || "-",
      statusStok: p.currentStock <= 0
        ? "HABIS"
        : p.currentStock <= p.minStock
        ? "RENDAH"
        : "AMAN",
    }));

    return NextResponse.json({
      status: "success",
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error("[BOT] Error fetch stocks:", error);
    return NextResponse.json({ status: "error", message: "Gagal mengambil data stok" }, { status: 500 });
  }
}

// POST /api/bot/stocks — Stock adjustment (opname via WA)
// Body: { productId, quantity, type: "IN"|"OUT"|"ADJUSTMENT", notes }
export async function POST(request: Request) {
  if (!authCheck(request)) {
    return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { productId, quantity, type, notes } = body;

    if (!productId || typeof quantity !== "number" || !type) {
      return NextResponse.json({ status: "error", message: "productId, quantity, dan type wajib diisi" }, { status: 400 });
    }

    if (!["IN", "OUT", "ADJUSTMENT"].includes(type)) {
      return NextResponse.json({ status: "error", message: "type harus IN, OUT, atau ADJUSTMENT" }, { status: 400 });
    }

    // Ambil produk
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, currentStock: true },
    });

    if (!product) {
      return NextResponse.json({ status: "error", message: "Produk tidak ditemukan" }, { status: 404 });
    }

    // Hitung stok baru
    let newStock = product.currentStock;
    if (type === "IN") newStock += quantity;
    else if (type === "OUT") newStock -= quantity;
    else if (type === "ADJUSTMENT") newStock = quantity; // set langsung

    if (newStock < 0) {
      return NextResponse.json({ status: "error", message: `Stok tidak cukup. Stok saat ini: ${product.currentStock}` }, { status: 400 });
    }

    // Cari user BOT (gunakan SUPER_ADMIN pertama sebagai referensi)
    const botUser = await prisma.user.findFirst({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN"] } },
      select: { id: true },
    });

    if (!botUser) {
      return NextResponse.json({ status: "error", message: "Tidak ada user admin untuk mencatat gerakan stok" }, { status: 500 });
    }

    // Update stok dan buat StockMovement dalam 1 transaksi
    const [updatedProduct, movement] = await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: { currentStock: newStock },
      }),
      prisma.stockMovement.create({
        data: {
          productId,
          type,
          quantity,
          referenceType: "WA_BOT",
          reference: "WA Bot Adjustment",
          notes: notes || `Adjustment via WA Bot: ${type} ${quantity}`,
          createdById: botUser.id,
        },
      }),
    ]);

    return NextResponse.json({
      status: "success",
      message: `Stok ${product.name} berhasil diupdate`,
      data: {
        produk: product.name,
        stokSebelum: product.currentStock,
        stokSesudah: newStock,
        perubahan: type === "ADJUSTMENT" ? `set ke ${quantity}` : `${type} ${quantity}`,
        movementId: movement.id,
      },
    });
  } catch (error) {
    console.error("[BOT] Error update stock:", error);
    return NextResponse.json({ status: "error", message: "Gagal mengupdate stok" }, { status: 500 });
  }
}
