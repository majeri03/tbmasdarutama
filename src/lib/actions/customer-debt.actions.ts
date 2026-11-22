"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { DebtStatus, Prisma } from "@prisma/client";
import { addPaymentSchema, AddPaymentInput } from "@/lib/validations/customer-debt.schema";
import { requirePermission, requireMinimumRole, hasMinimumRole, type AuthSession } from "@/lib/utils/role";
import { withUniqueRetry } from "@/lib/utils/stock-units";

//GET ALL CUSTOMER DEBTS
export async function getAllCustomerDebts(filters?: {
  search?: string;
  customerId?: string;
  status?: DebtStatus;
  dateFrom?: Date;
  dateTo?: Date;
  // FIX (22 Nov 2026): paginasi — sebelumnya seluruh tabel dikembalikan.
  page?: number;
  limit?: number;
}, externalSession?: AuthSession | null) {
  const session = externalSession || (await auth());
  try {
    // FIX PENTEST (22 Nov 2026, L27): requirePermission dipindah ke DALAM
    // try supaya kegagalan auth tidak lolos sebagai 500 generik.
    requirePermission(session, "VIEW_CUSTOMER_DEBTS");
    // KEPUTUSAN PEMILIK (22 Nov 2026, pentest H6 — BY-DESIGN): KASIR BOLEH
    // membaca semua piutang customer (butuh untuk menerima pembayaran).
    const where: Prisma.CustomerDebtWhereInput = {};

    if (filters?.search) {
      where.OR = [
        { debtNumber: { contains: filters.search, mode: "insensitive" } },
        { customer: { name: { contains: filters.search, mode: "insensitive" } } },
        { sale: { invoiceNumber: { contains: filters.search, mode: "insensitive" } } },
      ];
    }

    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    // Default 50 baris terbaru (dashboard web tidak punya pager UI);
    // API bisa minta page/limit eksplisit. Maksimal 100 per halaman.
    const page = Math.max(1, Math.floor(filters?.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Math.floor(filters?.limit ?? 50) || 50));
    const skip = (page - 1) * limit;

    const [debts, total] = await Promise.all([
      prisma.customerDebt.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            name: true,
            phone: true,
          },
        },
        sale: {
          select: {
            id: true,
            invoiceNumber: true,
            saleDate: true,
            grandTotal: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip,
    }),
      prisma.customerDebt.count({ where }),
    ]);

    // Get payment counts separately
    const debtsWithPayments = await Promise.all(
      debts.map(async (debt) => {
        const payments = await prisma.debtPayment.findMany({
          where: { customerDebtId: debt.id },
          include: {
            admin: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            paymentDate: "desc",
          },
        });

        return {
          ...debt,
          payments,
          _count: {
            payments: payments.length,
          },
        };
      })
    );

    const serializedDebts = debtsWithPayments.map((debt) => ({
      ...debt,
      totalDebt: Number(debt.totalDebt),
      paidAmount: Number(debt.paidAmount),
      remainingDebt: Number(debt.remainingDebt),
      sale: {
        ...debt.sale,
        grandTotal: Number(debt.sale.grandTotal),
      },
      payments: debt.payments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
      })),
    }));

    return {
      success: true,
      data: serializedDebts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("Error fetching customer debts:", error);
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to fetch customer debts" };
  }
}

