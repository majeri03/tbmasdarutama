import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/utils/api";
import { getSalesmanDetail } from "@/lib/actions/salesman.actions";
import { hasMinimumRole } from "@/lib/utils/role";

// APK salesman fee (24 Nov 2026): route tipis REST di atas server action
// web getSalesmanDetail (patch web salesman-fee 24 Nov 2026). TIDAK ada
// logika fee baru di sini — transaksi, TOTAL penjualan, TOTAL fee dan
// fee per baris dihitung di SERVER oleh action yang sama dengan web,
// jadi angka APK = angka web. Fee TIDAK PERNAH dicetak di invoice.
// GET: KASIR+.

/**
 * GET /api/salesmen/[id]/detail
 * Detail salesman + semua penjualannya + total penjualan + total fee.
 * Role: KASIR+
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "KASIR")) return forbiddenResponse();

    const { id } = await params;
    const result = await getSalesmanDetail(id, session);

    if (!result.success) {
      if (result.error === "Salesman tidak ditemukan.") {
        return notFoundResponse("Salesman");
      }
      return errorResponse(result.error || "Gagal mengambil detail salesman.", 400);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_SALESMAN_DETAIL_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
