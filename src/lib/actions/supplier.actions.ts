"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireMinimumRole } from "@/lib/utils/role";
import { auth } from "@/lib/auth";
// ==================== SCHEMAS ====================
const supplierServerSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  phone: z.string().min(1).max(20).trim(),
  email: z.string().email().trim().nullable().default(null),
  address: z.string().trim().nullable().default(null),
  city: z.string().trim().nullable().default(null),
  province: z.string().trim().nullable().default(null),
  description: z.string().trim().nullable().default(null),
  isActive: z.boolean().default(true),
});

export type SupplierFormData = z.infer<typeof supplierServerSchema>;

// ==================== GENERATE SUPPLIER CODE ====================
async function generateSupplierCode(): Promise<string> {
  const lastSupplier = await prisma.supplier.findFirst({
    orderBy: { code: "desc" },
    select: { code: true },
  });

  if (!lastSupplier) {
    return "SUP-00001";
  }

  const lastNumber = parseInt(lastSupplier.code.split("-")[1]);
  const nextNumber = lastNumber + 1;

  return `SUP-${nextNumber.toString().padStart(5, "0")}`;
}

// ==================== CREATE SUPPLIER ====================
export async function createSupplier(data: SupplierFormData) {
  const session = await auth();
requireMinimumRole(session, "ADMIN");
  try {
    const validatedData = supplierServerSchema.parse(data);

    // Check duplicate phone
    const existingPhone = await prisma.supplier.findFirst({
      where: { phone: validatedData.phone },
    });

    if (existingPhone) {
      return {
        success: false,
        error: `Supplier dengan nomor telepon "${validatedData.phone}" sudah ada!`,
      };
    }

    // Check duplicate email if provided
    if (validatedData.email) {
      const existingEmail = await prisma.supplier.findFirst({
        where: { email: validatedData.email },
      });

      if (existingEmail) {
        return {
          success: false,
          error: `Supplier dengan email "${validatedData.email}" sudah ada!`,
        };
      }
    }

    // Generate supplier code
    const code = await generateSupplierCode();

    const supplier = await prisma.supplier.create({
      data: {
        ...validatedData,
        code,
      },
    });

    revalidatePath("/dashboard/suppliers");

    return {
      success: true,
      message: `Supplier "${supplier.name}" (${supplier.code}) berhasil ditambahkan!`,
      data: supplier,
    };
  } catch (error) {
    console.error("[CREATE_SUPPLIER_ERROR]", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }

    return {
      success: false,
      error: "Gagal menambahkan supplier. Silakan coba lagi.",
    };
  }
}

// ==================== GET ALL SUPPLIERS ====================
export async function getSuppliers(params?: {
  search?: string;
  page?: number;
  limit?: number;
  isActive?: boolean | null;
}) {
  const session = await auth();
requireMinimumRole(session, "ADMIN");
  try {
    const { search = "", page = 1, limit = 10, isActive = null } = params || {};
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierWhereInput = {
      AND: [
        search
          ? {
              OR: [
                { code: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { city: { contains: search, mode: "insensitive" } },
              ],
            }
          : {},
        isActive !== null ? { isActive } : {},
      ],
    };

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              products: true,
              purchases: true,
            },
          },
        },
      }),
      prisma.supplier.count({ where }),
    ]);

    return {
      success: true,
      data: suppliers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_SUPPLIERS_ERROR]", error);
    return {
      success: false,
      error: "Gagal mengambil data supplier.",
      data: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
    };
  }
}

// ==================== GET SUPPLIER BY ID ====================
export async function getSupplierById(id: string) {
  const session = await auth();
requireMinimumRole(session, "ADMIN");
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
            purchases: true,
          },
        },
      },
    });

    if (!supplier) {
      return {
        success: false,
        error: "Supplier tidak ditemukan.",
      };
    }

    return {
      success: true,
      data: supplier,
    };
  } catch (error) {
    console.error("[GET_SUPPLIER_BY_ID_ERROR]", error);
    return {
      success: false,
      error: "Gagal mengambil data supplier.",
    };
  }
}

