import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUser,
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

    // FIX (22 Nov 2026): teruskan page/limit hanya kalau diminta eksplisit
    // di query (parseSearchParams memberi default limit 10).
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    const result = await getAllCustomerDebts({
      search: params.search,
      customerId: params.customerId,
      status: params.status as DebtStatus | undefined,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page: pageParam ? parseInt(pageParam) : undefined,
      limit: limitParam ? parseInt(limitParam) : undefined,
    }, session);

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil data piutang.", 400);
    }

    // `data` tetap array (APK mengharapkan array) — info paginasi ada di
    // field `pagination` tingkat atas.
    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("[API_CUSTOMER_DEBTS_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
