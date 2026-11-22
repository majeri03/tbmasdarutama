import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
} from "@/lib/utils/api";
import { addCustomerDebtPayment } from "@/lib/actions/customer-debt.actions";
import { addSupplierDebtPayment } from "@/lib/actions/supplier-debt.actions";
import { hasMinimumRole } from "@/lib/utils/role";

/**
 * POST /api/debts/payments
 * Pencatatan cicilan/pelunasan utang piutang.
 * Mendukung pembayaran untuk CustomerDebt maupun SupplierDebt.
 * Body harus menyertakan `type: "customer" | "supplier"` untuk membedakan.
 * Role: ADMIN+
 * 
 * Body format:
 * {
 *   type: "customer" | "supplier",
 *   debtId: string,
 *   amount: number,
 *   paymentMethod: PaymentMethod,
 *   paymentDate?: Date,
 *   notes?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const body = await request.json();
    const { type, ...paymentData } = body;

    // Validasi tipe pembayaran
    if (!type || !["customer", "supplier"].includes(type)) {
      return validationErrorResponse(
        'Field "type" wajib diisi dengan nilai "customer" atau "supplier".'
      );
    }

    if (!paymentData.debtId) {
      return validationErrorResponse('Field "debtId" wajib diisi.');
    }

    if (!paymentData.amount || paymentData.amount <= 0) {
      return validationErrorResponse('Field "amount" harus lebih dari 0.');
    }

    let result;

    if (type === "customer") {
      result = await addCustomerDebtPayment(paymentData);
    } else {
      result = await addSupplierDebtPayment(paymentData);
    }

    if (!result.success) {
      return errorResponse(result.error || "Gagal mencatat pembayaran.", 400);
    }

    // Kirim notifikasi saat cicilan/pelunasan berhasil.
    // FIX (22 Nov 2026): (1) notifikasi customer sebelumnya TIDAK PERNAH
    // terkirim — route membaca data.customerName, padahal action
    // mengembalikan data.customer.name (objek relasi). (2) Pembayaran
    // utang supplier sekarang juga ternotifikasi.
    if (result.data) {
      const data = result.data as {
        customer?: { name?: string };
        supplier?: { name?: string };
      };
      const { NotificationService } = await import("@/lib/services/notification.service");
      if (type === "customer" && data.customer?.name) {
        NotificationService.onPaymentReceived(
          data.customer.name,
          paymentData.amount,
          "customer"
        ).catch(console.error);
      } else if (type === "supplier" && data.supplier?.name) {
        NotificationService.onPaymentReceived(
          data.supplier.name,
          paymentData.amount,
          "supplier"
        ).catch(console.error);
      }
    }

    return successResponse(result.data, result.message, 201);
  } catch (error) {
    console.error("[API_DEBT_PAYMENT_POST_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
