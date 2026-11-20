import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/utils/api";
import { getPurchaseById, deletePurchase } from "@/lib/actions/purchase.actions";
import { hasMinimumRole } from "@/lib/utils/role";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/purchases/[id]
 * Detail Purchase Order.
 * Role: ADMIN+
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const { id } = await context.params;
    const result = await getPurchaseById(id, session);

    if (!result.success) {
      return notFoundResponse("Purchase Order");
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_PURCHASE_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * DELETE /api/purchases/[id]
 * Hapus Purchase Order. Role: ADMIN+ (deletePurchase menolak KASIR).
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();
    const { id } = await context.params;
    const result = await deletePurchase(id);
    if (!result.success) {
      return errorResponse(result.error || "Gagal menghapus Purchase Order.", 400);
    }
    return successResponse(result.data, result.message);
  } catch (error) {
    console.error("[API_PURCHASE_DELETE_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
