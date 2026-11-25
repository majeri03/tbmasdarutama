"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireMinimumRole, requirePermission, type AuthSession } from "@/lib/utils/role";
import { auth } from "@/lib/auth";
const supplierServerSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  phone: z.string().min(1).max(20).trim(),
  email: z.string().email().trim().nullable().default(null),
  address: z.string().trim().nullable().default(null),
  city: z.string().trim().nullable().default(null),
  province: z.string().trim().nullable().default(null),
  description: z.string().trim().nullable().default(null),
  // PENTEST FIX (22 Nov 2026, L25): isActive DIHAPUS dari skema create/
  // update — status supplier hanya boleh diubah lewat toggleSupplierStatus
  // (jalur khusus). Sebelumnya pembuat/pengubah supplier bisa langsung
  // membuat supplier nonaktif atau menonaktifkannya via PUT.
});

export type SupplierFormData = z.infer<typeof supplierServerSchema>;

async function generateSupplierCode(): Promise<string> {
  // WS-F item 83 — format kanonik "SUP-001" (prisma/schema.prisma +
  // prisma/seed.sql: SUP-001, SUP-002). Dulu: orderBy code desc lalu
  // parseInt(code.split("-")[1]) tanpa guard — satu kode non-numerik /
  // tanpa "-" (mis. dari impor manual) membuat parseInt = NaN sehingga
  // kode berikutnya jadi "SUP-00NaN". Sekarang: pindai SEMUA kode SUP-,
  // ambil angka akhirnya, abaikan yang tidak bisa diparse (pola yang sama
  // seperti generateProductCode di product.actions.ts). Kode lama 5-digit
  // (SUP-00001) tetap terbaca nilai numeriknya, jadi penomoran berlanjut
  // dari angka terbesar yang ada, bukan dari urutan string.
  const suppliers = await prisma.supplier.findMany({
    where: { code: { startsWith: "SUP-" } },
    select: { code: true },
  });

  let maxNumber = 0;
  for (const supplier of suppliers) {
    const match = supplier.code.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!Number.isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  return `SUP-${String(maxNumber + 1).padStart(3, "0")}`;
}

// WS-F item 6 — statistik GLOBAL supplier (bukan dari baris halaman /
// filter saat ini). Dipakai halaman Master Supplier supaya kartu Aktif /
// Nonaktif / Total Produk / Total Pembelian tidak berubah saat pindah
// halaman atau memfilter.
export async function getSupplierStatistics() {
  const session = await auth();
  try {
    requirePermission(session, "VIEW_SUPPLIERS");
    const [total, active, inactive, totalProducts, totalPurchases] =
      await Promise.all([
        prisma.supplier.count(),
        prisma.supplier.count({ where: { isActive: true } }),
        prisma.supplier.count({ where: { isActive: false } }),
        // Jumlah produk yang punya supplier == jumlah _count.products
        // semua supplier (Product.supplierId opsional).
        prisma.product.count({ where: { supplierId: { not: null } } }),
        // Purchase.supplierId wajib diisi, jadi semua pembelian adalah
        // pembelian dari supplier.
        prisma.purchase.count(),
      ]);

    return {
      success: true,
      data: { total, active, inactive, totalProducts, totalPurchases },
    };
  } catch (error) {
    console.error("[GET_SUPPLIER_STATISTICS_ERROR]", error);
    return {
      success: false,
      error: "Gagal mengambil statistik supplier.",
      data: { total: 0, active: 0, inactive: 0, totalProducts: 0, totalPurchases: 0 },
    };
  }
}

export async function createSupplier(data: SupplierFormData) {
  const session = await auth();
  try {
    requireMinimumRole(session, "ADMIN");
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

export async function getSuppliers(
  params?: {
    search?: string;
    page?: number;
    limit?: number;
    isActive?: boolean | null;
  },
  externalSession?: AuthSession | null
) {
  const session = externalSession || (await auth());
  try {
    requirePermission(session, "VIEW_SUPPLIERS");
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

export async function getSupplierById(id: string) {
  const session = await auth();
  try {
    requireMinimumRole(session, "ADMIN");
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

export async function updateSupplier(id: string, data: SupplierFormData) {
  const session = await auth();
  try {
    requireMinimumRole(session, "ADMIN");
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

export async function deleteSupplier(id: string) {
  const session = await auth();
  try {
    requireMinimumRole(session, "ADMIN");
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

export async function toggleSupplierStatus(id: string) {
  const session = await auth();
  try {
    requireMinimumRole(session, "ADMIN");
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

export async function getSuppliersForSelect(externalSession?: AuthSession | null) {
  const session = externalSession || (await auth());
  try {
    requirePermission(session, "VIEW_SUPPLIERS");
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