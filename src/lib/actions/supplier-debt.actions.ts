"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { DebtStatus, Prisma } from "@prisma/client";
import {
  addSupplierPaymentSchema,
  AddSupplierPaymentInput,
} from "@/lib/validations/supplier-debt.schema";
import { requireMinimumRole, requirePermission } from "../utils/role";

// ==================== GET ALL SUPPLIER DEBTS ====================
export async function getAllSupplierDebts(filters?: {
  search?: string;
  supplierId?: string;
  status?: DebtStatus;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const session = await auth();
  requirePermission(session, "VIEW_SUPPLIER_DEBTS");
  try {
    const where: Prisma.SupplierDebtWhereInput = {};

    if (filters?.search) {
      where.OR = [
        { debtNumber: { contains: filters.search, mode: "insensitive" } },
        {
          supplier: { name: { contains: filters.search, mode: "insensitive" } },
        },
        {
          purchase: {
            poNumber: { contains: filters.search, mode: "insensitive" },
          },
        },
      ];
    }

    if (filters?.supplierId) {
      where.supplierId = filters.supplierId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    const debts = await prisma.supplierDebt.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
            phone: true,
          },
        },
        purchase: {
          select: {
            id: true,
            poNumber: true,
            purchaseDate: true,
            grandTotal: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get payment counts separately
    const debtsWithPayments = await Promise.all(
      debts.map(async (debt) => {
        const payments = await prisma.debtPayment.findMany({
          where: { supplierDebtId: debt.id },
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

    // Serialize Decimal to number
    const serializedDebts = debtsWithPayments.map((debt) => ({
      ...debt,
      totalDebt: Number(debt.totalDebt),
      paidAmount: Number(debt.paidAmount),
      remainingDebt: Number(debt.remainingDebt),
      purchase: {
        ...debt.purchase,
        grandTotal: Number(debt.purchase.grandTotal),
      },
      payments: debt.payments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
      })),
    }));

    return { success: true, data: serializedDebts };
  } catch (error) {
    console.error("Error fetching supplier debts:", error);
    return { success: false, error: "Failed to fetch supplier debts" };
  }
}

// ==================== GET SUPPLIER DEBT STATISTICS ====================
export async function getSupplierDebtStatistics() {
  const session = await auth();
  requirePermission(session, "VIEW_SUPPLIER_DEBTS");
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [activeDebts, overdueCount, paidThisMonth, totalActive] =
      await Promise.all([
        prisma.supplierDebt.count({
          where: {
            status: { in: [DebtStatus.UNPAID, DebtStatus.PARTIAL] },
          },
        }),
        prisma.supplierDebt.count({
          where: {
            status: DebtStatus.OVERDUE,
          },
        }),
        prisma.debtPayment.aggregate({
          _sum: { amount: true },
          where: {
            supplierDebtId: { not: null },
            paymentDate: { gte: firstDayOfMonth },
          },
        }),
        prisma.supplierDebt.aggregate({
          _sum: { remainingDebt: true },
          where: {
            status: {
              in: [DebtStatus.UNPAID, DebtStatus.PARTIAL, DebtStatus.OVERDUE],
            },
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
    console.error("Error fetching supplier debt statistics:", error);
    return { success: false, error: "Failed to fetch statistics" };
  }
}

// ==================== GET SUPPLIER DEBT BY ID ====================
export async function getSupplierDebtById(id: string) {
  const session = await auth();
  requirePermission(session, "VIEW_SUPPLIER_DEBTS");
  try {
    const debt = await prisma.supplierDebt.findUnique({
      where: { id },
      include: {
        supplier: true,
        purchase: {
          include: {
            purchaseItems: {
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

    // Get payments separately
    const payments = await prisma.debtPayment.findMany({
      where: { supplierDebtId: id },
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

    // Serialize
    const serializedDebt = {
      ...debt,
      totalDebt: Number(debt.totalDebt),
      paidAmount: Number(debt.paidAmount),
      remainingDebt: Number(debt.remainingDebt),
      purchase: {
        ...debt.purchase,
        totalAmount: Number(debt.purchase.totalAmount),
        discount: Number(debt.purchase.discount),
        tax: Number(debt.purchase.tax),
        grandTotal: Number(debt.purchase.grandTotal),
        paidAmount: Number(debt.purchase.paidAmount),
        purchaseItems: debt.purchase.purchaseItems.map((item) => ({
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
    console.error("Error fetching supplier debt:", error);
    return { success: false, error: "Failed to fetch debt" };
  }
}

// ==================== ADD PAYMENT ====================
export async function addSupplierDebtPayment(input: AddSupplierPaymentInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "MANAGE_SUPPLIER_DEBTS");
    const validated = addSupplierPaymentSchema.parse(input);

    // Get debt
    const debt = await prisma.supplierDebt.findUnique({
      where: { id: validated.debtId },
    });

    if (!debt) {
      return { success: false, error: "Debt not found" };
    }

    if (debt.status === DebtStatus.PAID) {
      return { success: false, error: "Debt already paid" };
    }

    const remainingDebt = Number(debt.remainingDebt);
    if (validated.amount > remainingDebt) {
      return { success: false, error: "Payment amount exceeds remaining debt" };
    }

    // Calculate new values
    const newPaidAmount = Number(debt.paidAmount) + validated.amount;
    const newRemainingDebt = remainingDebt - validated.amount;
    const newStatus =
      newRemainingDebt === 0 ? DebtStatus.PAID : DebtStatus.PARTIAL;

    // Generate payment number
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
    const count = await prisma.debtPayment.count({
      where: {
        paymentNumber: { startsWith: `PAY-${dateStr}` },
      },
    });
    const paymentNumber = `PAY-${dateStr}-${String(count + 1).padStart(
      3,
      "0"
    )}`;

    // Update in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create payment record
      const payment = await tx.debtPayment.create({
        data: {
          paymentNumber,
          supplierDebtId: validated.debtId,
          amount: validated.amount,
          paymentMethod: validated.paymentMethod,
          paymentDate: validated.paymentDate,
          notes: validated.notes,
          adminId: session.user.id,
        },
      });

      // Update debt
      const updatedDebt = await tx.supplierDebt.update({
        where: { id: validated.debtId },
        data: {
          paidAmount: newPaidAmount,
          remainingDebt: newRemainingDebt,
          status: newStatus,
        },
        include: {
          supplier: true,
        },
      });

      return { payment, debt: updatedDebt };
    });

    revalidatePath("/dashboard/supplier-debts");

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

// ==================== DELETE SUPPLIER DEBT ====================
export async function deleteSupplierDebt(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    if (session.user.role === "KASIR") {
      return {
        success: false,
        error: "Kasir tidak memiliki akses untuk hapus debt",
      };
    }
    requirePermission(session, "MANAGE_SUPPLIER_DEBTS");
    // Check debt and payment count
    const debt = await prisma.supplierDebt.findUnique({
      where: { id },
    });

    if (!debt) {
      return { success: false, error: "Debt not found" };
    }

    // Check payment count separately
    const paymentCount = await prisma.debtPayment.count({
      where: { supplierDebtId: id },
    });

    if (paymentCount > 0) {
      return {
        success: false,
        error: "Cannot delete debt with payment history",
      };
    }

    if (debt.status === DebtStatus.PAID) {
      return { success: false, error: "Cannot delete paid debt" };
    }

    await prisma.supplierDebt.delete({
      where: { id },
    });

    revalidatePath("/dashboard/supplier-debts");

    return {
      success: true,
      message: `Debt ${debt.debtNumber} deleted successfully`,
    };
  } catch (error) {
    console.error("Error deleting debt:", error);
    return { success: false, error: "Failed to delete debt" };
  }
}

// ==================== UPDATE OVERDUE STATUS ====================
export async function updateOverdueSupplierDebts() {
  const session = await auth();
  requireMinimumRole(session, "ADMIN");
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.supplierDebt.updateMany({
      where: {
        dueDate: { lt: today },
        status: { in: [DebtStatus.UNPAID, DebtStatus.PARTIAL] },
      },
      data: {
        status: DebtStatus.OVERDUE,
      },
    });

    return { success: true, message: "Overdue debts updated" };
  } catch (error) {
    console.error("Error updating overdue debts:", error);
    return { success: false, error: "Failed to update overdue debts" };
  }
}
