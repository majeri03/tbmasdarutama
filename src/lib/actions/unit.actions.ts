"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireMinimumRole } from "@/lib/utils/role";
import { auth } from "@/lib/auth";
// Schema untuk validasi di server
const unitServerSchema = z.object({
  name: z.string().min(1).max(50).trim().toUpperCase(),
  description: z.string().trim().nullable().default(null),
});

export type UnitFormData = z.infer<typeof unitServerSchema>;

// ==================== CREATE UNIT ====================
export async function createUnit(data: UnitFormData) {
  const session = await auth();
  requireMinimumRole(session, "ADMIN"); // SUPER_ADMIN & ADMIN
  try {
    // Validate input
    const validatedData = unitServerSchema.parse(data);

    // Check duplicate name
    const existingUnit = await prisma.unit.findUnique({
      where: { name: validatedData.name },
    });

    if (existingUnit) {
      return {
        success: false,
        error: `Satuan "${validatedData.name}" sudah ada!`,
      };
    }

    // Create unit
    const unit = await prisma.unit.create({
      data: validatedData,
    });

    revalidatePath("/dashboard/units");

    return {
      success: true,
      message: `Satuan "${unit.name}" berhasil ditambahkan!`,
      data: unit,
    };
  } catch (error) {
    console.error("[CREATE_UNIT_ERROR]", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }

    return {
      success: false,
      error: "Gagal menambahkan satuan. Silakan coba lagi.",
    };
  }
}

// ==================== GET ALL UNITS ====================
export async function getUnits(params?: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  const session = await auth();
  requireMinimumRole(session, "ADMIN"); // SUPER_ADMIN & ADMIN
  try {
    const { search = "", page = 1, limit = 10 } = params || {};
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.UnitWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    // Get units with pagination
    const [units, total] = await Promise.all([
      prisma.unit.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              productUnits: true,
            },
          },
        },
      }),
      prisma.unit.count({ where }),
    ]);

    return {
      success: true,
      data: units,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_UNITS_ERROR]", error);
    return {
      success: false,
      error: "Gagal mengambil data satuan.",
      data: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
    };
  }
}

// ==================== GET UNIT BY ID ====================
export async function getUnitById(id: string) {
  const session = await auth();
  requireMinimumRole(session, "ADMIN");
  try {
    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            productUnits: true,
          },
        },
      },
    });

    if (!unit) {
      return {
        success: false,
        error: "Satuan tidak ditemukan.",
      };
    }

    return {
      success: true,
      data: unit,
    };
  } catch (error) {
    console.error("[GET_UNIT_BY_ID_ERROR]", error);
    return {
      success: false,
      error: "Gagal mengambil data satuan.",
    };
  }
}

// ==================== UPDATE UNIT ====================
export async function updateUnit(id: string, data: UnitFormData) {
  const session = await auth();
  requireMinimumRole(session, "ADMIN");
  try {
    // Validate input
    const validatedData = unitServerSchema.parse(data);

    // Check if unit exists
    const existingUnit = await prisma.unit.findUnique({
      where: { id },
    });

    if (!existingUnit) {
      return {
        success: false,
        error: "Satuan tidak ditemukan.",
      };
    }

    // Check duplicate name (exclude current unit)
    if (validatedData.name !== existingUnit.name) {
      const duplicateUnit = await prisma.unit.findUnique({
        where: { name: validatedData.name },
      });

      if (duplicateUnit) {
        return {
          success: false,
          error: `Satuan "${validatedData.name}" sudah ada!`,
        };
      }
    }

    // Update unit
    const unit = await prisma.unit.update({
      where: { id },
      data: validatedData,
    });

    revalidatePath("/dashboard/units");

    return {
      success: true,
      message: `Satuan "${unit.name}" berhasil diperbarui!`,
      data: unit,
    };
  } catch (error) {
    console.error("[UPDATE_UNIT_ERROR]", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }

    return {
      success: false,
      error: "Gagal memperbarui satuan. Silakan coba lagi.",
    };
  }
}

// ==================== DELETE UNIT ====================
export async function deleteUnit(id: string) {
  const session = await auth();
  requireMinimumRole(session, "ADMIN");
  try {
    // Check if unit exists and has relations
    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            productUnits: true,
            saleItemsUnit: true,
            purchaseItemsUnit: true,
          },
        },
      },
    });

    if (!unit) {
      return {
        success: false,
        error: "Satuan tidak ditemukan.",
      };
    }

    // Check if unit is being used
    const totalUsage =
      unit._count.productUnits +
      unit._count.saleItemsUnit +
      unit._count.purchaseItemsUnit;

    if (totalUsage > 0) {
      return {
        success: false,
        error: `Satuan "${unit.name}" tidak dapat dihapus karena sedang digunakan pada ${totalUsage} produk/transaksi.`,
      };
    }

    // Delete unit
    await prisma.unit.delete({
      where: { id },
    });

    revalidatePath("/dashboard/units");

    return {
      success: true,
      message: `Satuan "${unit.name}" berhasil dihapus!`,
    };
  } catch (error) {
    console.error("[DELETE_UNIT_ERROR]", error);
    return {
      success: false,
      error: "Gagal menghapus satuan. Silakan coba lagi.",
    };
  }
}

// ==================== GET UNITS FOR SELECT ====================
export async function getUnitsForSelect() {
  const session = await auth();
  requireMinimumRole(session, "ADMIN");
  try {
    const units = await prisma.unit.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      data: units,
    };
  } catch (error) {
    console.error("[GET_UNITS_FOR_SELECT_ERROR]", error);
    return {
      success: false,
      data: [],
    };
  }
}
