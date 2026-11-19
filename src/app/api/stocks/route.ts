import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  parseSearchParams,
} from "@/lib/utils/api";
import {
  getStockMovements,
  createStockAdjustment,
} from "@/lib/actions/stock.actions";
import { hasPermission } from "@/lib/utils/role";
import { MovementType } from "@prisma/client";

// Ubah tanggal menjadi akhir hari itu (23:59:59.999) supaya filter tanggal
// mencakup seluruh hari yang dipilih (M-31).
function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

/**
 * GET /api/stocks
 * Mengambil riwayat pergerakan stok (Stock Movements) dengan filter.
 * Role: KASIR+
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "VIEW_STOCK")) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);

    const result = await getStockMovements({
      search: params.search,
      productId: params.productId,
      movementType: searchParams.get("type") as MovementType | undefined,
      dateFrom: searchParams.get("dateFrom") ? new Date(searchParams.get("dateFrom")!) : undefined,
      // M-31: dateTo harus akhir hari, bukan tengah malam.
      dateTo: searchParams.get("dateTo") ? endOfDay(new Date(searchParams.get("dateTo")!)) : undefined,
      page: params.page,
      limit: params.limit,
    }, session);

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil data stok.", 400);
    }

    // M-26 FIX (Nov 2026): pagination dari getStockMovements sebelumnya
    // dibuang oleh successResponse(result.data) — Stock Opname di APK hanya
    // melihat 15 movement pertama. Bentuk data mengikuti pola route sales
    // yang sudah benar ({movements, pagination}) supaya StockOpnameScreen
    // (membaca rawData.movements & rawData.pagination) langsung jalan, plus
    // pagination di level atas (tipe ApiResponse).
    return NextResponse.json(
      {
        success: true,
        data: { movements: result.data, pagination: result.pagination },
        pagination: result.pagination,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API_STOCKS_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * POST /api/stocks
 * Melakukan Stock Adjustment / Stock Opname.
 * Role: ADMIN+
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "ADJUST_STOCK")) return forbiddenResponse();

    const body = await request.json();
    const result = await createStockAdjustment(body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal melakukan penyesuaian stok.", 400);
    }

    return successResponse(result.data, result.message, 201);
  } catch (error) {
    console.error("[API_STOCKS_POST_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
