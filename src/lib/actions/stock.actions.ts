"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  stockAdjustmentSchema,
  type StockAdjustmentInput,
} from "@/lib/validations/stock.schema";
import { MovementType, Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { requireMinimumRole, requirePermission, type AuthSession } from "../utils/role";

export async function getStockMovements(
  filters?: {
    search?: string;
    productId?: string;
    movementType?: MovementType;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
  },
  externalSession?: AuthSession | null
) {
  const session = externalSession || (await auth());
  requireMinimumRole(session, "KASIR"); // All roles can view
  try {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.StockMovementWhereInput = {};

    // Product filter (by name or code)
    if (filters?.search) {
      where.product = {
        OR: [
          { name: { contains: filters.search, mode: "insensitive" } },
          { code: { contains: filters.search, mode: "insensitive" } },
          { barcode: { contains: filters.search, mode: "insensitive" } },
        ],
      };
    }

    // Product ID filter
    if (filters?.productId) {
      where.productId = filters.productId;
    }

    // Movement type filter
    if (filters?.movementType) {
      where.type = filters.movementType;
    }

    // Date range filter
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.createdAt.lte = filters.dateTo;
      }
    }

    // Fetch movements with product details
    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              barcode: true,
              currentStock: true,
              productUnits: {
                select: {
                  id: true,
                  isPrimary: true,
                  unit: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return {
      success: true,
      data: movements,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("Error fetching stock movements:", error);
    return {
      success: false,
      error: "Gagal mengambil data pergerakan stock",
    };
  }
}

export async function getLowStockProducts() {
  const session = await auth();
  try {
    requireMinimumRole(session, "KASIR");
    // Item 96 (WS-G, 25 Nov 2026): SATU definisi stok rendah di halaman
    // stocks — currentStock <= minStock. Cabang OR `currentStock = 0` yang
    // lama sudah tercakup di sini (minStock >= 0, jadi 0 <= minStock
    // selalu) dan dihapus supaya daftar ini tidak bisa menyimpang lagi
    // dari hitungan lowStockCount di getStockStatistics.
    const lowStockProducts = await prisma.product.findMany({
      where: {
        AND: [
          { isActive: true },
          { deletedAt: null },
          { currentStock: { lte: prisma.product.fields.minStock } },
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
        barcode: true,
        currentStock: true,
        minStock: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { currentStock: "asc" },
    });

    return {
      success: true,
      data: lowStockProducts,
    };
  } catch (error) {
    console.error("Error fetching low stock products:", error);
    return {
      success: false,
      error: "Gagal mengambil data produk stock rendah",
    };
  }
}

export async function createStockAdjustment(input: StockAdjustmentInput) {
  try {
    // Validate session
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }
    requirePermission(session, "ADJUST_STOCK");

    // Validate input
    const validated = stockAdjustmentSchema.parse(input);

    // M-5 FIX (Nov 2026): baca stok + hitung + catat SEMUA di dalam satu
    // transaksi. Sebelumnya stok dibaca di luar transaksi lalu stok baru
    // dihitung dari bacaan basi — dua adjustment bersamaan saling menimpa.
    // Selain itu, untuk tipe ADJUSTMENT quantity yang dicatat sekarang adalah
    // SELISIH (stok baru - stok sekarang), bukan level absolut: naik dicatat
    // sebagai IN, turun sebagai OUT, sebesar |selisih|. Dengan begitu riwayat
    // stok konsisten (jumlah IN - OUT = perubahan stok) dan penghapusan
    // movement bisa membalikkan efeknya dengan benar (lihat
    // deleteStockMovement). referenceType tetap "Manual Adjustment" supaya
    // asal movement tetap ketahuan.
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: validated.productId },
        select: { currentStock: true, name: true },
      });
      if (!product) {
        throw new Error("Produk tidak ditemukan");
      }

      let newStock = product.currentStock;
      let movementType = validated.type;
      let movementQty = validated.quantity;

      if (validated.type === MovementType.IN) {
        newStock += validated.quantity;
      } else if (validated.type === MovementType.OUT) {
        newStock -= validated.quantity;
      } else if (validated.type === MovementType.ADJUSTMENT) {
        // quantity = stok akhir yang diinginkan (level absolut dari form).
        const delta = validated.quantity - product.currentStock;
        if (delta === 0) {
          throw new Error("Stock sudah sama dengan nilai adjustment, tidak ada perubahan");
        }
        movementType = delta > 0 ? MovementType.IN : MovementType.OUT;
        movementQty = Math.abs(delta);
        newStock = validated.quantity;
      } else {
        // RETURN: barang kembali masuk (stok bertambah).
        newStock += validated.quantity;
      }

      if (newStock < 0) {
        throw new Error("Stock tidak mencukupi untuk adjustment ini");
      }

      // PENTEST FIX (22 Nov 2026, L21): referenceType dari klien tidak
      // boleh dipercaya — dulu movement manual bisa dilabeli "Purchase" /
      // "Sale" sehingga lolos dari proteksi hapus di deleteStockMovement
      // (jejak audit palsu). Hanya dua label sah yang diizinkan: dari
      // form adjustment ("Manual Adjustment") dan dari halaman Stock
      // Opname ("Stock Opname"); sisanya dipaksa "Manual Adjustment".
      const safeReferenceType =
        validated.referenceType === "Stock Opname"
          ? "Stock Opname"
          : "Manual Adjustment";

      // Create stock movement
      const movement = await tx.stockMovement.create({
        data: {
          productId: validated.productId,
          type: movementType,
          quantity: movementQty,
          referenceType: safeReferenceType,
          referenceId: validated.referenceId,
          notes: validated.notes,
          createdById: session.user.id,
        },
      });

      // Update product stock
      await tx.product.update({
        where: { id: validated.productId },
        data: { currentStock: newStock },
      });

      return { movement, productName: product.name, newStock };
    });

    revalidatePath("/dashboard/stocks");
    revalidatePath("/dashboard/products");

    return {
      success: true,
      message: `Stock ${result.productName} berhasil disesuaikan (stok sekarang: ${result.newStock})`,
      data: result.movement,
    };
  } catch (error) {
    console.error("Error creating stock adjustment:", error);
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: "Gagal menyesuaikan stock",
    };
  }
}

