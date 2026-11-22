"use server";

import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import {
  deleteR2FilesByKeys,
  extractTagKeys,
} from "@/lib/utils/r2-tracking";
import { extractR2Filename } from "@/lib/utils/storage";

// FIX (22 Nov 2026, R2): hapus massal dulu menciptakan ratusan file yatim
// sekaligus (deleteMany tanpa sentuh R2). Kumpulkan SEMUA key R2 milik data
// transaksional SEBELUM transaksi hapus jalan, lalu hapus dari R2 setelah
// transaksi berhasil.
async function collectTransactionalR2Keys(): Promise<string[]> {
  const [sales, dos, photos, payments] = await Promise.all([
    prisma.sale.findMany({ select: { notes: true } }),
    prisma.deliveryOrder.findMany({ select: { proofImage: true, notes: true } }),
    prisma.deliveryPhoto.findMany({ select: { filename: true, url: true } }),
    prisma.debtPayment.findMany({ select: { notes: true } }),
  ]);
  const keys: string[] = [];
  for (const s of sales) keys.push(...extractTagKeys(s.notes, ["BUKTI_TF"]));
  for (const d of dos) {
    const pk = extractR2Filename(d.proofImage);
    if (pk) keys.push(pk);
    keys.push(...extractTagKeys(d.notes, ["BUKTI_KIRIM", "FOTO_LOKASI"]));
  }
  for (const p of photos) {
    const k = extractR2Filename(p.filename || p.url);
    if (k) keys.push(k);
  }
  for (const p of payments) keys.push(...extractTagKeys(p.notes, ["BUKTI_TF"]));
  return Array.from(new Set(keys));
}

// Helper: verify current user password
async function verifyCurrentUserPassword(password: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.id) throw new Error("Sesi tidak valid. Silakan login ulang.");

  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: { password: true, role: true },
  });

  if (!user) throw new Error("User tidak ditemukan.");
  if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
    throw new Error("Akses ditolak. Hanya Admin / Super Admin yang dapat melakukan operasi ini.");
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error("Password salah. Operasi dibatalkan.");

  return user;
}

// GET STATISTICS: how much data is currently stored
export async function getDataStatistics() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.id) return { success: false, error: "Unauthorized" };

    const [
      sales,
      purchases,
      deliveryOrders,
      customerDebts,
      supplierDebts,
      stockMovements,
      cashMovements,
    ] = await Promise.all([
      prisma.sale.count(),
      prisma.purchase.count(),
      prisma.deliveryOrder.count(),
      prisma.customerDebt.count(),
      prisma.supplierDebt.count(),
      prisma.stockMovement.count(),
      prisma.cashMovement.count(),
    ]);

    return {
      success: true,
      data: {
        sales,
        purchases,
        deliveryOrders,
        customerDebts,
        supplierDebts,
        stockMovements,
        cashMovements,
        total: sales + purchases + deliveryOrders + customerDebts + supplierDebts + stockMovements + cashMovements,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Gagal mengambil statistik" };
  }
}

