import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  parseSearchParams,
} from "@/lib/utils/api";
import { getAllSupplierDebts } from "@/lib/actions/supplier-debt.actions";
import { hasPermission } from "@/lib/utils/role";
import { DebtStatus } from "@prisma/client";

/**
 * GET /api/debts/suppliers
 * Mengambil daftar utang ke supplier.
 * Role: ADMIN+ (VIEW_SUPPLIER_DEBTS)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "VIEW_SUPPLIER_DEBTS")) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);

    const result = await getAllSupplierDebts({
      search: params.search,
      supplierId: params.supplierId,
      status: params.status as DebtStatus | undefined,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    });

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil data utang supplier.", 400);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_SUPPLIER_DEBTS_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
