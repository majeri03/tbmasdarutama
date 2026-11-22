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
  deleteDeliveryOrder,
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
    const result = await getDeliveryOrderById(id, session);

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
 * Update status atau detail Surat Jalan.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();

    const { id } = await context.params;
    const body = await request.json();

    // Jika request menyertakan edit detail (driver, vehicle, deliveryDate, proofImage)
    const isEditDetail =
      body.driver !== undefined ||
      body.vehicle !== undefined ||
      body.deliveryDate !== undefined ||
      body.isEdit === true;

    if (isEditDetail) {
      if (!hasPermission(session, "EDIT_DELIVERY_ORDER")) {
        return forbiddenResponse("Hanya Admin/Superadmin yang dapat mengubah data Surat Jalan.");
      }
      const { updateDeliveryOrder } = await import("@/lib/actions/delivery-order.actions");
      const result = await updateDeliveryOrder({ id, ...body }, session);
      if (!result.success) {
        return errorResponse(result.error || "Gagal mengupdate Surat Jalan.", 400);
      }
      return successResponse(result.data, result.message);
    }

    // Default: update status pengiriman
    if (!hasPermission(session, "UPDATE_DELIVERY_STATUS")) return forbiddenResponse();
    // FIX PENTEST (22 Nov 2026, H5): CANCELLED dan DELIVERED (efek stok &
    // hutang) khusus ADMIN+ — KASIR hanya boleh ke IN_TRANSIT. Action
    // updateDeliveryStatus mengecek ulang, ini supaya responsnya 403.
    if (body.status === "CANCELLED" && !hasPermission(session, "CANCEL_DELIVERY_ORDER")) {
      return forbiddenResponse("Hanya Admin/Superadmin yang dapat membatalkan Surat Jalan.");
    }
    if (body.status === "DELIVERED" && !hasPermission(session, "CONFIRM_DELIVERY_ORDER")) {
      return forbiddenResponse("Hanya Admin/Superadmin yang dapat menandai Surat Jalan diterima.");
    }

    const result = await updateDeliveryStatus(
      {
        id,
        ...body,
      },
      session
    );

    if (!result.success) {
      return errorResponse(result.error || "Gagal memperbarui status pengiriman.", 400);
    }

    // Notifikasi perubahan status sudah dikirim di dalam updateDeliveryStatus
    // (Sistem A, sekali). Dulu route ini memanggilnya lagi = dobel.

    return successResponse(result.data, result.message);
  } catch (error) {
    console.error("[API_DELIVERY_ORDER_PUT_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * PATCH /api/delivery-orders/[id]
 * Khusus Edit Surat Jalan (Superadmin/Admin)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "EDIT_DELIVERY_ORDER")) {
      return forbiddenResponse("Hanya Admin/Superadmin yang dapat mengubah Surat Jalan.");
    }

    const { id } = await context.params;
    const body = await request.json();

    const { updateDeliveryOrder } = await import("@/lib/actions/delivery-order.actions");
    const result = await updateDeliveryOrder({ id, ...body }, session);

    if (!result.success) {
      return errorResponse(result.error || "Gagal memperbarui Surat Jalan.", 400);
    }

    return successResponse(result.data, result.message);
  } catch (error) {
    console.error("[API_DELIVERY_ORDER_PATCH_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * DELETE /api/delivery-orders/[id]
 * Hapus Surat Jalan. Role: SUPER_ADMIN (DELETE_DELIVERY_ORDER).
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "DELETE_DELIVERY_ORDER")) return forbiddenResponse();
    const { id } = await context.params;
    const result = await deleteDeliveryOrder(id, session);
    if (!result.success) {
      return errorResponse(result.error || "Gagal menghapus Surat Jalan.", 400);
    }
    return successResponse(result.data, result.message);
  } catch (error) {
    console.error("[API_DELIVERY_ORDER_DELETE_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
