import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/utils/api";
import { getSaleById } from "@/lib/actions/sale.actions";
import { hasPermission } from "@/lib/utils/role";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/sales/[id]
 * Detail invoice penjualan untuk preview/cetak.
 * Role: KASIR+ (VIEW_SALES)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "VIEW_SALES")) return forbiddenResponse();

    const { id } = await context.params;
    const result = await getSaleById(id);

    if (!result.success) {
      return notFoundResponse("Invoice penjualan");
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_SALE_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
