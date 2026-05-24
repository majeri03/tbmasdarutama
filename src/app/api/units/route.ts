import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  parseSearchParams,
} from "@/lib/utils/api";
import { getUnits, createUnit } from "@/lib/actions/unit.actions";
import { hasMinimumRole, hasPermission } from "@/lib/utils/role";

/**
 * GET /api/units
 * Mengambil daftar satuan/unit.
 * Role: ADMIN+
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "VIEW_UNITS")) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);

    const result = await getUnits({
      search: params.search,
      page: params.page,
      limit: params.limit,
    });

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil data satuan.", 400);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_UNITS_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * POST /api/units
 * Membuat satuan baru.
 * Role: ADMIN+
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const body = await request.json();
    const result = await createUnit(body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal membuat satuan.", 400);
    }

    return successResponse(result.data, result.message, 201);
  } catch (error) {
    console.error("[API_UNITS_POST_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
