import { NextRequest, NextResponse } from "next/server";
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

// Ubah tanggal menjadi akhir hari itu (23:59:59.999) supaya filter tanggal
// mencakup seluruh hari yang dipilih (M-31).
function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

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

    // M-31: dateTo harus akhir hari (23:59:59.999), bukan tengah malam —
    // kalau tidak, filter satu hari hampir tidak mengembalikan apa pun.
    const dateToEnd = params.dateTo ? endOfDay(params.dateTo) : undefined;

    const result = await getAllPurchases({
      search: params.search,
      page: params.page,
      limit: params.limit,
      supplierId: params.supplierId,
      status: params.status as PurchaseStatus | undefined,
      dateFrom: params.dateFrom,
      dateTo: dateToEnd,
    }, session);

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil data purchase.", 400);
    }

    // M-27 FIX (Nov 2026): pagination dari getAllPurchases sebelumnya
    // dibuang oleh successResponse(result.data) — APK hanya melihat 10 PO
    // pertama. Kembalikan di level atas; bentuk data tetap array.
    return NextResponse.json(
      { success: true, data: result.data, pagination: result.pagination },
      { status: 200 }
    );
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
    const result = await createPurchase(body, session);

    if (!result.success) {
      return errorResponse(result.error || "Gagal membuat Purchase Order.", 400);
    }

    return successResponse(result.data, result.message, 201);
  } catch (error) {
    console.error("[API_PURCHASES_POST_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
