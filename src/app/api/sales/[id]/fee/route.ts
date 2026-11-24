import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api";
import { updateSaleFeeOverride } from "@/lib/actions/salesman.actions";
import { hasMinimumRole } from "@/lib/utils/role";

// APK salesman fee (24 Nov 2026): route tipis REST di atas server action
// web updateSaleFeeOverride (patch web salesman-fee 24 Nov 2026). TIDAK
// ada logika fee baru di sini. Penjualan tanpa salesman tetap ditolak
// oleh action. Fee TIDAK PERNAH dicetak di invoice.
// POST: SUPER_ADMIN saja.

/**
 * POST /api/sales/[id]/fee
 * Body: { enabled?: boolean | null, percent?: number | null }.
 * null = ikut global (hapus override); field yang tidak dikirim = tidak diubah.
 * Role: SUPER_ADMIN
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "SUPER_ADMIN")) return forbiddenResponse();

    const { id } = await params;
    const body = await request.json();
    const result = await updateSaleFeeOverride(id, body, session);

    if (!result.success) {
      return errorResponse(result.error || "Gagal menyimpan pengaturan fee invoice.", 400);
    }

    return successResponse(null, result.message);
  } catch (error) {
    console.error("[API_SALE_FEE_POST_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
