"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireMinimumRole, type AuthSession } from "../utils/role";
import { calcSalesmanFee } from "../utils/salesman-fee";

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

function serializeSalesman(
  s: {
    id: string;
    name: string;
    phone: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    _count: { sales: number };
  },
  // WS-8 (25 Nov 2026): total per salesman — dihitung SERVER dengan rumus
  // yang SAMA seperti getSalesmanDetail (calcSalesmanFee, semua penjualan
  // apa pun statusnya), supaya angka di tabel daftar = angka di modal
  // detail. Ini BUKAN perubahan rumus fee; hanya supaya tabel bisa
  // menampilkan kolom Total Penjualan & Total Fee tanpa N+1 request
  // detail per baris. Kalau totals tidak disertakan (mis. getSalesmanById),
  // kedua field dihilangkan, bukan diisi 0.
  totals?: { totalSales: number; totalFee: number }
) {
  return {
    id: s.id,
    name: s.name,
    phone: s.phone,
    isActive: s.isActive,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    salesCount: s._count.sales,
    ...(totals ? { totalSales: totals.totalSales, totalFee: totals.totalFee } : {}),
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
    // WS-8 (25 Nov 2026): hitung total penjualan + total fee per salesman
    // di SERVER (satu query untuk semua penjualan yang punya salesman),
    // dengan calcSalesmanFee yang sama seperti getSalesmanDetail — jadi
    // total di daftar = total di modal detail. Rumus fee TIDAK berubah.
    const [setting, allSales] = await Promise.all([
      prisma.storeSetting.findFirst({
        select: { salesmanFeeEnabled: true, salesmanFeePercent: true },
      }),
      prisma.sale.findMany({
        where: { salesmanId: { not: null } },
        select: {
          salesmanId: true,
          grandTotal: true,
          salesmanFeeEnabled: true,
          salesmanFeePercent: true,
        },
      }),
    ]);
    const globalEnabled = setting?.salesmanFeeEnabled ?? false;
    const globalPercent = setting?.salesmanFeePercent ?? 2;
    const totalsBySalesman = new Map<string, { totalSales: number; totalFee: number }>();
    for (const s of allSales) {
      if (!s.salesmanId) continue;
      const grandTotal = Number(s.grandTotal);
      const fee = calcSalesmanFee(
        grandTotal,
        globalEnabled,
        globalPercent,
        s.salesmanFeeEnabled,
        s.salesmanFeePercent
      );
      const cur = totalsBySalesman.get(s.salesmanId) ?? { totalSales: 0, totalFee: 0 };
      cur.totalSales += grandTotal;
      cur.totalFee += fee.amount;
      totalsBySalesman.set(s.salesmanId, cur);
    }
    return {
      success: true,
      data: salesmen.map((s) =>
        serializeSalesman(s, totalsBySalesman.get(s.id) ?? { totalSales: 0, totalFee: 0 })
      ),
    };
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
    revalidatePath("/dashboard/salesmen");
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
    revalidatePath("/dashboard/salesmen");
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
    revalidatePath("/dashboard/salesmen");
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
    revalidatePath("/dashboard/salesmen");
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

// ============================================================================
// FEE SALESMAN (24 Nov 2026)
// Fee/komisi per invoice untuk salesman. Aturan (MASTER RULE):
// - Fee global MATI  -> fee semua invoice Rp0, apa pun pengaturan per invoice.
// - Fee global AKTIF -> fee = floor(grandTotal * persen / 100), hanya untuk
//   penjualan yang punya salesman.
// - Per invoice bisa menimpa global: salesmanFeeEnabled null = ikut global,
//   salesmanFeePercent null = ikut persen global.
// - Fee TIDAK PERNAH dicetak di invoice/struk/surat jalan (internal saja).
// - Ubah pengaturan fee (global maupun per invoice): SUPER_ADMIN saja,
//   dicek di server di setiap action. Baca detail + total: KASIR+.
// ============================================================================

export type SalesmanFeeSetting = {
  enabled: boolean;
  percent: number;
};

//   GET PENGATURAN FEE GLOBAL (baca: KASIR+)
export async function getSalesmanFeeSetting(externalSession?: AuthSession | null) {
  const session = externalSession || (await auth());
  try {
    requireMinimumRole(session, "KASIR");
    const setting = await prisma.storeSetting.findFirst({
      select: { salesmanFeeEnabled: true, salesmanFeePercent: true },
    });
    const data: SalesmanFeeSetting = {
      enabled: setting?.salesmanFeeEnabled ?? false,
      percent: setting?.salesmanFeePercent ?? 2,
    };
    return { success: true, data };
  } catch (error) {
    console.error("[GET_SALESMAN_FEE_SETTING_ERROR]", error);
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Gagal mengambil pengaturan fee salesman." };
  }
}

const feeSettingSchema = z.object({
  enabled: z.boolean(),
  percent: z
    .number()
    .int("Persen fee harus bilangan bulat")
    .min(0, "Persen fee minimal 0%")
    .max(100, "Persen fee maksimal 100%"),
});

//   UPDATE PENGATURAN FEE GLOBAL (tulis: SUPER_ADMIN saja)
export async function updateSalesmanFeeSetting(
  data: { enabled: boolean; percent: number },
  externalSession?: AuthSession | null
) {
  try {
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requireMinimumRole(session, "SUPER_ADMIN");
    const validated = feeSettingSchema.parse(data);

    const existing = await prisma.storeSetting.findFirst();
    if (existing) {
      await prisma.storeSetting.update({
        where: { id: existing.id },
        data: {
          salesmanFeeEnabled: validated.enabled,
          salesmanFeePercent: validated.percent,
        },
      });
    } else {
      await prisma.storeSetting.create({
        data: {
          salesmanFeeEnabled: validated.enabled,
          salesmanFeePercent: validated.percent,
        },
      });
    }

    revalidatePath("/dashboard/salesmen");

    return {
      success: true,
      data: { enabled: validated.enabled, percent: validated.percent },
      message: validated.enabled
        ? `Fee salesman diaktifkan: ${validated.percent}% per invoice.`
        : "Fee salesman dimatikan — semua invoice kini fee Rp0.",
    };
  } catch (error) {
    console.error("[UPDATE_SALESMAN_FEE_SETTING_ERROR]", error);
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "Gagal menyimpan pengaturan fee salesman. Silakan coba lagi.",
    };
  }
}

export type SalesmanDetailSaleRow = {
  id: string;
  invoiceNumber: string;
  saleDate: Date;
  customerName: string;
  grandTotal: number;
  status: string;
  feeEnabledOverride: boolean | null;
  feePercentOverride: number | null;
  feeEnabled: boolean;
  feePercent: number;
  feeAmount: number;
};

export type SalesmanDetail = {
  salesman: { id: string; name: string; phone: string | null; isActive: boolean };
  feeSetting: SalesmanFeeSetting;
  sales: SalesmanDetailSaleRow[];
  totalSales: number;
  totalFee: number;
  salesCount: number;
};

//   GET DETAIL SALESMAN + SEMUA PENJUALANNYA + TOTAL (baca: KASIR+)
// Total (totalSales, totalFee) dihitung di SERVER dari baris yang sama
// dengan yang dikirim ke halaman — angka yang tampil = angka server.
export async function getSalesmanDetail(id: string, externalSession?: AuthSession | null) {
  const session = externalSession || (await auth());
  try {
    requireMinimumRole(session, "KASIR");

    const [salesman, setting] = await Promise.all([
      prisma.salesman.findUnique({
        where: { id },
        select: { id: true, name: true, phone: true, isActive: true },
      }),
      prisma.storeSetting.findFirst({
        select: { salesmanFeeEnabled: true, salesmanFeePercent: true },
      }),
    ]);
    if (!salesman) {
      return { success: false, error: "Salesman tidak ditemukan." };
    }

    const globalEnabled = setting?.salesmanFeeEnabled ?? false;
    const globalPercent = setting?.salesmanFeePercent ?? 2;

    const sales = await prisma.sale.findMany({
      where: { salesmanId: id },
      select: {
        id: true,
        invoiceNumber: true,
        saleDate: true,
        grandTotal: true,
        status: true,
        salesmanFeeEnabled: true,
        salesmanFeePercent: true,
        customer: { select: { name: true } },
      },
      orderBy: { saleDate: "desc" },
    });

    const rows: SalesmanDetailSaleRow[] = sales.map((s) => {
      const grandTotal = Number(s.grandTotal);
      const fee = calcSalesmanFee(
        grandTotal,
        globalEnabled,
        globalPercent,
        s.salesmanFeeEnabled,
        s.salesmanFeePercent
      );
      return {
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        saleDate: s.saleDate,
        customerName: s.customer?.name ?? "Umum",
        grandTotal,
        status: s.status,
        feeEnabledOverride: s.salesmanFeeEnabled,
        feePercentOverride: s.salesmanFeePercent,
        feeEnabled: fee.enabled,
        feePercent: fee.percent,
        feeAmount: fee.amount,
      };
    });

    // Fee tetap dihitung per baris sesuai aturan (tanpa pengecualian status):
    // kalau ada penjualan CANCELLED/RETURN yang fee-nya harus Rp0, ubah di
    // sini — jangan di UI — supaya total server dan tampilan tetap sama.
    const data: SalesmanDetail = {
      salesman,
      feeSetting: { enabled: globalEnabled, percent: globalPercent },
      sales: rows,
      totalSales: rows.reduce((sum, r) => sum + r.grandTotal, 0),
      totalFee: rows.reduce((sum, r) => sum + r.feeAmount, 0),
      salesCount: rows.length,
    };
    return { success: true, data };
  } catch (error) {
    console.error("[GET_SALESMAN_DETAIL_ERROR]", error);
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Gagal mengambil detail salesman." };
  }
}

const saleFeeOverrideSchema = z.object({
  // null = ikut global (hapus override). Kalau tidak dikirim = tidak diubah.
  enabled: z.boolean().nullable().optional(),
  percent: z
    .number()
    .int("Persen fee harus bilangan bulat")
    .min(0, "Persen fee minimal 0%")
    .max(100, "Persen fee maksimal 100%")
    .nullable()
    .optional(),
});

//   UPDATE OVERRIDE FEE SATU INVOICE (tulis: SUPER_ADMIN saja)
// enabled null = ikut global, percent null = ikut persen global.
// Penjualan tanpa salesman ditolak — fee hanya ada kalau ada salesman.
export async function updateSaleFeeOverride(
  saleId: string,
  data: { enabled?: boolean | null; percent?: number | null },
  externalSession?: AuthSession | null
) {
  try {
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requireMinimumRole(session, "SUPER_ADMIN");
    const validated = saleFeeOverrideSchema.parse(data);

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      select: { id: true, invoiceNumber: true, salesmanId: true },
    });
    if (!sale) {
      return { success: false, error: "Penjualan tidak ditemukan." };
    }
    if (!sale.salesmanId) {
      return {
        success: false,
        error: `Invoice ${sale.invoiceNumber} tidak punya salesman, jadi tidak bisa diatur fee-nya.`,
      };
    }

    const updateData: { salesmanFeeEnabled?: boolean | null; salesmanFeePercent?: number | null } = {};
    if (validated.enabled !== undefined) updateData.salesmanFeeEnabled = validated.enabled;
    if (validated.percent !== undefined) updateData.salesmanFeePercent = validated.percent;
    if (Object.keys(updateData).length === 0) {
      return { success: false, error: "Tidak ada pengaturan fee yang diubah." };
    }

    await prisma.sale.update({ where: { id: saleId }, data: updateData });

    revalidatePath("/dashboard/salesmen");

    return {
      success: true,
      message: `Pengaturan fee invoice ${sale.invoiceNumber} berhasil disimpan.`,
    };
  } catch (error) {
    console.error("[UPDATE_SALE_FEE_OVERRIDE_ERROR]", error);
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "Gagal menyimpan pengaturan fee invoice. Silakan coba lagi.",
    };
  }
}
