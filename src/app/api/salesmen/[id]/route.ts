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
  getSalesmanById,
  updateSalesman,
  deleteSalesman,
} from "@/lib/actions/salesman.actions";
import { hasMinimumRole } from "@/lib/utils/role";

// PKG-A (23 Nov 2026, perbaikan 7 item #5): API salesman per id.
// GET: KASIR+. PUT / DELETE: SUPER_ADMIN saja.

/**
 * GET /api/salesmen/[id]
 * Mengambil satu salesman.
 * Role: KASIR+
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "KASIR")) return forbiddenResponse();

    const { id } = await params;
    const result = await getSalesmanById(id, session);

    if (!result.success) {
      return notFoundResponse("Salesman");
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_SALESMAN_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * PUT /api/salesmen/[id]
 * Mengubah salesman.
 * Role: SUPER_ADMIN
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "SUPER_ADMIN")) return forbiddenResponse();

    const { id } = await params;
    const body = await request.json();
    const result = await updateSalesman(id, body, session);

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengubah salesman.", 400);
    }

    return successResponse(result.data, result.message);
  } catch (error) {
    console.error("[API_SALESMAN_PUT_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * DELETE /api/salesmen/[id]
 * Menghapus salesman (ditolak kalau sudah tercatat di penjualan).
 * Role: SUPER_ADMIN
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "SUPER_ADMIN")) return forbiddenResponse();

    const { id } = await params;
    const result = await deleteSalesman(id, session);

    if (!result.success) {
      return errorResponse(result.error || "Gagal menghapus salesman.", 400);
    }

    return successResponse(null, result.message);
  } catch (error) {
    console.error("[API_SALESMAN_DELETE_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
