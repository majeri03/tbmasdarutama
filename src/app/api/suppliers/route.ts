import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  parseSearchParams,
} from "@/lib/utils/api";
import { getSuppliers, createSupplier } from "@/lib/actions/supplier.actions";
import { hasMinimumRole } from "@/lib/utils/role";

/**
 * GET /api/suppliers
 * Mengambil daftar supplier dengan filter dan pagination.
 * Role: ADMIN+
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);

    const result = await getSuppliers({
      search: params.search,
      page: params.page,
      limit: params.limit,
      isActive: params.isActive !== undefined ? params.isActive : null,
    });

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil data supplier.", 400);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_SUPPLIERS_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * POST /api/suppliers
 * Membuat supplier baru.
 * Role: ADMIN+
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const body = await request.json();
    const result = await createSupplier(body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal membuat supplier.", 400);
    }

    return successResponse(result.data, result.message, 201);
  } catch (error) {
    console.error("[API_SUPPLIERS_POST_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
