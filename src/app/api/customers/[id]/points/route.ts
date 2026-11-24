import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api";
import { adjustCustomerPoints } from "@/lib/actions/customer.actions";
import { hasMinimumRole } from "@/lib/utils/role";

// BARU 24 Nov 2026 (pisah Sales & Poin): endpoint penyesuaian manual poin
// untuk APK — sebelumnya adjustCustomerPoints hanya bisa dipanggil sebagai
// server action dari web (modal detail customer + halaman /dashboard/points).
// Logika TIDAK berubah: action yang sama, aturan yang sama.
// POST: SUPER_ADMIN saja. Customer UMUM ditolak, saldo tidak pernah < 0.

/**
 * POST /api/customers/[id]/points
 * Body: { delta: number } — positif = tambah, negatif = kurang, bukan nol.
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
    const delta = Number(body?.delta);
    if (!Number.isInteger(delta) || delta === 0) {
      return errorResponse("Jumlah penyesuaian poin harus bilangan bulat bukan nol.", 400);
    }

    const result = await adjustCustomerPoints(id, delta, session);

    if (!result.success) {
      return errorResponse(result.error || "Gagal menyesuaikan poin customer.", 400);
    }

    return successResponse(result.data, result.message);
  } catch (error) {
    console.error("[API_CUSTOMER_POINTS_POST_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
