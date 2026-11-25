import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  parseSearchParams,
} from "@/lib/utils/api";
import { getSalesReport } from "@/lib/actions/report.actions";
import { hasPermission } from "@/lib/utils/role";

// FIX (25 Nov 2026, batch 8 item 235): rute ini BELUM ADA —
// GET /api/reports/sales mengembalikan 404 Next.js, dengan maupun tanpa
// parameter tanggal. Padahal /api/reports/debts, /api/reports/financial
// dan /api/reports/inventory sudah ada dengan pola yang sama.
// Rute ini thin wrapper di atas getSalesReport() — server action yang
// sama dengan yang dipakai halaman Laporan Penjualan
// (/dashboard/reports/sales), jadi datanya identik dengan yang tampil
// di halaman (bukan dari GET /api/sales).
//
// Query params:
// - dateFrom / dateTo: ISO date string (dipakai halaman laporan)
// - startDate / endDate: alias (dipakai /api/sales & APK)
// - customerId: filter by customer
// - status: filter by status penjualan (COMPLETED, PENDING, CANCELLED, ...)
function parseAliasDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * GET /api/reports/sales
 * Laporan penjualan per periode + ringkasan (total transaksi,
 * total pendapatan, total diskon, total pajak, per metode bayar).
 * Role: ADMIN+ (VIEW_REPORTS)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "VIEW_REPORTS")) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);

    const result = await getSalesReport({
      dateFrom:
        params.dateFrom ?? parseAliasDate(searchParams.get("startDate")),
      dateTo: params.dateTo ?? parseAliasDate(searchParams.get("endDate")),
      customerId: params.customerId,
      status: params.status,
    }, session);

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil laporan penjualan.", 400);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_REPORT_SALES_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
