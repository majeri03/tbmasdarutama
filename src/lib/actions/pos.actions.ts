"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateSearchQuery } from "@/lib/utils/pos-helpers";
import { Prisma } from "@prisma/client";

// Get products for POS (with stock > 0 and active only)
export async function getPOSProducts(search?: string, categoryId?: string) {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    // ✅ FIXED: Proper typing
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      currentStock: { gt: 0 }, // Only products with stock
    };

    // Search by barcode, code, or name
    if (search && search.trim()) {
      // ✅ Check if search not empty
      const searchQuery = generateSearchQuery(search);

      where.OR = [];
      if (searchQuery.barcode) {
        where.OR.push({
          barcode: { equals: searchQuery.barcode, mode: "insensitive" },
        });
      }
      if (searchQuery.code) {
        where.OR.push({
          code: { contains: searchQuery.code, mode: "insensitive" },
        });
      }
      if (searchQuery.name) {
        where.OR.push({
          name: { contains: searchQuery.name, mode: "insensitive" },
        });
      }
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const products = await prisma.product.findMany({
      where,
      take: 50,
      orderBy: { name: "asc" },
      include: {
        productUnits: {
          include: {
            unit: true,
          },
          orderBy: {
            isPrimary: "desc",
          },
        },
        productImages: {
          where: { isPrimary: true },
          take: 1,
        },
        category: {
          select: {
            name: true,
          },
        },
      },
    });

    // ✅ Convert Decimal to number before sending to client
    const serializedProducts = products.map((product) => ({
      ...product,
      productUnits: product.productUnits.map((pu) => ({
        ...pu,
        buyPrice: parseFloat(pu.buyPrice.toString()),
        sellPrice: parseFloat(pu.sellPrice.toString()),
      })),
    }));

    return {
      success: true,
      data: serializedProducts,
    };
  } catch (error) {
    console.error("Get POS products error:", error);
    return {
      success: false,
      error: "Gagal mengambil data produk",
    };
  }
}

// Get product by barcode (for scanner)
export async function getProductByBarcode(barcode: string) {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    const product = await prisma.product.findFirst({
      where: {
        barcode: { equals: barcode, mode: "insensitive" },
        isActive: true,
        currentStock: { gt: 0 },
      },
      include: {
        productUnits: {
          include: {
            unit: true,
          },
          orderBy: {
            isPrimary: "desc",
          },
        },
        productImages: {
          where: { isPrimary: true },
          take: 1,
        },
      },
    });

    if (!product) {
      return {
        success: false,
        error: "Produk tidak ditemukan atau stock habis",
      };
    }

    // ✅ Convert Decimal to number
    const serializedProduct = {
      ...product,
      productUnits: product.productUnits.map((pu) => ({
        ...pu,
        buyPrice: parseFloat(pu.buyPrice.toString()),
        sellPrice: parseFloat(pu.sellPrice.toString()),
      })),
    };

    return {
      success: true,
      data: serializedProduct,
    };
  } catch (error) {
    console.error("Get product by barcode error:", error);
    return {
      success: false,
      error: "Gagal mencari produk",
    };
  }
}

// Get customers for selector (active only)
export async function getPOSCustomers(search?: string) {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    // ✅ FIXED: Proper typing
    const where: Prisma.CustomerWhereInput = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      take: 20, // Limit for performance
      orderBy: [{ code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        phone: true,
      },
    });

    return {
      success: true,
      data: customers,
    };
  } catch (error) {
    console.error("Get POS customers error:", error);
    return {
      success: false,
      error: "Gagal mengambil data customer",
    };
  }
}
