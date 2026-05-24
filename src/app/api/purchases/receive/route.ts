import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api";
import { receivePurchase } from "@/lib/actions/purchase.actions";
import { hasMinimumRole } from "@/lib/utils/role";

/**
 * POST /api/purchases/receive
 * Menerima barang dari Purchase Order (update stok + StockMovement IN).
 * Role: ADMIN+
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const body = await request.json();
    const result = await receivePurchase(body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal menerima Purchase Order.", 400);
    }

    return successResponse(result.data, result.message);
  } catch (error) {
    console.error("[API_PURCHASE_RECEIVE_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
