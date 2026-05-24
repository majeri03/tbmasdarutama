import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api";
import { createSubCategory } from "@/lib/actions/category.actions";
import { hasMinimumRole } from "@/lib/utils/role";

/**
 * POST /api/categories/sub
 * Membuat sub-kategori baru.
 * Role: ADMIN+
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const body = await request.json();
    const result = await createSubCategory(body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal membuat sub-kategori.", 400);
    }

    return successResponse(result.data, result.message, 201);
  } catch (error) {
    console.error("[API_SUBCATEGORIES_POST_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
