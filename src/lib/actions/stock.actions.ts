"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  stockAdjustmentSchema,
  type StockAdjustmentInput,
} from "@/lib/validations/stock.schema";
import { MovementType, Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { requireMinimumRole, requirePermission } from "../utils/role";

// ==================== GET STOCK MOVEMENTS ====================
export async function getStockMovements(filters?: {
  search?: string;
  productId?: string;
  movementType?: MovementType;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}) {
  const session = await auth();
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

// ==================== GET LOW STOCK PRODUCTS ====================
export async function getLowStockProducts() {
  const session = await auth();
  requireMinimumRole(session, "KASIR");
  try {
    const lowStockProducts = await prisma.product.findMany({
      where: {
        AND: [
          { isActive: true },
          { deletedAt: null },
          {
            OR: [
              { currentStock: { lte: prisma.product.fields.minStock } },
              { currentStock: 0 },
            ],
          },
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

// ==================== CREATE STOCK ADJUSTMENT ====================
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

    // Get current product stock
    const product = await prisma.product.findUnique({
      where: { id: validated.productId },
      select: { currentStock: true, name: true },
    });

    if (!product) {
      return {
        success: false,
        error: "Produk tidak ditemukan",
      };
    }

    // Calculate new stock
    let newStock = product.currentStock;
    if (validated.type === MovementType.IN) {
      newStock += validated.quantity;
    } else if (validated.type === MovementType.OUT) {
      newStock -= validated.quantity;
      if (newStock < 0) {
        return {
          success: false,
          error: "Stock tidak mencukupi untuk adjustment OUT",
        };
      }
    } else if (validated.type === MovementType.ADJUSTMENT) {
      // For adjustment, quantity is the final stock value
      newStock = validated.quantity;
    }

    // Create transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create stock movement
      const movement = await tx.stockMovement.create({
        data: {
          productId: validated.productId,
          type: validated.type,
          quantity: validated.quantity,
          referenceType: validated.referenceType || "Manual Adjustment",
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

      return movement;
    });

    revalidatePath("/dashboard/stocks");
    revalidatePath("/dashboard/products");

    return {
      success: true,
      message: `Stock ${product.name} berhasil disesuaikan`,
      data: result,
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

// ==================== GET STOCK STATISTICS ====================
export async function getStockStatistics() {
  const session = await auth();
requireMinimumRole(session, "KASIR");
  try {
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

    // Low stock count
    const lowStockCount = await prisma.product.count({
      where: {
        AND: [
          { isActive: true },
          { deletedAt: null },
          {
            OR: [
              { currentStock: { lte: prisma.product.fields.minStock } },
              { currentStock: 0 },
            ],
          },
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

// ==================== GET STOCK BY PRODUCT ====================
export async function getStockByProduct(productId: string) {
  const session = await auth();
requireMinimumRole(session, "KASIR");
  try {
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

// ==================== DELETE STOCK MOVEMENT (ADMIN ONLY) ====================
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

    // Reverse stock adjustment
    let newStock = movement.product.currentStock;
    if (movement.type === MovementType.IN) {
      newStock -= movement.quantity; // Reverse IN
    } else if (movement.type === MovementType.OUT) {
      newStock += movement.quantity; // Reverse OUT
    }

    if (newStock < 0) {
      return {
        success: false,
        error: "Tidak dapat menghapus: stock akan menjadi negatif",
      };
    }

    // Delete and update in transaction
    await prisma.$transaction([
      prisma.stockMovement.delete({
        where: { id },
      }),
      prisma.product.update({
        where: { id: movement.product.id },
        data: { currentStock: newStock },
      }),
    ]);

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
