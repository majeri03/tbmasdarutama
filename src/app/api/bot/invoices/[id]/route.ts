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
 * GET /api/bot/invoices/[id]
 * Data invoice untuk satu Sale (id = id Sale) — dipakai bot untuk
 * menampilkan / mengirim invoice sebagai teks atau PDF (baca saja).
 * TIDAK PERNAH mengembalikan fee salesman (salesmanFeeEnabled /
 * salesmanFeePercent) atau buyPrice.
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

    const [sale, store] = await Promise.all([
      prisma.sale.findUnique({
        where: { id },
        select: {
          id: true,
          invoiceNumber: true,
          saleDate: true,
          totalAmount: true,
          discount: true,
          tax: true,
          grandTotal: true,
          paymentMethod: true,
          paidAmount: true,
          changeAmount: true,
          status: true,
          notes: true,
          customer: {
            select: { id: true, code: true, name: true, phone: true, address: true },
          },
          saleItems: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              discount: true,
              subtotal: true,
              product: { select: { id: true, code: true, name: true } },
              unit: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.storeSetting.findFirst({
        select: {
          name: true,
          address: true,
          phone: true,
          bankName: true,
          bankAccount: true,
          bankHolder: true,
        },
      }),
    ]);

    if (!sale) {
      return botErr("Invoice tidak ditemukan.", 404);
    }

    return botOk({
      sale: {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        saleDate: sale.saleDate,
        totalAmount: toNum(sale.totalAmount),
        discount: toNum(sale.discount),
        tax: toNum(sale.tax),
        grandTotal: toNum(sale.grandTotal),
        paymentMethod: sale.paymentMethod,
        paidAmount: toNum(sale.paidAmount),
        changeAmount: toNum(sale.changeAmount),
        status: sale.status,
        notes: sale.notes,
        customer: sale.customer
          ? {
              id: sale.customer.id,
              code: sale.customer.code,
              name: sale.customer.name,
              phone: sale.customer.phone,
              address: sale.customer.address,
            }
          : null,
      },
      items: sale.saleItems.map((item) => ({
        id: item.id,
        product: {
          id: item.product.id,
          code: item.product.code,
          name: item.product.name,
        },
        unit: { id: item.unit.id, name: item.unit.name },
        quantity: item.quantity,
        unitPrice: toNum(item.unitPrice),
        discount: toNum(item.discount),
        subtotal: toNum(item.subtotal),
      })),
      store: store
        ? {
            name: store.name,
            address: store.address,
            phone: store.phone,
            bankName: store.bankName,
            bankAccount: store.bankAccount,
            bankHolder: store.bankHolder,
          }
        : null,
    });
  } catch (error) {
    console.error("[API_BOT_INVOICES_ID_GET_ERROR]", error);
    return sanitizeBotError(error);
  }
}
