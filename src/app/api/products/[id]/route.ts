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
  getProductById,
  updateProduct,
  deleteProduct,
} from "@/lib/actions/product.actions";
import { hasMinimumRole, hasPermission } from "@/lib/utils/role";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/products/[id]
 * Detail produk beserta unit, gambar, dan statistik.
 * Role: KASIR+ (buyPrice otomatis 0 untuk KASIR)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "VIEW_PRODUCTS")) return forbiddenResponse();

    const { id } = await context.params;
    const result = await getProductById(id);

    if (!result.success) {
      return notFoundResponse("Produk");
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_PRODUCT_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * PUT /api/products/[id]
 * Update produk beserta relasi unit dan gambar.
 * Role: ADMIN+
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const { id } = await context.params;
    const body = await request.json();
    const result = await updateProduct(id, body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal memperbarui produk.", 400);
    }

    return successResponse(result.data, result.message);
  } catch (error) {
    console.error("[API_PRODUCT_PUT_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * DELETE /api/products/[id]
 * Soft-delete produk (set deletedAt + isActive = false).
 * Role: ADMIN+
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const { id } = await context.params;
    const result = await deleteProduct(id);

    if (!result.success) {
      return errorResponse(result.error || "Gagal menghapus produk.", 400);
    }

    return successResponse(null, result.message);
  } catch (error) {
    console.error("[API_PRODUCT_DELETE_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
