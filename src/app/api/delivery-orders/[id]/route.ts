import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/utils/api";
import {
  getDeliveryOrderById,
  updateDeliveryStatus,
} from "@/lib/actions/delivery-order.actions";
import { hasPermission } from "@/lib/utils/role";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/delivery-orders/[id]
 * Detail Surat Jalan.
 * Role: ADMIN+ (VIEW_DELIVERY_ORDERS)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "VIEW_DELIVERY_ORDERS")) return forbiddenResponse();

    const { id } = await context.params;
    const result = await getDeliveryOrderById(id);

    if (!result.success) {
      return notFoundResponse("Surat Jalan");
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_DELIVERY_ORDER_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * PUT /api/delivery-orders/[id]
 * Update status Surat Jalan (PENDING → IN_TRANSIT → DELIVERED / CANCELLED).
 * Role: ADMIN+ (UPDATE_DELIVERY_STATUS)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "UPDATE_DELIVERY_STATUS")) return forbiddenResponse();

    const { id } = await context.params;
    const body = await request.json();

    const result = await updateDeliveryStatus({
      id,
      ...body,
    });

    if (!result.success) {
      return errorResponse(result.error || "Gagal memperbarui status pengiriman.", 400);
    }

    return successResponse(result.data, result.message);
  } catch (error) {
    console.error("[API_DELIVERY_ORDER_PUT_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
