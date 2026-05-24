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
  getUnitById,
  updateUnit,
  deleteUnit,
} from "@/lib/actions/unit.actions";
import { hasMinimumRole } from "@/lib/utils/role";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/units/[id]
 * Detail satuan.
 * Role: ADMIN+
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const { id } = await context.params;
    const result = await getUnitById(id);

    if (!result.success) {
      return notFoundResponse("Satuan");
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_UNIT_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * PUT /api/units/[id]
 * Update satuan.
 * Role: ADMIN+
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const { id } = await context.params;
    const body = await request.json();
    const result = await updateUnit(id, body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal memperbarui satuan.", 400);
    }

    return successResponse(result.data, result.message);
  } catch (error) {
    console.error("[API_UNIT_PUT_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * DELETE /api/units/[id]
 * Hapus satuan (gagal jika masih digunakan produk/transaksi).
 * Role: ADMIN+
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const { id } = await context.params;
    const result = await deleteUnit(id);

    if (!result.success) {
      return errorResponse(result.error || "Gagal menghapus satuan.", 400);
    }

    return successResponse(null, result.message);
  } catch (error) {
    console.error("[API_UNIT_DELETE_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
