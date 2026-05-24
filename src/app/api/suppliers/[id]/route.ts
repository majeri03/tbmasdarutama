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
  getSupplierById,
  updateSupplier,
  deleteSupplier,
} from "@/lib/actions/supplier.actions";
import { hasMinimumRole } from "@/lib/utils/role";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/suppliers/[id]
 * Detail supplier.
 * Role: ADMIN+
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const { id } = await context.params;
    const result = await getSupplierById(id);

    if (!result.success) {
      return notFoundResponse("Supplier");
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_SUPPLIER_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * PUT /api/suppliers/[id]
 * Update supplier.
 * Role: ADMIN+
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const { id } = await context.params;
    const body = await request.json();
    const result = await updateSupplier(id, body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal memperbarui supplier.", 400);
    }

    return successResponse(result.data, result.message);
  } catch (error) {
    console.error("[API_SUPPLIER_PUT_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * DELETE /api/suppliers/[id]
 * Hapus supplier (gagal jika masih ada relasi).
 * Role: ADMIN+
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const { id } = await context.params;
    const result = await deleteSupplier(id);

    if (!result.success) {
      return errorResponse(result.error || "Gagal menghapus supplier.", 400);
    }

    return successResponse(null, result.message);
  } catch (error) {
    console.error("[API_SUPPLIER_DELETE_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
