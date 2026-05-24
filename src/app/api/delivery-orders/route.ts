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
  getAllDeliveryOrders,
  createDeliveryOrder,
} from "@/lib/actions/delivery-order.actions";
import { hasPermission } from "@/lib/utils/role";
import { DeliveryStatus } from "@prisma/client";

/**
 * GET /api/delivery-orders
 * Mengambil daftar Surat Jalan dengan filter.
 * Role: ADMIN+ (VIEW_DELIVERY_ORDERS)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "VIEW_DELIVERY_ORDERS")) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);

    const result = await getAllDeliveryOrders({
      search: params.search,
      customerId: params.customerId,
      status: params.status as DeliveryStatus | undefined,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    });

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil data surat jalan.", 400);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_DELIVERY_ORDERS_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * POST /api/delivery-orders
 * Membuat Surat Jalan baru (+ auto-create Invoice & Debt jika tanpa Sale).
 * Role: ADMIN+ (CREATE_DELIVERY_ORDER)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "CREATE_DELIVERY_ORDER")) return forbiddenResponse();

    const body = await request.json();
    const result = await createDeliveryOrder(body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal membuat surat jalan.", 400);
    }

    return successResponse(result.data, result.message, 201);
  } catch (error) {
    console.error("[API_DELIVERY_ORDERS_POST_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
