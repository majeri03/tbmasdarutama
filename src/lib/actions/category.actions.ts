"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireMinimumRole } from "@/lib/utils/role";
import { auth } from "@/lib/auth";
// ==================== SCHEMAS ====================
const categoryServerSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().trim().nullable().default(null),
});

const subCategoryServerSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().trim().nullable().default(null),
  categoryId: z.string().min(1),
});

export type CategoryFormData = z.infer<typeof categoryServerSchema>;
export type SubCategoryFormData = z.infer<typeof subCategoryServerSchema>;

// ==================== CREATE CATEGORY ====================
export async function createCategory(data: CategoryFormData) {
  const session = await auth();
requireMinimumRole(session, "ADMIN");
  try {
    const validatedData = categoryServerSchema.parse(data);

    // Check duplicate name
    const existingCategory = await prisma.category.findUnique({
      where: { name: validatedData.name },
    });

    if (existingCategory) {
      return {
        success: false,
        error: `Kategori "${validatedData.name}" sudah ada!`,
      };
    }

    const category = await prisma.category.create({
      data: validatedData,
    });

    revalidatePath("/dashboard/categories");

    return {
      success: true,
      message: `Kategori "${category.name}" berhasil ditambahkan!`,
      data: category,
    };
  } catch (error) {
    console.error("[CREATE_CATEGORY_ERROR]", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }

    return {
      success: false,
      error: "Gagal menambahkan kategori. Silakan coba lagi.",
    };
  }
}

// ==================== GET ALL CATEGORIES ====================
export async function getCategories(params?: {
  search?: string;
  page?: number;
  limit?: number;
  includeSubCategories?: boolean;
}) {
  const session = await auth();
requireMinimumRole(session, "ADMIN");
  try {
    const { 
      search = "", 
      page = 1, 
      limit = 10,
      includeSubCategories = true 
    } = params || {};
    const skip = (page - 1) * limit;

    const where: Prisma.CategoryWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              subCategories: true,
              products: true,
            },
          },
          ...(includeSubCategories && {
            subCategories: {
              orderBy: { name: "asc" },
              include: {
                _count: {
                  select: {
                    products: true,
                  },
                },
              },
            },
          }),
        },
      }),
      prisma.category.count({ where }),
    ]);

    return {
      success: true,
      data: categories,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_CATEGORIES_ERROR]", error);
    return {
      success: false,
      error: "Gagal mengambil data kategori.",
      data: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
    };
  }
}

// ==================== GET CATEGORY BY ID ====================
export async function getCategoryById(id: string) {
  const session = await auth();
requireMinimumRole(session, "ADMIN");
  try {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subCategories: true,
            products: true,
          },
        },
        subCategories: {
          orderBy: { name: "asc" },
          include: {
            _count: {
              select: {
                products: true,
              },
            },
          },
        },
      },
    });

    if (!category) {
      return {
        success: false,
        error: "Kategori tidak ditemukan.",
      };
    }

    return {
      success: true,
      data: category,
    };
  } catch (error) {
    console.error("[GET_CATEGORY_BY_ID_ERROR]", error);
    return {
      success: false,
      error: "Gagal mengambil data kategori.",
    };
  }
}

// ==================== UPDATE CATEGORY ====================
export async function updateCategory(id: string, data: CategoryFormData) {
  const session = await auth();
requireMinimumRole(session, "ADMIN");
  try {
    const validatedData = categoryServerSchema.parse(data);

    const existingCategory = await prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return {
        success: false,
        error: "Kategori tidak ditemukan.",
      };
    }

    // Check duplicate name (exclude current)
    if (validatedData.name !== existingCategory.name) {
      const duplicateCategory = await prisma.category.findUnique({
        where: { name: validatedData.name },
      });

      if (duplicateCategory) {
        return {
          success: false,
          error: `Kategori "${validatedData.name}" sudah ada!`,
        };
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: validatedData,
    });

    revalidatePath("/dashboard/categories");

    return {
      success: true,
      message: `Kategori "${category.name}" berhasil diperbarui!`,
      data: category,
    };
  } catch (error) {
    console.error("[UPDATE_CATEGORY_ERROR]", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }

    return {
      success: false,
      error: "Gagal memperbarui kategori. Silakan coba lagi.",
    };
  }
}

