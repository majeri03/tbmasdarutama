import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  parseSearchParams,
} from "@/lib/utils/api";
import { getSales, createSale } from "@/lib/actions/sale.actions";
import { hasPermission } from "@/lib/utils/role";
import { PaymentMethod, SaleStatus } from "@prisma/client";

/**
 * GET /api/sales
 * Mengambil riwayat penjualan dengan filter lengkap.
 * Role: KASIR+ (semua role terautentikasi)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "VIEW_SALES")) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);

    const result = await getSales({
      search: params.search,
      page: params.page,
      limit: params.limit,
      customerId: params.customerId,
      cashierId: params.cashierId,
      paymentMethod: params.paymentMethod as PaymentMethod | undefined,
      status: params.status as SaleStatus | undefined,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      sortOrder: params.sortOrder as "asc" | "desc" | undefined,
    });

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil data penjualan.", 400);
    }

    return successResponse({
      sales: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("[API_SALES_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * POST /api/sales
 * Checkout POS — Mengurangi stok, mencatat StockMovement OUT,
 * CashMovement, dan otomatis membuat CustomerDebt jika CREDIT.
 * Role: ADMIN+ (berdasarkan permission CREATE_SALE)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "CREATE_SALE")) return forbiddenResponse();

    const body = await request.json();
    const result = await createSale(body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal menyimpan transaksi.", 400);
    }

    return successResponse(result.data, result.message, 201);
  } catch (error) {
    console.error("[API_SALES_POST_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