//GET CUSTOMER DEBT STATISTICS
export async function getCustomerDebtStatistics() {
  const session = await auth();
  try {
    // FIX PENTEST (22 Nov 2026, L27): requirePermission dipindah ke DALAM
    // try supaya kegagalan auth tidak lolos sebagai 500 generik.
    requirePermission(session, "VIEW_CUSTOMER_DEBTS");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [activeDebts, overdueCount, paidThisMonth, totalActive] = await Promise.all([
      prisma.customerDebt.count({
        where: {
          status: { in: [DebtStatus.UNPAID, DebtStatus.PARTIAL] },
        },
      }),
      prisma.customerDebt.count({
        where: {
          status: DebtStatus.OVERDUE,
        },
      }),
      prisma.debtPayment.aggregate({
        _sum: { amount: true },
        where: {
          customerDebtId: { not: null },
          paymentDate: { gte: firstDayOfMonth },
        },
      }),
      prisma.customerDebt.aggregate({
        _sum: { remainingDebt: true },
        where: {
          status: { in: [DebtStatus.UNPAID, DebtStatus.PARTIAL, DebtStatus.OVERDUE] },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        activeDebts,
        overdueCount,
        paidThisMonth: Number(paidThisMonth._sum.amount || 0),
        totalActive: Number(totalActive._sum.remainingDebt || 0),
      },
    };
  } catch (error) {
    console.error("Error fetching customer debt statistics:", error);
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to fetch statistics" };
  }
}

//GET CUSTOMER DEBT BY ID
export async function getCustomerDebtById(id: string, externalSession?: AuthSession | null) {
  const session = externalSession || (await auth());
  try {
    // FIX PENTEST (22 Nov 2026, L27): requirePermission dipindah ke DALAM
    // try supaya kegagalan auth tidak lolos sebagai 500 generik.
    requirePermission(session, "VIEW_CUSTOMER_DEBTS");
    const debt = await prisma.customerDebt.findUnique({
      where: { id },
      include: {
        customer: true,
        sale: {
          include: {
            saleItems: {
              include: {
                product: true,
                unit: true,
              },
            },
          },
        },
      },
    });

    if (!debt) {
      return { success: false, error: "Debt not found" };
    }

    const payments = await prisma.debtPayment.findMany({
      where: { customerDebtId: id },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        paymentDate: "desc",
      },
    });

    const serializedDebt = {
      ...debt,
      totalDebt: Number(debt.totalDebt),
      paidAmount: Number(debt.paidAmount),
      remainingDebt: Number(debt.remainingDebt),
      sale: {
        ...debt.sale,
        totalAmount: Number(debt.sale.totalAmount),
        discount: Number(debt.sale.discount),
        tax: Number(debt.sale.tax),
        grandTotal: Number(debt.sale.grandTotal),
        paidAmount: Number(debt.sale.paidAmount),
        changeAmount: Number(debt.sale.changeAmount),
        saleItems: debt.sale.saleItems.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount),
          subtotal: Number(item.subtotal),
        })),
      },
      payments: payments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
      })),
    };

    return { success: true, data: serializedDebt };
  } catch (error) {
    console.error("Error fetching customer debt:", error);
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to fetch debt" };
  }
}

