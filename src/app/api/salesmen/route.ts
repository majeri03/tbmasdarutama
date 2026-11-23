import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api";
import {
  getSalesmen,
  createSalesman,
} from "@/lib/actions/salesman.actions";
import { hasMinimumRole } from "@/lib/utils/role";

// PKG-A (23 Nov 2026, perbaikan 7 item #5): API salesman.
// GET: KASIR+ (kasir butuh daftarnya di POS; ?activeOnly=true hanya yang aktif).
// POST: SUPER_ADMIN saja (kelola salesman dari tab Sales di Pengaturan).

/**
 * GET /api/salesmen?activeOnly=true
 * Mengambil daftar salesman.
 * Role: KASIR+
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "KASIR")) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    // parseSearchParams tidak punya field activeOnly — baca langsung.
    const activeOnly = searchParams.get("activeOnly") === "true";

    const result = await getSalesmen({ activeOnly }, session);

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil data salesman.", 400);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_SALESMEN_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * POST /api/salesmen
 * Membuat salesman baru.
 * Role: SUPER_ADMIN
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "SUPER_ADMIN")) return forbiddenResponse();

    const body = await request.json();
    const result = await createSalesman(body, session);

    if (!result.success) {
      return errorResponse(result.error || "Gagal membuat salesman.", 400);
    }

    return successResponse(result.data, result.message, 201);
  } catch (error) {
    console.error("[API_SALESMEN_POST_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
