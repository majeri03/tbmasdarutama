import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  parseSearchParams,
} from "@/lib/utils/api";
import { getAllCustomerDebts } from "@/lib/actions/customer-debt.actions";
import { hasPermission } from "@/lib/utils/role";
import { DebtStatus } from "@prisma/client";

/**
 * GET /api/debts/customers
 * Mengambil daftar piutang customer.
 * Role: KASIR+ (VIEW_CUSTOMER_DEBTS)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "VIEW_CUSTOMER_DEBTS")) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);

    const result = await getAllCustomerDebts({
      search: params.search,
      customerId: params.customerId,
      status: params.status as DebtStatus | undefined,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    });

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil data piutang.", 400);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_CUSTOMER_DEBTS_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
