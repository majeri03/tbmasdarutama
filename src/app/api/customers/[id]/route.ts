import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api";
import {
  updateCustomer,
  deleteCustomer,
} from "@/lib/actions/customer.actions";
import { hasMinimumRole } from "@/lib/utils/role";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PUT /api/customers/[id]
 * Update customer.
 * Role: ADMIN+
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const { id } = await context.params;
    const body = await request.json();
    const result = await updateCustomer(id, body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal memperbarui customer.", 400);
    }

    return successResponse(null, result.message);
  } catch (error) {
    console.error("[API_CUSTOMER_PUT_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * DELETE /api/customers/[id]
 * Hapus customer (gagal jika masih ada transaksi/utang).
 * Role: ADMIN+
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const { id } = await context.params;
    const result = await deleteCustomer(id);

    if (!result.success) {
      return errorResponse(result.error || "Gagal menghapus customer.", 400);
    }

    return successResponse(null, result.message);
  } catch (error) {
    console.error("[API_CUSTOMER_DELETE_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
