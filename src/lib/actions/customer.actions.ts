"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  createCustomerSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from "@/lib/validations/customer.schema";
import { Prisma } from "@prisma/client";
import { requireMinimumRole, requirePermission, type AuthSession } from "../utils/role";

//GENERATE CUSTOMER CODE
async function generateCustomerCode(): Promise<string> {
  const lastCustomer = await prisma.customer.findFirst({
    orderBy: { code: "desc" },
    select: { code: true },
  });

  if (!lastCustomer) {
    return "CUST-00001";
  }

  const lastNumber = parseInt(lastCustomer.code.split("-")[1]);
  const newNumber = lastNumber + 1;
  return `CUST-${newNumber.toString().padStart(5, "0")}`;
}

//   CREATE CUSTOMER  
export async function createCustomer(data: CreateCustomerInput, externalSession?: AuthSession | null) {
  try {
    // FIX PENTEST (22 Nov 2026, M18): sesi dari route (Bearer mobile).
    const session = externalSession || (await auth());

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requireMinimumRole(session, "KASIR");
    // Validate input
    const validatedData = createCustomerSchema.parse(data);

    // PKG-A (23 Nov 2026, perbaikan 7 item #7): hanya SATU customer UMUM
    // yang boleh ada di toko (dipakai POS untuk penjualan cepat).
    if (validatedData.type === "UMUM") {
      const existingUmum = await prisma.customer.findFirst({
        where: { type: "UMUM" },
        select: { id: true, name: true, code: true },
      });
      if (existingUmum) {
        return {
          success: false,
          error: `Customer UMUM sudah ada ("${existingUmum.name}" ${existingUmum.code}). Hanya satu customer Umum yang boleh ada.`,
        };
      }
    }

    // Check duplicate name
    const existingCustomer = await prisma.customer.findFirst({
      where: { name: { equals: validatedData.name, mode: "insensitive" } },
    });

    if (existingCustomer) {
      return {
        success: false,
        error: `Customer dengan nama "${validatedData.name}" sudah ada.`,
      };
    }

    // Generate customer code
    const code = await generateCustomerCode();

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        code,
        name: validatedData.name,
        phone: validatedData.phone || null,
        email: validatedData.email || null,
        address: validatedData.address || null,
        city: validatedData.city || null,
        province: validatedData.province || null,
        type: validatedData.type,
      },
    });

    revalidatePath("/dashboard/customers");

    return {
      success: true,
      data: customer,
      message: `Customer "${customer.name}" (${customer.code}) berhasil ditambahkan!`,
    };
  } catch (error) {
    console.error("[CREATE_CUSTOMER_ERROR]", error);

    // FIX PENTEST (22 Nov 2026, L24): jangan teruskan error.message mentah
    // (bisa berisi pesan Prisma/Zod) ke klien — pakai pesan generik.
    return {
      success: false,
      error: "Gagal menambahkan customer. Silakan coba lagi.",
    };
  }
}

//   UPDATE CUSTOMER  
export async function updateCustomer(id: string, data: UpdateCustomerInput, externalSession?: AuthSession | null) {
  try {
    // FIX PENTEST (22 Nov 2026, M18): sesi dari route (Bearer mobile).
    const session = externalSession || (await auth());

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    // FIX PENTEST (22 Nov 2026, M24): EDIT_CUSTOMER (KASIR+) — konsisten
    // dengan route dan PERMISSIONS. Sebelumnya ADMIN saja di action
    // sementara route bilang KASIR boleh.
    requirePermission(session, "EDIT_CUSTOMER");
    // Validate input
    const validatedData = updateCustomerSchema.parse(data);

    // Check if customer exists
    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return { success: false, error: "Customer tidak ditemukan." };
    }

    // PKG-A (23 Nov 2026, perbaikan 7 item #7): hanya SATU customer UMUM.
    // Mengubah customer lain menjadi UMUM ditolak kalau UMUM sudah ada;
    // mengubah si UMUM itu sendiri tetap boleh.
    if (validatedData.type === "UMUM" && customer.type !== "UMUM") {
      const existingUmum = await prisma.customer.findFirst({
        where: { type: "UMUM", id: { not: id } },
        select: { id: true, name: true, code: true },
      });
      if (existingUmum) {
        return {
          success: false,
          error: `Customer UMUM sudah ada ("${existingUmum.name}" ${existingUmum.code}). Hanya satu customer Umum yang boleh ada.`,
        };
      }
    }

    // Check duplicate name (exclude current customer)
    if (validatedData.name) {
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          name: { equals: validatedData.name, mode: "insensitive" },
          id: { not: id },
        },
      });

      if (existingCustomer) {
        return {
          success: false,
          error: `Customer dengan nama "${validatedData.name}" sudah ada.`,
        };
      }
    }

    // Update customer
    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        name: validatedData.name,
        phone: validatedData.phone || null,
        email: validatedData.email || null,
        address: validatedData.address || null,
        city: validatedData.city || null,
        province: validatedData.province || null,
        type: validatedData.type,
      },
    });

    revalidatePath("/dashboard/customers");

    return {
      success: true,
      message: `Customer "${updatedCustomer.name}" berhasil diperbarui!`,
    };
  } catch (error) {
    console.error("[UPDATE_CUSTOMER_ERROR]", error);

    // FIX PENTEST (22 Nov 2026, L24): jangan teruskan error.message mentah
    // (bisa berisi pesan Prisma/Zod) ke klien — pakai pesan generik.
    return {
      success: false,
      error: "Gagal memperbarui customer. Silakan coba lagi.",
    };
  }
}

