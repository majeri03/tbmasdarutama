"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from "@/lib/validations/product.schema";
import { auth } from "../auth";

// ==================== GENERATE PRODUCT CODE ====================
async function generateProductCode(): Promise<string> {
  const lastProduct = await prisma.product.findFirst({
    orderBy: { code: "desc" },
    select: { code: true },
  });

  if (!lastProduct) {
    return "PRD-00001";
  }

  const lastNumber = parseInt(lastProduct.code.split("-")[1]);
  const nextNumber = lastNumber + 1;

  return `PRD-${nextNumber.toString().padStart(5, "0")}`;
}

// ==================== CREATE PRODUCT ====================
export async function createProduct(data: CreateProductInput) {
  try {
    const validatedData = createProductSchema.parse(data);

    // Check duplicate barcode if provided
    if (validatedData.barcode) {
      const existingBarcode = await prisma.product.findUnique({
        where: { barcode: validatedData.barcode },
      });

      if (existingBarcode) {
        return {
          success: false,
          error: `Produk dengan barcode "${validatedData.barcode}" sudah ada!`,
        };
      }
    }

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id: validatedData.categoryId },
    });

    if (!category) {
      return {
        success: false,
        error: "Kategori tidak ditemukan!",
      };
    }

    // Check if subCategory exists (if provided)
    if (validatedData.subCategoryId) {
      const subCategory = await prisma.subCategory.findUnique({
        where: { id: validatedData.subCategoryId },
      });

      if (!subCategory) {
        return {
          success: false,
          error: "Sub-kategori tidak ditemukan!",
        };
      }
    }

    // Check if supplier exists (if provided)
    if (validatedData.supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: validatedData.supplierId },
      });

      if (!supplier) {
        return {
          success: false,
          error: "Supplier tidak ditemukan!",
        };
      }
    }

    // Validate units exist
    for (const unit of validatedData.units) {
      const unitExists = await prisma.unit.findUnique({
        where: { id: unit.unitId },
      });

      if (!unitExists) {
        return {
          success: false,
          error: `Satuan tidak ditemukan!`,
        };
      }
    }

    // Generate product code
    const code = await generateProductCode();

    // Create product with units and images in transaction
    const product = await prisma.$transaction(async (tx) => {
      // 1. Create product
      const newProduct = await tx.product.create({
        data: {
          code,
          barcode: validatedData.barcode,
          name: validatedData.name,
          description: validatedData.description,
          categoryId: validatedData.categoryId,
          subCategoryId: validatedData.subCategoryId,
          supplierId: validatedData.supplierId,
          minStock: validatedData.minStock,
          currentStock: 0, // Initial stock = 0
          isActive: validatedData.isActive,
        },
      });

      // 2. Create product units
      await tx.productUnit.createMany({
        data: validatedData.units.map((unit) => ({
          productId: newProduct.id,
          unitId: unit.unitId,
          conversionValue: unit.conversionValue,
          buyPrice: unit.buyPrice,
          sellPrice: unit.sellPrice,
          isPrimary: unit.isPrimary,
        })),
      });

      // 3. Create product images (if any)
      if (validatedData.images && validatedData.images.length > 0) {
        await tx.productImage.createMany({
          data: validatedData.images.map((image) => ({
            productId: newProduct.id,
            imageUrl: image.imageUrl,
            isPrimary: image.isPrimary,
          })),
        });
      }

      // 4. Create initial stock movement (IN with quantity 0)
      await tx.stockMovement.create({
        data: {
          productId: newProduct.id,
          type: "ADJUSTMENT",
          quantity: 0,
          referenceType: "Initial Stock",
          notes: "Stok awal produk",
        },
      });

      return newProduct;
    });

    revalidatePath("/dashboard/products");

    return {
      success: true,
      message: `Produk "${product.name}" (${product.code}) berhasil ditambahkan!`,
      data: product,
    };
  } catch (error) {
    console.error("[CREATE_PRODUCT_ERROR]", error);

    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return {
        success: false,
        error: "Barcode sudah digunakan produk lain!",
      };
    }

    return {
      success: false,
      error: "Gagal menambahkan produk. Silakan coba lagi.",
    };
  }
}

