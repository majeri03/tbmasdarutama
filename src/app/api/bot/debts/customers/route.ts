import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { DebtStatus } from "@prisma/client";
import {
  requireBotRead,
  botOk,
  botErr,
  sanitizeBotError,
  parseBotPagination,
  toNum,
} from "@/lib/bot-auth";

const VALID_STATUSES: DebtStatus[] = ["UNPAID", "PARTIAL", "PAID", "OVERDUE"];

/**
 * GET /api/bot/debts/customers
 * Daftar piutang pelanggan untuk bot WhatsApp (baca saja).
 * Query: search (nomor utang / nama pelanggan), status
 * (UNPAID/PARTIAL/PAID/OVERDUE), page (default 1), limit (default 20, maks 50).
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const { page, limit } = parseBotPagination(searchParams);
    const search = searchParams.get("search")?.trim() || undefined;
    const statusParam = searchParams.get("status")?.trim().toUpperCase();

    let status: DebtStatus | undefined;
    if (statusParam) {
      if (!VALID_STATUSES.includes(statusParam as DebtStatus)) {
        return botErr(
          "Status tidak valid. Gunakan UNPAID, PARTIAL, PAID, atau OVERDUE.",
          400
        );
      }
      status = statusParam as DebtStatus;
    }

    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { debtNumber: { contains: search, mode: "insensitive" as const } },
              {
                customer: {
                  name: { contains: search, mode: "insensitive" as const },
                },
              },
            ],
          }
        : {}),
    };

    const [total, debts] = await Promise.all([
      prisma.customerDebt.count({ where }),
      prisma.customerDebt.findMany({
        where,
        select: {
          id: true,
          debtNumber: true,
          saleId: true,
          totalDebt: true,
          paidAmount: true,
          remainingDebt: true,
          dueDate: true,
          status: true,
          customer: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data = debts.map((d) => ({
      id: d.id,
      debtNumber: d.debtNumber,
      customer: { id: d.customer.id, name: d.customer.name },
      saleId: d.saleId,
      totalDebt: toNum(d.totalDebt),
      paidAmount: toNum(d.paidAmount),
      remainingDebt: toNum(d.remainingDebt),
      dueDate: d.dueDate,
      status: d.status,
    }));

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return botOk(data, { page, limit, total, totalPages });
  } catch (error) {
    console.error("[API_BOT_DEBTS_CUSTOMERS_GET_ERROR]", error);
    return botErr(sanitizeBotError(error), 500);
  }
}
