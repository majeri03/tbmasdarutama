import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  parseSearchParams,
} from "@/lib/utils/api";
import { getFinancialReport } from "@/lib/actions/report.actions";
import { hasPermission } from "@/lib/utils/role";

/**
 * GET /api/reports/financial
 * Agregasi omzet, modal, profit bersih, dan arus kas masuk/keluar.
 * Role: ADMIN+ (VIEW_REPORTS)
 * 
 * Query params:
 * - dateFrom: ISO date string
 * - dateTo: ISO date string
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "VIEW_REPORTS")) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);
    const period = searchParams.get("period") as any;

    const result = await getFinancialReport({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      period: period || undefined,
    });

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil laporan keuangan.", 400);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_REPORT_FINANCIAL_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