// ==================== GET ALL PRODUCTS ====================
export async function getProducts(params?: {
  search?: string;
  page?: number;
  limit?: number;
  categoryId?: string;
  supplierId?: string;
  isActive?: boolean | null;
  lowStock?: boolean;
}) {
  try {
    const {
      search = "",
      page = 1,
      limit = 10,
      categoryId,
      supplierId,
      isActive = null,
      lowStock = false,
    } = params || {};

    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      AND: [
        search
          ? {
              OR: [
                { code: { contains: search, mode: "insensitive" } },
                { barcode: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            }
          : {},
        categoryId ? { categoryId } : {},
        supplierId ? { supplierId } : {},
        isActive !== null ? { isActive } : {},
        lowStock
          ? {
              AND: [
                { currentStock: { gt: 0 } },
                {
                  OR: [
                    { currentStock: { lte: prisma.product.fields.minStock } },
                  ],
                },
              ],
            }
          : {},
      ],
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          subCategory: {
            select: {
              id: true,
              name: true,
            },
          },
          supplier: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          productUnits: {
            include: {
              unit: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: {
              isPrimary: "desc", // Primary unit first
            },
          },
          productImages: {
            orderBy: {
              isPrimary: "desc", // Primary image first
            },
            take: 1, // Only get primary image for list
          },
          _count: {
            select: {
              productImages: true,
              saleItems: true,
              purchaseItems: true,
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      success: true,
      data: products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_PRODUCTS_ERROR]", error);
    return {
      success: false,
      error: "Gagal mengambil data produk.",
      data: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
    };
  }
}

// ==================== GET PRODUCT BY ID ====================
export async function getProductById(id: string) {
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        subCategory: true,
        supplier: true,
        productUnits: {
          include: {
            unit: true,
          },
          orderBy: {
            isPrimary: "desc",
          },
        },
        productImages: {
          orderBy: {
            isPrimary: "desc",
          },
        },
        _count: {
          select: {
            saleItems: true,
            purchaseItems: true,
            stockMovements: true,
          },
        },
      },
    });

    if (!product) {
      return {
        success: false,
        error: "Produk tidak ditemukan.",
      };
    }

    return {
      success: true,
      data: product,
    };
  } catch (error) {
    console.error("[GET_PRODUCT_BY_ID_ERROR]", error);
    return {
      success: false,
      error: "Gagal mengambil data produk.",
    };
  }
}

// ==================== UPDATE PRODUCT ====================
export async function updateProduct(id: string, data: UpdateProductInput) {
  try {
    const validatedData = updateProductSchema.parse(data);

    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: {
        productUnits: true,
        productImages: true,
      },
    });

    if (!existingProduct) {
      return {
        success: false,
        error: "Produk tidak ditemukan.",
      };
    }

    // Check duplicate barcode (exclude current product)
    if (validatedData.barcode && validatedData.barcode !== existingProduct.barcode) {
      const duplicateBarcode = await prisma.product.findFirst({
        where: {
          barcode: validatedData.barcode,
          id: { not: id },
        },
      });

      if (duplicateBarcode) {
        return {
          success: false,
          error: `Produk dengan barcode "${validatedData.barcode}" sudah ada!`,
        };
      }
    }

    // Update product with units and images in transaction
    const product = await prisma.$transaction(async (tx) => {
      // 1. Update main product data
      const updatedProduct = await tx.product.update({
        where: { id },
        data: {
          barcode: validatedData.barcode,
          name: validatedData.name,
          description: validatedData.description,
          categoryId: validatedData.categoryId,
          subCategoryId: validatedData.subCategoryId,
          supplierId: validatedData.supplierId,
          minStock: validatedData.minStock,
          isActive: validatedData.isActive,
        },
      });

      // 2. Update product units if provided
      if (validatedData.units) {
        // Delete all existing units
        await tx.productUnit.deleteMany({
          where: { productId: id },
        });

        // Create new units
        await tx.productUnit.createMany({
          data: validatedData.units.map((unit) => ({
            productId: id,
            unitId: unit.unitId,
            conversionValue: unit.conversionValue,
            buyPrice: unit.buyPrice,
            sellPrice: unit.sellPrice,
            isPrimary: unit.isPrimary,
          })),
        });
      }

      // 3. Update product images if provided
      if (validatedData.images) {
        // Delete all existing images
        await tx.productImage.deleteMany({
          where: { productId: id },
        });

        // Create new images
        if (validatedData.images.length > 0) {
          await tx.productImage.createMany({
            data: validatedData.images.map((image) => ({
              productId: id,
              imageUrl: image.imageUrl,
              isPrimary: image.isPrimary,
            })),
          });
        }
      }

      return updatedProduct;
    });

    revalidatePath("/dashboard/products");

    return {
      success: true,
      message: `Produk "${product.name}" berhasil diperbarui!`,
      data: product,
    };
  } catch (error) {
    console.error("[UPDATE_PRODUCT_ERROR]", error);
    return {
      success: false,
      error: "Gagal memperbarui produk. Silakan coba lagi.",
    };
  }
}

