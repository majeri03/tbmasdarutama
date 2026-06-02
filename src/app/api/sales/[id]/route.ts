import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/utils/api";
import { getSaleById, updateSale } from "@/lib/actions/sale.actions";
import { hasPermission } from "@/lib/utils/role";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/sales/[id]
 * Detail invoice penjualan untuk preview/cetak.
 * Role: KASIR+ (VIEW_SALES)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "VIEW_SALES")) return forbiddenResponse();

    const { id } = await context.params;
    const result = await getSaleById(id);

    if (!result.success) {
      return notFoundResponse("Invoice penjualan");
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_SALE_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * PUT /api/sales/[id]
 * Edit transaksi penjualan. Memerlukan validasi biometrik dari sisi client.
 * Role: KASIR+ (CREATE_SALE)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "CREATE_SALE")) return forbiddenResponse();

    const { id } = await context.params;
    const body = await request.json();

    const result = await updateSale(id, body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengedit transaksi", 400);
    }

    return successResponse(result.data, result.message);
  } catch (error) {
    console.error("[API_SALE_PUT_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
