"use server";

import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: verify current user password
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// GET STATISTICS: how much data is currently stored
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// HAPUS TRANSAKSI: Delete only SALES data
// Stok produk tidak direset — hanya data penjualan & turunannya dihapus
// ─────────────────────────────────────────────────────────────────────────────
export async function hapusSemuaTransaksiPenjualan(password: string) {
  try {
    await verifyCurrentUserPassword(password);

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

// ─────────────────────────────────────────────────────────────────────────────
// TUTUP BUKU TAHUNAN: Wipe ALL transactional data + reset stock to 0
// Ini adalah operasi year-end closing — data master tetap aman
// ─────────────────────────────────────────────────────────────────────────────
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
