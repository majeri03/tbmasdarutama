"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireMinimumRole, type AuthSession } from "../utils/role";

// PKG-A (23 Nov 2026, perbaikan 7 item #5): CRUD penuh salesperson ("sales").
// Salesman dipilih per transaksi di POS (lihat listActiveSalesmen + API
// /api/salesmen?activeOnly=true), tercatat internal di Sale.salesmanId, dan
// TIDAK PERNAH dicetak di invoice/struk/surat jalan.
// Baca: KASIR+ (kasir butuh daftarnya di POS). Tulis: SUPER_ADMIN saja —
// sama seperti pengaturan poin di tab Sales (MANAGE_STORE_SETTINGS).

const salesmanSchema = z.object({
  name: z.string().trim().min(1, "Nama salesman wajib diisi").max(100, "Nama maksimal 100 karakter"),
  phone: z.string().trim().max(30, "Nomor telepon maksimal 30 karakter").optional().nullable(),
  isActive: z.boolean().optional(),
});

export type SalesmanInput = z.infer<typeof salesmanSchema>;

const salesmanSelect = {
  id: true,
  name: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { sales: true } },
} as const;

function serializeSalesman(s: {
  id: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { sales: number };
}) {
  return {
    id: s.id,
    name: s.name,
    phone: s.phone,
    isActive: s.isActive,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    salesCount: s._count.sales,
  };
}

//   GET ALL SALESMEN
export async function getSalesmen(
  filters?: { activeOnly?: boolean },
  externalSession?: AuthSession | null
) {
  const session = externalSession || (await auth());
  try {
    requireMinimumRole(session, "KASIR");
    const salesmen = await prisma.salesman.findMany({
      where: filters?.activeOnly ? { isActive: true } : {},
      select: salesmanSelect,
      orderBy: { name: "asc" },
    });
    return { success: true, data: salesmen.map(serializeSalesman) };
  } catch (error) {
    console.error("[GET_SALESMEN_ERROR]", error);
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Gagal mengambil data salesman." };
  }
}

//   GET ACTIVE SALESMEN (untuk dropdown POS — hanya yang aktif)
export async function listActiveSalesmen(externalSession?: AuthSession | null) {
  return getSalesmen({ activeOnly: true }, externalSession);
}

//   GET SALESMAN BY ID
export async function getSalesmanById(id: string, externalSession?: AuthSession | null) {
  const session = externalSession || (await auth());
  try {
    requireMinimumRole(session, "KASIR");
    const salesman = await prisma.salesman.findUnique({
      where: { id },
      select: salesmanSelect,
    });
    if (!salesman) {
      return { success: false, error: "Salesman tidak ditemukan." };
    }
    return { success: true, data: serializeSalesman(salesman) };
  } catch (error) {
    console.error("[GET_SALESMAN_ERROR]", error);
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Gagal mengambil data salesman." };
  }
}

//   CREATE SALESMAN
export async function createSalesman(data: SalesmanInput, externalSession?: AuthSession | null) {
  try {
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requireMinimumRole(session, "SUPER_ADMIN");
    const validated = salesmanSchema.parse(data);

    const salesman = await prisma.salesman.create({
      data: {
        name: validated.name,
        phone: validated.phone || null,
        isActive: validated.isActive ?? true,
      },
      select: salesmanSelect,
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/pos");

    return {
      success: true,
      data: serializeSalesman(salesman),
      message: `Salesman "${salesman.name}" berhasil ditambahkan!`,
    };
  } catch (error) {
    console.error("[CREATE_SALESMAN_ERROR]", error);
    return {
      success: false,
      error: "Gagal menambahkan salesman. Silakan coba lagi.",
    };
  }
}

//   UPDATE SALESMAN
export async function updateSalesman(id: string, data: SalesmanInput, externalSession?: AuthSession | null) {
  try {
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requireMinimumRole(session, "SUPER_ADMIN");
    const validated = salesmanSchema.parse(data);

    const existing = await prisma.salesman.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Salesman tidak ditemukan." };
    }

    const updated = await prisma.salesman.update({
      where: { id },
      data: {
        name: validated.name,
        phone: validated.phone || null,
        isActive: validated.isActive ?? existing.isActive,
      },
      select: salesmanSelect,
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/pos");

    return {
      success: true,
      data: serializeSalesman(updated),
      message: `Salesman "${updated.name}" berhasil diperbarui!`,
    };
  } catch (error) {
    console.error("[UPDATE_SALESMAN_ERROR]", error);
    return {
      success: false,
      error: "Gagal memperbarui salesman. Silakan coba lagi.",
    };
  }
}

//   DELETE SALESMAN
export async function deleteSalesman(id: string, externalSession?: AuthSession | null) {
  try {
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requireMinimumRole(session, "SUPER_ADMIN");

    const salesman = await prisma.salesman.findUnique({
      where: { id },
      include: { _count: { select: { sales: true } } },
    });
    if (!salesman) {
      return { success: false, error: "Salesman tidak ditemukan." };
    }

    if (salesman._count.sales > 0) {
      return {
        success: false,
        error: `Salesman "${salesman.name}" tidak dapat dihapus karena sudah tercatat di ${salesman._count.sales} transaksi penjualan. Gunakan fitur "Nonaktifkan" jika ingin menyembunyikannya dari POS.`,
      };
    }

    await prisma.salesman.delete({ where: { id } });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/pos");

    return {
      success: true,
      message: `Salesman "${salesman.name}" berhasil dihapus!`,
    };
  } catch (error) {
    console.error("[DELETE_SALESMAN_ERROR]", error);
    return {
      success: false,
      error: "Gagal menghapus salesman. Silakan coba lagi.",
    };
  }
}

//   TOGGLE ACTIVE STATUS
export async function toggleSalesmanStatus(id: string, externalSession?: AuthSession | null) {
  try {
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requireMinimumRole(session, "SUPER_ADMIN");

    const salesman = await prisma.salesman.findUnique({ where: { id } });
    if (!salesman) {
      return { success: false, error: "Salesman tidak ditemukan." };
    }

    const updated = await prisma.salesman.update({
      where: { id },
      data: { isActive: !salesman.isActive },
      select: salesmanSelect,
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/pos");

    return {
      success: true,
      data: serializeSalesman(updated),
      message: `Salesman "${updated.name}" berhasil ${
        updated.isActive ? "diaktifkan" : "dinonaktifkan"
      }!`,
    };
  } catch (error) {
    console.error("[TOGGLE_SALESMAN_STATUS_ERROR]", error);
    return {
      success: false,
      error: "Gagal mengubah status salesman.",
    };
  }
}
