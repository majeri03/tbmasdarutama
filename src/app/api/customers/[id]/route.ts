import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/utils/api";
import {
  updateCustomer,
  deleteCustomer,
} from "@/lib/actions/customer.actions";
import { hasMinimumRole } from "@/lib/utils/role";
import prisma from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/customers/[id]
 * Mengambil profil detail pelanggan beserta riwayat tagihan (faktur/sales),
 * data utang, riwayat pembayaran cicilan, dan ringkasan keuangan.
 * Role: KASIR+
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "KASIR")) return forbiddenResponse();

    const { id } = await context.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: {
          include: {
            saleItems: {
              include: {
                product: { select: { id: true, name: true, code: true } },
                unit: { select: { id: true, name: true, symbol: true } },
              },
            },
          },
          orderBy: { saleDate: "desc" },
        },
        customerDebts: {
          include: {
            debtPayments: {
              include: {
                admin: { select: { id: true, name: true } },
              },
              orderBy: { paymentDate: "desc" },
            },
            sale: {
              select: { id: true, invoiceNumber: true, grandTotal: true, saleDate: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        deliveryOrders: {
          include: {
            deliveryItems: {
              include: {
                product: { select: { id: true, name: true } },
                unit: { select: { id: true, symbol: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!customer) {
      return notFoundResponse("Customer");
    }

    const now = new Date();

    // Serialisasi data dan hitung ringkasan keuangan
    const serializedSales = customer.sales.map((sale) => ({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      saleDate: sale.saleDate,
      totalAmount: Number(sale.totalAmount),
      discount: Number(sale.discount),
      tax: Number(sale.tax),
      grandTotal: Number(sale.grandTotal),
      paidAmount: Number(sale.paidAmount),
      changeAmount: Number(sale.changeAmount),
      paymentMethod: sale.paymentMethod,
      status: sale.status,
      notes: sale.notes,
      items: sale.saleItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product?.name ?? "-",
        unitName: item.unit?.symbol ?? item.unit?.name ?? "-",
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.subtotal),
      })),
    }));

    // Kumpulkan semua pembayaran utang ke dalam satu timeline
    const allPayments: Array<{
      id: string;
      paymentNumber: string;
      debtId: string;
      amount: number;
      paymentMethod: string;
      paymentDate: Date;
      notes: string | null;
      adminName: string;
      debtNumber: string;
    }> = [];

    let totalRemainingDebt = 0;
    let totalOverdueDebt = 0;
    let overdueCount = 0;

    const serializedDebts = customer.customerDebts.map((debt) => {
      const remaining = Number(debt.remainingDebt);
      const isOverdue =
        debt.status === "OVERDUE" || (debt.status !== "PAID" && new Date(debt.dueDate) < now);

      if (debt.status !== "PAID") {
        totalRemainingDebt += remaining;
        if (isOverdue) {
          totalOverdueDebt += remaining;
          overdueCount += 1;
        }
      }

      const debtPayments = debt.debtPayments.map((p) => {
        const item = {
          id: p.id,
          paymentNumber: p.paymentNumber,
          debtId: debt.id,
          amount: Number(p.amount),
          paymentMethod: p.paymentMethod,
          paymentDate: p.paymentDate,
          notes: p.notes,
          adminName: p.admin?.name ?? "Admin",
          debtNumber: debt.debtNumber,
        };
        allPayments.push(item);
        return item;
      });

      return {
        id: debt.id,
        debtNumber: debt.debtNumber,
        saleId: debt.saleId,
        invoiceNumber: debt.sale?.invoiceNumber ?? null,
        totalDebt: Number(debt.totalDebt),
        paidAmount: Number(debt.paidAmount),
        remainingDebt: remaining,
        dueDate: debt.dueDate,
        status: isOverdue ? "OVERDUE" : debt.status,
        notes: debt.notes,
        createdAt: debt.createdAt,
        payments: debtPayments,
      };
    });

    // Urutkan semua pembayaran dari terbaru ke terlama
    allPayments.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

    const totalBilled = serializedSales.reduce((acc, s) => acc + s.grandTotal, 0);
    const totalPaidSales = serializedSales.reduce((acc, s) => acc + s.paidAmount, 0);

    const summary = {
      totalOrders: serializedSales.length,
      totalBilled,
      totalPaid: totalPaidSales,
      remainingDebt: totalRemainingDebt,
      overdueDebt: totalOverdueDebt,
      overdueCount,
    };

    return successResponse({
      customer: {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        city: customer.city,
        province: customer.province,
        type: customer.type,
        isActive: customer.isActive,
        createdAt: customer.createdAt,
      },
      summary,
      sales: serializedSales,
      debts: serializedDebts,
      paymentHistory: allPayments,
      deliveries: customer.deliveryOrders.map((d) => ({
        id: d.id,
        doNumber: d.doNumber,
        status: d.status,
        driver: d.driver,
        vehicle: d.vehicle,
        deliveryDate: d.deliveryDate,
      })),
    });
  } catch (error) {
    console.error("[API_CUSTOMER_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server saat mengambil profil customer.");
  }
}

/**
 * PUT /api/customers/[id]
 * Update customer.
 * Role: ADMIN+
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "KASIR")) return forbiddenResponse();

    const { id } = await context.params;
    const body = await request.json();
    const result = await updateCustomer(id, body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal memperbarui customer.", 400);
    }

    return successResponse(null, result.message);
  } catch (error) {
    console.error("[API_CUSTOMER_PUT_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * DELETE /api/customers/[id]
 * Hapus customer (gagal jika masih ada transaksi/utang).
 * Role: KASIR+
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "KASIR")) return forbiddenResponse();

    const { id } = await context.params;
    const result = await deleteCustomer(id);

    if (!result.success) {
      return errorResponse(result.error || "Gagal menghapus customer.", 400);
    }

    return successResponse(null, result.message);
  } catch (error) {
    console.error("[API_CUSTOMER_DELETE_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