//   DELETE CUSTOMER  
export async function deleteCustomer(id: string, externalSession?: AuthSession | null) {
  try {
    // FIX PENTEST (22 Nov 2026, M18): sesi dari route (Bearer mobile).
    const session = externalSession || (await auth());

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    // FIX PENTEST (22 Nov 2026, M24): DELETE_CUSTOMER (ADMIN+) — konsisten
    // dengan route dan PERMISSIONS.
    requirePermission(session, "DELETE_CUSTOMER");
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            sales: true,
            customerDebts: true,
            deliveryOrders: true,
          },
        },
      },
    });

    if (!customer) {
      return { success: false, error: "Customer tidak ditemukan." };
    }

    if (customer._count.sales > 0) {
      return {
        success: false,
        error: `Customer "${customer.name}" tidak dapat dihapus karena memiliki ${customer._count.sales} transaksi penjualan. Gunakan fitur "Nonaktifkan" jika ingin menyembunyikan customer ini.`,
      };
    }

    if (customer._count.customerDebts > 0) {
      return {
        success: false,
        error: `Customer "${customer.name}" tidak dapat dihapus karena memiliki data utang. Selesaikan utang terlebih dahulu.`,
      };
    }

    // FIX PENTEST (22 Nov 2026, L24): sebelumnya hanya sale + utang yang
    // dicek — customer yang masih punya Surat Jalan juga tidak boleh dihapus
    // (menghindari DO yatim tanpa customer).
    if (customer._count.deliveryOrders > 0) {
      return {
        success: false,
        error: `Customer "${customer.name}" tidak dapat dihapus karena memiliki ${customer._count.deliveryOrders} Surat Jalan. Hapus Surat Jalan terkait terlebih dahulu.`,
      };
    }

    // Delete customer
    await prisma.customer.delete({
      where: { id },
    });

    revalidatePath("/dashboard/customers");

    return {
      success: true,
      message: `Customer "${customer.name}" (${customer.code}) berhasil dihapus!`,
    };
  } catch (error) {
    console.error("[DELETE_CUSTOMER_ERROR]", error);

    // FIX PENTEST (22 Nov 2026, L24): jangan teruskan error.message mentah
    // (bisa berisi pesan Prisma/Zod) ke klien — pakai pesan generik.
    return {
      success: false,
      error: "Gagal menghapus customer. Silakan coba lagi.",
    };
  }
}

