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
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "@/lib/actions/category.actions";
import { hasMinimumRole } from "@/lib/utils/role";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/categories/[id]
 * Detail kategori beserta sub-kategori.
 * Role: ADMIN+
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const { id } = await context.params;
    const result = await getCategoryById(id);

    if (!result.success) {
      return notFoundResponse("Kategori");
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_CATEGORY_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * PUT /api/categories/[id]
 * Update kategori.
 * Role: ADMIN+
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const { id } = await context.params;
    const body = await request.json();
    const result = await updateCategory(id, body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal memperbarui kategori.", 400);
    }

    return successResponse(result.data, result.message);
  } catch (error) {
    console.error("[API_CATEGORY_PUT_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * DELETE /api/categories/[id]
 * Hapus kategori (gagal jika masih ada produk/sub-kategori).
 * Role: ADMIN+
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const { id } = await context.params;
    const result = await deleteCategory(id);

    if (!result.success) {
      return errorResponse(result.error || "Gagal menghapus kategori.", 400);
    }

    return successResponse(null, result.message);
  } catch (error) {
    console.error("[API_CATEGORY_DELETE_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