export async function getStockStatistics() {
  const session = await auth();
  try {
    requireMinimumRole(session, "KASIR");
    // Total products
    const totalProducts = await prisma.product.count({
      where: {
        isActive: true,
        deletedAt: null,
      },
    });

    // Total stock value (calculate from all product units)
    const productsWithUnits = await prisma.product.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      select: {
        currentStock: true,
        productUnits: {
          where: { isPrimary: true },
          select: {
            buyPrice: true,
            sellPrice: true,
          },
          take: 1,
        },
      },
    });

    let totalBuyValue = 0;
    let totalSellValue = 0;

    productsWithUnits.forEach((product) => {
      if (product.productUnits.length > 0) {
        const unit = product.productUnits[0];
        totalBuyValue += product.currentStock * Number(unit.buyPrice);
        totalSellValue += product.currentStock * Number(unit.sellPrice);
      }
    });

    // Low stock count — definisi SAMA dengan getLowStockProducts (item 96,
    // WS-G): currentStock <= minStock, tanpa cabang tambahan.
    const lowStockCount = await prisma.product.count({
      where: {
        AND: [
          { isActive: true },
          { deletedAt: null },
          { currentStock: { lte: prisma.product.fields.minStock } },
        ],
      },
    });

    // Stock movements today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const movementsToday = await prisma.stockMovement.count({
      where: {
        createdAt: { gte: today },
      },
    });

    // Total stock IN this month
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const stockInMonth = await prisma.stockMovement.aggregate({
      where: {
        type: MovementType.IN,
        createdAt: { gte: firstDayOfMonth },
      },
      _sum: {
        quantity: true,
      },
    });

    // Total stock OUT this month
    const stockOutMonth = await prisma.stockMovement.aggregate({
      where: {
        type: MovementType.OUT,
        createdAt: { gte: firstDayOfMonth },
      },
      _sum: {
        quantity: true,
      },
    });

    return {
      success: true,
      data: {
        totalProducts,
        totalBuyValue: Math.round(totalBuyValue),
        totalSellValue: Math.round(totalSellValue),
        lowStockCount,
        movementsToday,
        stockInMonth: stockInMonth._sum.quantity || 0,
        stockOutMonth: stockOutMonth._sum.quantity || 0,
      },
    };
  } catch (error) {
    console.error("Error fetching stock statistics:", error);
    return {
      success: false,
      error: "Gagal mengambil statistik stock",
    };
  }
}

