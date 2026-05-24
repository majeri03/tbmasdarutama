import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  parseSearchParams,
} from "@/lib/utils/api";
import { getDebtsReport } from "@/lib/actions/report.actions";
import { hasPermission } from "@/lib/utils/role";

/**
 * GET /api/reports/debts
 * Komparasi total piutang pelanggan vs total utang ke supplier.
 * Role: ADMIN+ (VIEW_REPORTS)
 * 
 * Query params:
 * - customerId: filter piutang by customer
 * - supplierId: filter utang by supplier
 * - status: filter by debt status (UNPAID, PARTIAL, PAID, OVERDUE)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "VIEW_REPORTS")) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);

    const result = await getDebtsReport({
      customerId: params.customerId,
      supplierId: params.supplierId,
      status: params.status,
    });

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil laporan utang piutang.", 400);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_REPORT_DEBTS_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
