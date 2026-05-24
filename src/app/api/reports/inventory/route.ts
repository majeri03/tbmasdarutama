import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  parseSearchParams,
} from "@/lib/utils/api";
import { getInventoryReport } from "@/lib/actions/report.actions";
import { hasPermission } from "@/lib/utils/role";

/**
 * GET /api/reports/inventory
 * Total nilai aset barang dan daftar produk kritis (lowStock, outOfStock).
 * Role: ADMIN+ (VIEW_REPORTS)
 * 
 * Query params:
 * - categoryId: filter by category
 * - supplierId: filter by supplier
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "VIEW_REPORTS")) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);

    const result = await getInventoryReport({
      categoryId: params.categoryId,
      supplierId: params.supplierId,
    });

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil laporan inventaris.", 400);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_REPORT_INVENTORY_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