//ADD PAYMENT
export async function addCustomerDebtPayment(input: AddPaymentInput, externalSession?: AuthSession | null) {
  try {
    // FIX PENTEST (22 Nov 2026, M18): sesi dari route (Bearer mobile).
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "MANAGE_CUSTOMER_DEBTS");
    // FIX BUILD (22 Nov 2026, z3): id disimpan ke const di sini — di dalam
    // callback transaksi, TypeScript melupakan hasil cek session.user di
    // atas, jadi pemakaian session.user.id langsung selalu error.
    const userId = session.user.id;

    const validated = addPaymentSchema.parse(input);

    // 1. Ambil Data Hutang
    const debt = await prisma.customerDebt.findUnique({
      where: { id: validated.debtId },
      include: { sale: true }, // Kita butuh ini untuk update Sale nanti
    });
    
    if (!debt) {
      return { success: false, error: "Debt not found" };
    }
    if (validated.amount > Number(debt.remainingDebt)) {
      return {
        success: false,
        error: `Payment amount exceeds remaining debt (${debt.remainingDebt})`,
      };
    }
    if (debt.status === DebtStatus.PAID) {
      return { success: false, error: "Debt already paid" };
    }

    // M-15 FIX (Nov 2026): angka-angka di atas hanya cek awal (UX). Cek yang
    // menentukan ada DI DALAM transaksi di bawah: update kondisional dengan
    // increment/decrement atomik. Sebelumnya total dihitung dari bacaan di
    // luar transaksi lalu ditimpa absolut — dua pembayaran bersamaan untuk
    // sisa Rp1jt (masing-masing Rp600rb) sama-sama lolos dan hutang tercatat
    // sisa Rp400rb padahal total bayar Rp1,2jt.

    // 2. TRANSAKSI DATABASE (Update Debt + Payment + SALE)
    const result = await withUniqueRetry(() => prisma.$transaction(async (tx) => {
      // A. Potong sisa hutang secara atomik. Update ini hanya berhasil kalau
      // hutang belum lunas DAN sisa hutang >= jumlah bayar. Kalau dua
      // pembayaran bersamaan, hanya satu yang lolos — yang kedua gagal di
      // sini (bukan setelah payment tercatat).
      const claimed = await tx.customerDebt.updateMany({
        where: {
          id: validated.debtId,
          status: { not: DebtStatus.PAID },
          remainingDebt: { gte: validated.amount },
        },
        data: {
          paidAmount: { increment: validated.amount },
          remainingDebt: { decrement: validated.amount },
        },
      });
      if (claimed.count === 0) {
        throw new Error("Payment amount exceeds remaining debt or debt already paid");
      }

      // B. Baca sisa terbaru (di dalam transaksi) untuk menentukan status.
      const freshDebt = await tx.customerDebt.findUnique({
        where: { id: validated.debtId },
        include: { customer: true },
      });
      if (!freshDebt) throw new Error("Debt not found");
      const newRemainingDebt = Number(freshDebt.remainingDebt);
      const newStatus = newRemainingDebt === 0 ? DebtStatus.PAID : DebtStatus.PARTIAL;
      const updatedDebt = await tx.customerDebt.update({
        where: { id: validated.debtId },
        data: { status: newStatus },
        include: { customer: true },
      });

      // Nomor dari pembayaran terakhir (urut waktu), bukan count()+1 —
      // dua kasir bayar bersamaan dulu bisa dapat nomor sama lalu satu gagal.
      const lastPayment = await tx.debtPayment.findFirst({
        orderBy: { createdAt: "desc" },
        select: { paymentNumber: true },
      });
      const lastNum = lastPayment ? parseInt(lastPayment.paymentNumber.replace(/\D/g, "")) : 0;
      const paymentNumber = `PAY-${String((Number.isFinite(lastNum) ? lastNum : 0) + 1).padStart(6, "0")}`;

      // C. Buat History Pembayaran
      const payment = await tx.debtPayment.create({
        data: {
          paymentNumber,
          customerDebtId: validated.debtId,
          amount: validated.amount,
          paymentMethod: validated.paymentMethod,
          paymentDate: validated.paymentDate,
          notes: validated.notes,
          adminId: userId, // Sesuaikan dengan field Anda (adminId/createdById)
        },
      });

      // D. Update Data Penjualan (Sale)
      // Agar status di menu 'Penjualan' ikut berubah jadi Lunas/Partial
      if (debt.saleId) {
        // Tentukan status baru untuk Sale berdasarkan pelunasan hutang
        // Jika Hutang Lunas (PAID) -> Sale jadi COMPLETED
        // Jika Masih Nyicil (PARTIAL) -> Sale tetap PENDING (atau biarkan status lama)
        const saleUpdateData: Prisma.SaleUpdateInput = {
          paidAmount: { increment: validated.amount },
        };

        // Jika hutang sudah lunas total, kita tandai Sale sebagai COMPLETED
        if (newStatus === DebtStatus.PAID) {
          saleUpdateData.status = "COMPLETED";
        }

        await tx.sale.update({
          where: { id: debt.saleId },
          data: saleUpdateData,
        });
      }

      return { payment, debt: updatedDebt };
    }));

    revalidatePath("/dashboard/customer-debts");
    revalidatePath("/dashboard/sales"); // Refresh halaman sales agar angka berubah

    return {
      success: true,
      message: `Payment of Rp ${validated.amount.toLocaleString()} recorded successfully`,
      data: {
        ...result.debt,
        totalDebt: Number(result.debt.totalDebt),
        paidAmount: Number(result.debt.paidAmount),
        remainingDebt: Number(result.debt.remainingDebt),
      },
    };
  } catch (error) {
    console.error("Error adding payment:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to add payment" };
  }
}

