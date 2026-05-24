import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/utils/api";
import { getPurchaseById } from "@/lib/actions/purchase.actions";
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
    const result = await getPurchaseById(id);

    if (!result.success) {
      return notFoundResponse("Purchase Order");
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_PURCHASE_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
