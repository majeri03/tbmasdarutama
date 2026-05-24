import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  parseSearchParams,
} from "@/lib/utils/api";
import { getCategories, createCategory } from "@/lib/actions/category.actions";
import { hasMinimumRole, hasPermission } from "@/lib/utils/role";

/**
 * GET /api/categories
 * Mengambil daftar kategori dengan sub-kategori.
 * Role: ADMIN+
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "VIEW_CATEGORIES")) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);

    const result = await getCategories({
      search: params.search,
      page: params.page,
      limit: params.limit,
      includeSubCategories: params.includeSubCategories,
    });

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil data kategori.", 400);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_CATEGORIES_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * POST /api/categories
 * Membuat kategori baru.
 * Role: ADMIN+
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const body = await request.json();
    const result = await createCategory(body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal membuat kategori.", 400);
    }

    return successResponse(result.data, result.message, 201);
  } catch (error) {
    console.error("[API_CATEGORIES_POST_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