//DELETE CUSTOMER DEBT
export async function deleteCustomerDebt(id: string, externalSession?: AuthSession | null) {
  try {
    // FIX PENTEST (22 Nov 2026, M18): sesi dari route (Bearer mobile).
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    requirePermission(session, "MANAGE_CUSTOMER_DEBTS");
    if (session.user.role === "KASIR") {
      return { success: false, error: "Kasir tidak memiliki akses untuk hapus debt" };
    }

    const debt = await prisma.customerDebt.findUnique({
      where: { id },
    });

    if (!debt) {
      return { success: false, error: "Debt not found" };
    }

    const paymentCount = await prisma.debtPayment.count({
      where: { customerDebtId: id },
    });

    if (paymentCount > 0) {
      return { success: false, error: "Cannot delete debt with payment history" };
    }

    if (debt.status === DebtStatus.PAID) {
      return { success: false, error: "Cannot delete paid debt" };
    }

    await prisma.customerDebt.delete({
      where: { id },
    });

    revalidatePath("/dashboard/customer-debts");

    return {
      success: true,
      message: `Debt ${debt.debtNumber} deleted successfully`,
    };
  } catch (error) {
    console.error("Error deleting debt:", error);
    return { success: false, error: "Failed to delete debt" };
  }
}

//UPDATE OVERDUE STATUS (Cron Job Helper)
export async function updateOverdueDebts() {
  const session = await auth();
  // M-24 FIX (Nov 2026): sebelumnya requireMinimumRole("ADMIN") THROW untuk
  // KASIR, dan karena CustomerDebtClient memanggil fungsi ini sebelum memuat
  // data, seluruh halaman hutang pelanggan gagal dimuat untuk kasir. Sekarang
  // non-admin tidak di-throw — update dilewati dan halaman tetap dimuat.
  if (!hasMinimumRole(session, "ADMIN")) {
    return { success: true, skipped: true, message: "Overdue update dilewati (butuh ADMIN)" };
  }
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const res = await prisma.customerDebt.updateMany({
      where: {
        dueDate: { lt: today },
        status: { in: [DebtStatus.UNPAID, DebtStatus.PARTIAL] },
      },
      data: {
        status: DebtStatus.OVERDUE,
      },
    });

    return { success: true, message: "Overdue debts updated", count: res.count };
  } catch (error) {
    console.error("Error updating overdue debts:", error);
    return { success: false, error: "Failed to update overdue debts" };
  }
}

// M-18: satu fungsi untuk cron — membalik status OVERDUE untuk hutang
// pelanggan DAN hutang supplier yang lewat jatuh tempo & belum lunas.
// Dipanggil dari endpoint cron /api/notifications/check-overdue (paket
// perbaikan notifikasi): NotificationService.checkOverdueAndLowStock()
// harus memanggil updateAllOverdueDebts() ini, atau cron-job.org memanggil
// endpoint yang memanggilnya. Sebelumnya status OVERDUE hanya berubah saat
// admin membuka halaman daftar hutang — tidak pernah ada pemicu berkala.
export async function updateAllOverdueDebts() {
  const session = await auth();
  if (!hasMinimumRole(session, "ADMIN")) {
    return { success: true, skipped: true, message: "Overdue update dilewati (butuh ADMIN)" };
  }
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const where = {
      dueDate: { lt: today },
      status: { in: [DebtStatus.UNPAID, DebtStatus.PARTIAL] },
    };
    const [customer, supplier] = await Promise.all([
      prisma.customerDebt.updateMany({ where, data: { status: DebtStatus.OVERDUE } }),
      prisma.supplierDebt.updateMany({ where, data: { status: DebtStatus.OVERDUE } }),
    ]);
    return {
      success: true,
      message: "Overdue debts updated",
      count: customer.count + supplier.count,
      customerCount: customer.count,
      supplierCount: supplier.count,
    };
  } catch (error) {
    console.error("Error updating overdue debts:", error);
    return { success: false, error: "Failed to update overdue debts" };
  }
}