export async function getStockByProduct(productId: string) {
  const session = await auth();
  try {
    requireMinimumRole(session, "KASIR");
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        subCategory: true,
        supplier: true,
        productUnits: {
          include: {
            unit: true,
          },
        },
        stockMovements: {
          orderBy: { createdAt: "desc" },
          take: 10, // Last 10 movements
        },
      },
    });

    if (!product) {
      return {
        success: false,
        error: "Produk tidak ditemukan",
      };
    }

    return {
      success: true,
      data: product,
    };
  } catch (error) {
    console.error("Error fetching product stock:", error);
    return {
      success: false,
      error: "Gagal mengambil data stock produk",
    };
  }
}

export async function deleteStockMovement(id: string) {
  try {
    // Validate session
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    // Only admin can delete
    if (session.user.role === "KASIR") {
      return {
        success: false,
        error: "Hanya admin yang dapat menghapus pergerakan stock",
      };
    }
    requirePermission(session, "DELETE_STOCK_MOVEMENT");
    
    // Get movement details
    const movement = await prisma.stockMovement.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            currentStock: true,
          },
        },
      },
    });

    if (!movement) {
      return {
        success: false,
        error: "Pergerakan stock tidak ditemukan",
      };
    }

    // M-6 FIX (Nov 2026): movement dari transaksi penjualan/pembelian tidak
    // boleh dihapus dari riwayat stok — menghapusnya memutus jejak audit dan
    // (kalau dibalik) merusak stok yang sudah dipakai transaksi lain.
    // Yang boleh dihapus hanya movement manual (adjustment/opname/return).
    const refType = movement.referenceType || "";
    if (
      refType === "Sale" ||
      refType === "Sale Edit" ||
      refType === "Sale Cancellation" ||
      refType === "POS_SALE" ||
      refType === "Purchase" ||
      refType === "WaOrder" ||
      refType === "DELIVERY_ORDER"
    ) {
      return {
        success: false,
        error: "Pergerakan dari penjualan/pembelian/pengiriman tidak boleh dihapus. Batalkan transaksinya lewat menu terkait.",
      };
    }

    // Reverse stock adjustment — baca stok terbaru DI DALAM transaksi supaya
    // tidak memakai bacaan basi.
    // IN/RETURN menambah stok saat dicatat -> hapus = kurangi.
    // OUT mengurangi stok saat dicatat -> hapus = tambah.
    // ADJUSTMENT lama (sebelum fix M-5) mencatat quantity sebagai level stok
    // akhir, bukan selisih — arah perubahannya tidak tercatat, jadi tidak
    // bisa dibalik dengan aman -> tolak, suruh sesuaikan lewat Stock Opname.
    if (movement.type === MovementType.ADJUSTMENT) {
      return {
        success: false,
        error: "Pergerakan ADJUSTMENT lama tidak bisa dihapus karena arah perubahannya tidak tercatat. Sesuaikan stok lewat Stock Opname.",
      };
    }
    const delta =
      movement.type === MovementType.IN || movement.type === MovementType.RETURN
        ? -movement.quantity
        : movement.quantity;

    // Delete and update in transaction
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.product.findUnique({
        where: { id: movement.product.id },
        select: { currentStock: true },
      });
      if (!fresh) throw new Error("Produk tidak ditemukan");
      const newStock = fresh.currentStock + delta;
      if (newStock < 0) {
        throw new Error("Tidak dapat menghapus: stock akan menjadi negatif");
      }
      await tx.stockMovement.delete({ where: { id } });
      await tx.product.update({
        where: { id: movement.product.id },
        data: { currentStock: newStock },
      });
    });

    revalidatePath("/dashboard/stocks");
    revalidatePath("/dashboard/products");

    return {
      success: true,
      message: `Pergerakan stock ${movement.product.name} berhasil dihapus`,
    };
  } catch (error) {
    console.error("Error deleting stock movement:", error);
    return {
      success: false,
      error: "Gagal menghapus pergerakan stock",
    };
  }
}