// ==================== DELETE CATEGORY ====================
export async function deleteCategory(id: string) {
  const session = await auth();
requireMinimumRole(session, "ADMIN");
  try {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subCategories: true,
            products: true,
          },
        },
      },
    });

    if (!category) {
      return {
        success: false,
        error: "Kategori tidak ditemukan.",
      };
    }

    // Check if has products
    if (category._count.products > 0) {
      return {
        success: false,
        error: `Kategori "${category.name}" tidak dapat dihapus karena memiliki ${category._count.products} produk.`,
      };
    }

    // Check if has sub-categories
    if (category._count.subCategories > 0) {
      return {
        success: false,
        error: `Kategori "${category.name}" tidak dapat dihapus karena memiliki ${category._count.subCategories} sub-kategori.`,
      };
    }

    await prisma.category.delete({
      where: { id },
    });

    revalidatePath("/dashboard/categories");

    return {
      success: true,
      message: `Kategori "${category.name}" berhasil dihapus!`,
    };
  } catch (error) {
    console.error("[DELETE_CATEGORY_ERROR]", error);
    return {
      success: false,
      error: "Gagal menghapus kategori. Silakan coba lagi.",
    };
  }
}

// ==================== CREATE SUB-CATEGORY ====================
export async function createSubCategory(data: SubCategoryFormData) {
  const session = await auth();
requireMinimumRole(session, "ADMIN");
  try {
    const validatedData = subCategoryServerSchema.parse(data);

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id: validatedData.categoryId },
    });

    if (!category) {
      return {
        success: false,
        error: "Kategori tidak ditemukan.",
      };
    }

    // Check duplicate name in same category
    const existingSubCategory = await prisma.subCategory.findFirst({
      where: {
        name: validatedData.name,
        categoryId: validatedData.categoryId,
      },
    });

    if (existingSubCategory) {
      return {
        success: false,
        error: `Sub-kategori "${validatedData.name}" sudah ada di kategori "${category.name}"!`,
      };
    }

    const subCategory = await prisma.subCategory.create({
      data: validatedData,
    });

    revalidatePath("/dashboard/categories");

    return {
      success: true,
      message: `Sub-kategori "${subCategory.name}" berhasil ditambahkan!`,
      data: subCategory,
    };
  } catch (error) {
    console.error("[CREATE_SUB_CATEGORY_ERROR]", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }

    return {
      success: false,
      error: "Gagal menambahkan sub-kategori. Silakan coba lagi.",
    };
  }
}

// ==================== UPDATE SUB-CATEGORY ====================
export async function updateSubCategory(id: string, data: SubCategoryFormData) {
  const session = await auth();
requireMinimumRole(session, "ADMIN");
  try {
    const validatedData = subCategoryServerSchema.parse(data);

    const existingSubCategory = await prisma.subCategory.findUnique({
      where: { id },
    });

    if (!existingSubCategory) {
      return {
        success: false,
        error: "Sub-kategori tidak ditemukan.",
      };
    }

    // Check duplicate name (exclude current)
    if (
      validatedData.name !== existingSubCategory.name ||
      validatedData.categoryId !== existingSubCategory.categoryId
    ) {
      const duplicateSubCategory = await prisma.subCategory.findFirst({
        where: {
          name: validatedData.name,
          categoryId: validatedData.categoryId,
          id: { not: id },
        },
      });

      if (duplicateSubCategory) {
        return {
          success: false,
          error: `Sub-kategori "${validatedData.name}" sudah ada di kategori ini!`,
        };
      }
    }

    const subCategory = await prisma.subCategory.update({
      where: { id },
      data: validatedData,
    });

    revalidatePath("/dashboard/categories");

    return {
      success: true,
      message: `Sub-kategori "${subCategory.name}" berhasil diperbarui!`,
      data: subCategory,
    };
  } catch (error) {
    console.error("[UPDATE_SUB_CATEGORY_ERROR]", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }

    return {
      success: false,
      error: "Gagal memperbarui sub-kategori. Silakan coba lagi.",
    };
  }
}

// ==================== DELETE SUB-CATEGORY ====================
export async function deleteSubCategory(id: string) {
  const session = await auth();
requireMinimumRole(session, "ADMIN");
  try {
    const subCategory = await prisma.subCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!subCategory) {
      return {
        success: false,
        error: "Sub-kategori tidak ditemukan.",
      };
    }

    // Check if has products
    if (subCategory._count.products > 0) {
      return {
        success: false,
        error: `Sub-kategori "${subCategory.name}" tidak dapat dihapus karena memiliki ${subCategory._count.products} produk.`,
      };
    }

    await prisma.subCategory.delete({
      where: { id },
    });

    revalidatePath("/dashboard/categories");

    return {
      success: true,
      message: `Sub-kategori "${subCategory.name}" berhasil dihapus!`,
    };
  } catch (error) {
    console.error("[DELETE_SUB_CATEGORY_ERROR]", error);
    return {
      success: false,
      error: "Gagal menghapus sub-kategori. Silakan coba lagi.",
    };
  }
}

// ==================== GET CATEGORIES FOR SELECT ====================
export async function getCategoriesForSelect() {
  const session = await auth();
requireMinimumRole(session, "ADMIN");
  try {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      data: categories,
    };
  } catch (error) {
    console.error("[GET_CATEGORIES_FOR_SELECT_ERROR]", error);
    return {
      success: false,
      data: [],
    };
  }
}