// HAPUS TRANSAKSI: Delete only SALES data
// Stok produk tidak direset — hanya data penjualan & turunannya dihapus
export async function hapusSemuaTransaksiPenjualan(password: string) {
  try {
    await verifyCurrentUserPassword(password);

    // Kumpulkan key R2 dulu — setelah deleteMany, jejak URL-nya hilang.
    const r2Keys = await collectTransactionalR2Keys();

    const result = await prisma.$transaction(async (tx) => {
      const debtPayments   = await tx.debtPayment.deleteMany();
      const customerDebts  = await tx.customerDebt.deleteMany();
      const deliveryItems  = await tx.deliveryItem.deleteMany();
      const deliveryOrders = await tx.deliveryOrder.deleteMany();
      const saleItems      = await tx.saleItem.deleteMany();
      const sales          = await tx.sale.deleteMany();
      // Bersihkan semua riwayat gerak stok (tidak relevan jika data penjualan sudah dihapus)
      const stockMovements = await tx.stockMovement.deleteMany();

      return {
        debtPayments: debtPayments.count,
        customerDebts: customerDebts.count,
        deliveryOrders: deliveryOrders.count,
        saleItems: saleItems.count,
        sales: sales.count,
        stockMovements: stockMovements.count,
      };
    });

    // Hapus file R2 milik data yang baru dihapus (tidak menahan respon).
    if (r2Keys.length > 0) {
      void deleteR2FilesByKeys(r2Keys).catch((e) =>
        console.warn("[R2_BULK_DELETE_WARN]", e)
      );
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/customer-debts");
    revalidatePath("/dashboard/delivery-orders");

    return {
      success: true,
      message: `Berhasil menghapus ${result.sales} penjualan, ${result.customerDebts} utang pelanggan, dan ${result.deliveryOrders} surat jalan.`,
      detail: result,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Operasi gagal" };
  }
}

// TUTUP BUKU TAHUNAN: Wipe ALL transactional data + reset stock to 0
// Ini adalah operasi year-end closing — data master tetap aman
export async function tutupBukuTahunan(password: string, tahun: number) {
  try {
    await verifyCurrentUserPassword(password);

    const currentYear = new Date().getFullYear();
    if (tahun !== currentYear && tahun !== currentYear - 1) {
      return {
        success: false,
        error: `Tahun tutup buku tidak valid. Hanya bisa untuk tahun ${currentYear - 1} atau ${currentYear}.`,
      };
    }

    // Kumpulkan key R2 dulu — setelah deleteMany, jejak URL-nya hilang.
    const r2Keys = await collectTransactionalR2Keys();

    const result = await prisma.$transaction(async (tx) => {
      // Hapus semua data transaksional dalam urutan yang benar (respecting foreign keys)
      const debtPayments   = await tx.debtPayment.deleteMany();
      const customerDebts  = await tx.customerDebt.deleteMany();
      const supplierDebts  = await tx.supplierDebt.deleteMany();
      const deliveryItems  = await tx.deliveryItem.deleteMany();
      const deliveryOrders = await tx.deliveryOrder.deleteMany();
      const saleItems      = await tx.saleItem.deleteMany();
      const sales          = await tx.sale.deleteMany();
      const purchaseItems  = await tx.purchaseItem.deleteMany();
      const purchases      = await tx.purchase.deleteMany();
      const stockMovements = await tx.stockMovement.deleteMany();
      const cashMovements  = await tx.cashMovement.deleteMany();
      await tx.passwordResetToken.deleteMany();

      // Reset stok semua produk ke 0
      const resetStock = await tx.product.updateMany({ data: { currentStock: 0 } });

      return {
        debtPayments: debtPayments.count,
        customerDebts: customerDebts.count,
        supplierDebts: supplierDebts.count,
        deliveryOrders: deliveryOrders.count,
        saleItems: saleItems.count,
        sales: sales.count,
        purchaseItems: purchaseItems.count,
        purchases: purchases.count,
        stockMovements: stockMovements.count,
        cashMovements: cashMovements.count,
        resetProducts: resetStock.count,
      };
    });

    // Hapus file R2 milik data yang baru dihapus (tidak menahan respon).
    if (r2Keys.length > 0) {
      void deleteR2FilesByKeys(r2Keys).catch((e) =>
        console.warn("[R2_BULK_DELETE_WARN]", e)
      );
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/purchases");
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/stocks");
    revalidatePath("/dashboard/customer-debts");
    revalidatePath("/dashboard/supplier-debts");
    revalidatePath("/dashboard/delivery-orders");

    return {
      success: true,
      message: `Tutup buku tahun ${tahun} berhasil! Semua data transaksi telah dihapus dan stok ${result.resetProducts} produk direset ke 0.`,
      detail: result,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Operasi tutup buku gagal" };
  }
}