// ==================== UPDATE SUPPLIER ====================
export async function updateSupplier(id: string, data: SupplierFormData) {
  const session = await auth();
requireMinimumRole(session, "ADMIN");
  try {
    const validatedData = supplierServerSchema.parse(data);

    const existingSupplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!existingSupplier) {
      return {
        success: false,
        error: "Supplier tidak ditemukan.",
      };
    }

    // Check duplicate phone (exclude current)
    if (validatedData.phone !== existingSupplier.phone) {
      const duplicatePhone = await prisma.supplier.findFirst({
        where: { 
          phone: validatedData.phone,
          id: { not: id },
        },
      });

      if (duplicatePhone) {
        return {
          success: false,
          error: `Supplier dengan nomor telepon "${validatedData.phone}" sudah ada!`,
        };
      }
    }

    // Check duplicate email (exclude current)
    if (validatedData.email && validatedData.email !== existingSupplier.email) {
      const duplicateEmail = await prisma.supplier.findFirst({
        where: { 
          email: validatedData.email,
          id: { not: id },
        },
      });

      if (duplicateEmail) {
        return {
          success: false,
          error: `Supplier dengan email "${validatedData.email}" sudah ada!`,
        };
      }
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: validatedData,
    });

    revalidatePath("/dashboard/suppliers");

    return {
      success: true,
      message: `Supplier "${supplier.name}" berhasil diperbarui!`,
      data: supplier,
    };
  } catch (error) {
    console.error("[UPDATE_SUPPLIER_ERROR]", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }

    return {
      success: false,
      error: "Gagal memperbarui supplier. Silakan coba lagi.",
    };
  }
}

// ==================== DELETE SUPPLIER ====================
export async function deleteSupplier(id: string) {
  const session = await auth();
requireMinimumRole(session, "ADMIN");
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
            purchases: true,
          },
        },
      },
    });

    if (!supplier) {
      return {
        success: false,
        error: "Supplier tidak ditemukan.",
      };
    }

    // Check if has products or purchases
    if (supplier._count.products > 0) {
      return {
        success: false,
        error: `Supplier "${supplier.name}" tidak dapat dihapus karena memiliki ${supplier._count.products} produk terkait.`,
      };
    }

    if (supplier._count.purchases > 0) {
      return {
        success: false,
        error: `Supplier "${supplier.name}" tidak dapat dihapus karena memiliki ${supplier._count.purchases} transaksi pembelian.`,
      };
    }

    await prisma.supplier.delete({
      where: { id },
    });

    revalidatePath("/dashboard/suppliers");

    return {
      success: true,
      message: `Supplier "${supplier.name}" (${supplier.code}) berhasil dihapus!`,
    };
  } catch (error) {
    console.error("[DELETE_SUPPLIER_ERROR]", error);
    return {
      success: false,
      error: "Gagal menghapus supplier. Silakan coba lagi.",
    };
  }
}

// ==================== TOGGLE SUPPLIER STATUS ====================
export async function toggleSupplierStatus(id: string) {
  const session = await auth();
requireMinimumRole(session, "ADMIN");
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      return {
        success: false,
        error: "Supplier tidak ditemukan.",
      };
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id },
      data: {
        isActive: !supplier.isActive,
      },
    });

    revalidatePath("/dashboard/suppliers");

    return {
      success: true,
      message: `Supplier "${updatedSupplier.name}" ${
        updatedSupplier.isActive ? "diaktifkan" : "dinonaktifkan"
      }!`,
      data: updatedSupplier,
    };
  } catch (error) {
    console.error("[TOGGLE_SUPPLIER_STATUS_ERROR]", error);
    return {
      success: false,
      error: "Gagal mengubah status supplier.",
    };
  }
}

// ==================== GET SUPPLIERS FOR SELECT ====================
export async function getSuppliersForSelect() {
  const session = await auth();
requireMinimumRole(session, "ADMIN");
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      data: suppliers,
    };
  } catch (error) {
    console.error("[GET_SUPPLIERS_FOR_SELECT_ERROR]", error);
    return {
      success: false,
      data: [],
    };
  }
}