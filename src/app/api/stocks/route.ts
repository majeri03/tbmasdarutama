import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  parseSearchParams,
} from "@/lib/utils/api";
import {
  getStockMovements,
  createStockAdjustment,
} from "@/lib/actions/stock.actions";
import { hasPermission } from "@/lib/utils/role";
import { MovementType } from "@prisma/client";

/**
 * GET /api/stocks
 * Mengambil riwayat pergerakan stok (Stock Movements) dengan filter.
 * Role: KASIR+
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "VIEW_STOCK")) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);

    const result = await getStockMovements({
      search: params.search,
      productId: params.productId,
      movementType: searchParams.get("type") as MovementType | undefined,
      dateFrom: searchParams.get("dateFrom") ? new Date(searchParams.get("dateFrom")!) : undefined,
      dateTo: searchParams.get("dateTo") ? new Date(searchParams.get("dateTo")!) : undefined,
      page: params.page,
      limit: params.limit,
    });

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil data stok.", 400);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_STOCKS_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * POST /api/stocks
 * Melakukan Stock Adjustment / Stock Opname.
 * Role: ADMIN+
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "ADJUST_STOCK")) return forbiddenResponse();

    const body = await request.json();
    const result = await createStockAdjustment(body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal melakukan penyesuaian stok.", 400);
    }

    return successResponse(result.data, result.message, 201);
  } catch (error) {
    console.error("[API_STOCKS_POST_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
