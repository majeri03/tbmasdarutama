"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { DebtStatus, Prisma } from "@prisma/client";
import { addPaymentSchema, AddPaymentInput } from "@/lib/validations/customer-debt.schema";

//GET ALL CUSTOMER DEBTS
export async function getAllCustomerDebts(filters?: {
  search?: string;
  customerId?: string;
  status?: DebtStatus;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  try {
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

    const debts = await prisma.customerDebt.findMany({
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
    });

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

    return { success: true, data: serializedDebts };
  } catch (error) {
    console.error("Error fetching customer debts:", error);
    return { success: false, error: "Failed to fetch customer debts" };
  }
}

//GET CUSTOMER DEBT STATISTICS
export async function getCustomerDebtStatistics() {
  try {
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
    return { success: false, error: "Failed to fetch statistics" };
  }
}

//GET CUSTOMER DEBT BY ID
export async function getCustomerDebtById(id: string) {
  try {
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
    return { success: false, error: "Failed to fetch debt" };
  }
}

//ADD PAYMENT
export async function addCustomerDebtPayment(input: AddPaymentInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const validated = addPaymentSchema.parse(input);

    const debt = await prisma.customerDebt.findUnique({
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

    const newPaidAmount = Number(debt.paidAmount) + validated.amount;
    const newRemainingDebt = remainingDebt - validated.amount;
    const newStatus = newRemainingDebt === 0 ? DebtStatus.PAID : DebtStatus.PARTIAL;

    const result = await prisma.$transaction(async (tx) => {
      const paymentCount = await tx.debtPayment.count();
      const paymentNumber = `PAY-${String(paymentCount + 1).padStart(6, '0')}`;

      const payment = await tx.debtPayment.create({
        data: {
          paymentNumber,
          customerDebtId: validated.debtId,
          amount: validated.amount,
          paymentMethod: validated.paymentMethod,
          paymentDate: validated.paymentDate,
          notes: validated.notes,
          adminId: session.user.id,
        },
      });

      const updatedDebt = await tx.customerDebt.update({
        where: { id: validated.debtId },
        data: {
          paidAmount: newPaidAmount,
          remainingDebt: newRemainingDebt,
          status: newStatus,
        },
        include: {
          customer: true,
        },
      });

      return { payment, debt: updatedDebt };
    });

    revalidatePath("/dashboard/customer-debts");

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
export async function deleteCustomerDebt(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

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
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.customerDebt.updateMany({
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