//   TOGGLE ACTIVE STATUS  
export async function toggleCustomerStatus(id: string, externalSession?: AuthSession | null) {
  try {
    // FIX PENTEST (22 Nov 2026, M18): sesi dari route (Bearer mobile).
    const session = externalSession || (await auth());

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requireMinimumRole(session, "ADMIN");
    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return { success: false, error: "Customer tidak ditemukan." };
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: { isActive: !customer.isActive },
    });

    revalidatePath("/dashboard/customers");

    return {
      success: true,
      message: `Customer "${updatedCustomer.name}" berhasil ${
        updatedCustomer.isActive ? "diaktifkan" : "dinonaktifkan"
      }!`,
    };
  } catch (error) {
    console.error("[TOGGLE_CUSTOMER_STATUS_ERROR]", error);
    return {
      success: false,
      error: "Gagal mengubah status customer.",
    };
  }
}
//   GET ALL CUSTOMERS  
export async function getCustomers(filters?: { status?: "ACTIVE" | "INACTIVE" }, externalSession?: AuthSession | null) {
  const session = externalSession || (await auth());
  try {
    // FIX PENTEST (22 Nov 2026, L27): requireMinimumRole dipindah ke DALAM
    // try supaya kegagalan auth tidak lolos sebagai 500 generik.
    requireMinimumRole(session, "KASIR"); // All roles can view
    const where: Prisma.CustomerWhereInput = {};

    if (filters?.status === "ACTIVE") {
      where.isActive = true;
    } else if (filters?.status === "INACTIVE") {
      where.isActive = false;
    }

    const customers = await prisma.customer.findMany({
      where,
      take: 200,
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        province: true,
        type: true,
        // PKG-A (23 Nov 2026, perbaikan 7 item #6): poin loyalitas customer.
        points: true,
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return { success: true, data: customers };
  } catch (error) {
    console.error("[GET_CUSTOMERS_ERROR]", error);
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "Gagal mengambil data customer.",
    };
  }
}

//   ENSURE UMUM CUSTOMER (PKG-A, perbaikan 7 item #7)
//   Ambil SATU-SATUNYA customer UMUM; kalau belum ada, buat baru
//   (nama "Umum", kode berikutnya dari generateCustomerCode).
//   Dipanggil dari jalur createSale (sale.actions.ts) dan dari
//   getPOSCustomers (pos.actions.ts — lihat NOTES paket ini) supaya POS
//   selalu punya satu customer Umum untuk penjualan cepat.
//   Umum TIDAK bisa utang (CREDIT diblokir validatePaymentAndChange) dan
//   TIDAK dapat poin.
export async function ensureUmumCustomer(externalSession?: AuthSession | null) {
  const session = externalSession || (await auth());
  try {
    requireMinimumRole(session, "KASIR");
    const umum = await prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findFirst({
        where: { type: "UMUM" },
      });
      if (existing) return existing;
      const code = await generateCustomerCode();
      return tx.customer.create({
        data: {
          code,
          name: "Umum",
          type: "UMUM",
          isActive: true,
        },
      });
    });
    return { success: true, data: umum };
  } catch (error) {
    console.error("[ENSURE_UMUM_CUSTOMER_ERROR]", error);
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "Gagal menyiapkan customer Umum.",
    };
  }
}

//   ADJUST CUSTOMER POINTS (PKG-A, perbaikan 7 item #6)
//   Dukungan server-side untuk penyesuaian poin manual oleh SUPER_ADMIN
//   (UI-nya paket lain). delta boleh positif (tambah) atau negatif
//   (kurang); hasil akhir tidak pernah di bawah 0. Customer UMUM tidak
//   punya poin — penyesuaiannya ditolak.
export async function adjustCustomerPoints(
  customerId: string,
  delta: number,
  externalSession?: AuthSession | null
) {
  try {
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requireMinimumRole(session, "SUPER_ADMIN");

    if (!Number.isInteger(delta) || delta === 0) {
      return { success: false, error: "Jumlah penyesuaian poin harus bilangan bulat bukan nol." };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: { id: true, name: true, type: true, points: true },
      });
      if (!customer) {
        throw new Error("Customer tidak ditemukan.");
      }
      if (customer.type === "UMUM") {
        throw new Error("Customer Umum tidak memiliki poin.");
      }
      const nextPoints = Math.max(0, customer.points + delta);
      return tx.customer.update({
        where: { id: customerId },
        data: { points: nextPoints },
        select: { id: true, name: true, type: true, points: true },
      });
    });

    revalidatePath("/dashboard/customers");

    return {
      success: true,
      data: updated,
      message: `Poin customer "${updated.name}" sekarang ${updated.points}.`,
    };
  } catch (error) {
    console.error("[ADJUST_CUSTOMER_POINTS_ERROR]", error);
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal menyesuaikan poin customer.",
    };
  }
}
