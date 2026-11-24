import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api";
import {
  getSalesmanFeeSetting,
  updateSalesmanFeeSetting,
} from "@/lib/actions/salesman.actions";
import { hasMinimumRole } from "@/lib/utils/role";

// APK salesman fee (24 Nov 2026): route tipis REST di atas server action
// web (getSalesmanFeeSetting / updateSalesmanFeeSetting, patch web
// salesman-fee 24 Nov 2026). TIDAK ada logika fee baru di sini —
// aturan (default MATI, 2%; global MATI = fee Rp0 semua invoice;
// fee = floor(grandTotal x persen / 100)) tetap di salesman.actions.ts.
// GET /api/settings TIDAK dipakai untuk fee: storeSettingSchema tidak
// mengenal field salesmanFee* (zod membuangnya), jadi PUT /api/settings
// tidak akan menyimpan fee. Karena itu fee punya route sendiri.
// GET: KASIR+ (KASIR butuh melihat status fee di layar Salesman).
// PUT: SUPER_ADMIN saja.

/**
 * GET /api/salesmen/fee-setting
 * Pengaturan fee salesman global { enabled, percent }.
 * Role: KASIR+
 */
export async function GET() {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "KASIR")) return forbiddenResponse();

    const result = await getSalesmanFeeSetting(session);

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil pengaturan fee salesman.", 400);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_SALESMAN_FEE_SETTING_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * PUT /api/salesmen/fee-setting
 * Body: { enabled: boolean, percent: number (0-100) }.
 * Role: SUPER_ADMIN
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "SUPER_ADMIN")) return forbiddenResponse();

    const body = await request.json();
    const result = await updateSalesmanFeeSetting(body, session);

    if (!result.success) {
      return errorResponse(result.error || "Gagal menyimpan pengaturan fee salesman.", 400);
    }

    return successResponse(result.data, result.message);
  } catch (error) {
    console.error("[API_SALESMAN_FEE_SETTING_PUT_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
