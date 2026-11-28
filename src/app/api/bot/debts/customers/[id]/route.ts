import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireBotRead,
  botOk,
  botErr,
  sanitizeBotError,
  toNum,
} from "@/lib/bot-auth";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/bot/debts/customers/[id]
 * Detail satu piutang pelanggan + daftar pembayarannya (baca saja).
 * Pembayaran (DebtPayment): paymentNumber, amount, paymentDate,
 * paymentMethod, notes.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireBotRead(request);
    if (!auth.ok) {
      return botErr(
        auth.status === 429
          ? "Terlalu banyak permintaan. Coba lagi sebentar lagi."
          : "Kunci bot tidak valid.",
        auth.status
      );
    }

    const { id } = await context.params;

    const debt = await prisma.customerDebt.findUnique({
      where: { id },
      select: {
        id: true,
        debtNumber: true,
        saleId: true,
        totalDebt: true,
        paidAmount: true,
        remainingDebt: true,
        dueDate: true,
        status: true,
        notes: true,
        createdAt: true,
        customer: { select: { id: true, name: true, phone: true } },
        debtPayments: {
          select: {
            id: true,
            paymentNumber: true,
            amount: true,
            paymentDate: true,
            paymentMethod: true,
            notes: true,
          },
          orderBy: { paymentDate: "desc" },
        },
      },
    });

    if (!debt) {
      return botErr("Piutang tidak ditemukan.", 404);
    }

    return botOk({
      id: debt.id,
      debtNumber: debt.debtNumber,
      customer: {
        id: debt.customer.id,
        name: debt.customer.name,
        phone: debt.customer.phone,
      },
      saleId: debt.saleId,
      totalDebt: toNum(debt.totalDebt),
      paidAmount: toNum(debt.paidAmount),
      remainingDebt: toNum(debt.remainingDebt),
      dueDate: debt.dueDate,
      status: debt.status,
      notes: debt.notes,
      createdAt: debt.createdAt,
      payments: debt.debtPayments.map((p) => ({
        id: p.id,
        paymentNumber: p.paymentNumber,
        amount: toNum(p.amount),
        paymentDate: p.paymentDate,
        paymentMethod: p.paymentMethod,
        notes: p.notes,
      })),
    });
  } catch (error) {
    console.error("[API_BOT_DEBTS_CUSTOMERS_ID_GET_ERROR]", error);
    return botErr(sanitizeBotError(error), 500);
  }
}