// ==================== DELETE PRODUCT ====================
// Delete product (soft delete)
export async function deleteProduct(id: string) {
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            saleItems: true,
            purchaseItems: true,
          },
        },
      },
    });

    if (!product) {
      return {
        success: false,
        error: "Produk tidak ditemukan.",
      };
    }

    // ✅ Check if has transactions (PENTING!)
    if (product._count.saleItems > 0 || product._count.purchaseItems > 0) {
      return {
        success: false,
        error: `Produk "${product.name}" tidak dapat dihapus karena memiliki ${product._count.saleItems} transaksi penjualan dan ${product._count.purchaseItems} transaksi pembelian.`,
      };
    }

    // ✅ Soft delete: Set deletedAt timestamp
    await prisma.product.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    revalidatePath("/dashboard/products");

    return {
      success: true,
      message: `Produk "${product.name}" (${product.code}) berhasil dihapus!`,
    };
  } catch (error) {
    console.error("[DELETE_PRODUCT_ERROR]", error);
    return {
      success: false,
      error: "Gagal menghapus produk. Silakan coba lagi.",
    };
  }
}
// Restore deleted product
export async function restoreProduct(id: string) {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    await prisma.product.update({
      where: { id },
      data: {
        deletedAt: null,
        isActive: true,
      },
    });

    revalidatePath("/dashboard/products");

    return {
      success: true,
      message: "Produk berhasil direstore",
    };
  } catch (error) {
    console.error("[RESTORE_PRODUCT_ERROR]", error);
    return {
      success: false,
      error: "Gagal restore produk",
    };
  }
}
// ==================== TOGGLE PRODUCT STATUS ====================
export async function toggleProductStatus(id: string) {
  try {
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return {
        success: false,
        error: "Produk tidak ditemukan.",
      };
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        isActive: !product.isActive,
      },
    });

    revalidatePath("/dashboard/products");

    return {
      success: true,
      message: `Produk "${updatedProduct.name}" ${
        updatedProduct.isActive ? "diaktifkan" : "dinonaktifkan"
      }!`,
      data: updatedProduct,
    };
  } catch (error) {
    console.error("[TOGGLE_PRODUCT_STATUS_ERROR]", error);
    return {
      success: false,
      error: "Gagal mengubah status produk.",
    };
  }
}

// ==================== GET PRODUCTS FOR SELECT ====================
export async function getProductsForSelect() {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        currentStock: true,
        productUnits: {
          where: { isPrimary: true },
          include: {
            unit: {
              select: {
                name: true,
              },
            },
          },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      data: products,
    };
  } catch (error) {
    console.error("[GET_PRODUCTS_FOR_SELECT_ERROR]", error);
    return {
      success: false,
      data: [],
    };
  }
}