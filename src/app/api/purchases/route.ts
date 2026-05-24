import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  parseSearchParams,
} from "@/lib/utils/api";
import { getAllPurchases, createPurchase } from "@/lib/actions/purchase.actions";
import { hasMinimumRole } from "@/lib/utils/role";
import { PurchaseStatus } from "@prisma/client";

/**
 * GET /api/purchases
 * Mengambil daftar Purchase Order dengan filter.
 * Role: ADMIN+
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);

    const result = await getAllPurchases({
      search: params.search,
      page: params.page,
      limit: params.limit,
      supplierId: params.supplierId,
      status: params.status as PurchaseStatus | undefined,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    });

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil data purchase.", 400);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("[API_PURCHASES_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * POST /api/purchases
 * Pencatatan barang masuk dari Supplier (Menambah stok, StockMovement IN, SupplierDebt).
 * Role: ADMIN+
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const body = await request.json();
    const result = await createPurchase(body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal membuat Purchase Order.", 400);
    }

    return successResponse(result.data, result.message, 201);
  } catch (error) {
    console.error("[API_PURCHASES_POST_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
