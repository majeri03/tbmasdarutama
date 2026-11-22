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
  getAllDeliveryOrders,
  createDeliveryOrder,
} from "@/lib/actions/delivery-order.actions";
import { hasPermission } from "@/lib/utils/role";
import { DeliveryStatus } from "@prisma/client";

// Ubah tanggal menjadi akhir hari itu (23:59:59.999) supaya filter tanggal
// mencakup seluruh hari yang dipilih (M-31).
function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

/**
 * GET /api/delivery-orders
 * Mengambil daftar Surat Jalan dengan filter.
 * Role: ADMIN+ (VIEW_DELIVERY_ORDERS)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "VIEW_DELIVERY_ORDERS")) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);

    // M-33 FIX (Nov 2026): APK mengirim startDate/endDate, backend hanya
    // membaca dateFrom/dateTo — filter tanggal pengiriman diam-diam diabaikan.
    // Terima keduanya (dateFrom/dateTo tetap diutamakan kalau dua-duanya ada).
    const dateFrom =
      params.dateFrom ??
      (searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined);
    // M-31: dateTo harus akhir hari, bukan tengah malam.
    const dateToRaw =
      params.dateTo ??
      (searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined);
    const dateTo = dateToRaw ? endOfDay(dateToRaw) : undefined;

    // FIX (22 Nov 2026): teruskan page/limit hanya kalau diminta eksplisit
    // di query — parseSearchParams memberi default limit 10, dan itu akan
    // memotong daftar jadi 10 baris kalau diteruskan mentah-mentah.
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    const result = await getAllDeliveryOrders({
      search: params.search,
      customerId: params.customerId,
      status: params.status as DeliveryStatus | undefined,
      dateFrom,
      dateTo,
      page: pageParam ? parseInt(pageParam) : undefined,
      limit: limitParam ? parseInt(limitParam) : undefined,
    }, session);

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil data surat jalan.", 400);
    }

    // `data` tetap array (APK mengharapkan array) — info paginasi ada di
    // field `pagination` tingkat atas (lihat tipe ApiResponse).
    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("[API_DELIVERY_ORDERS_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * POST /api/delivery-orders
 * Membuat Surat Jalan baru (+ auto-create Invoice & Debt jika tanpa Sale).
 * Role: ADMIN+ (CREATE_DELIVERY_ORDER)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "CREATE_DELIVERY_ORDER")) return forbiddenResponse();

    const body = await request.json();
    const result = await createDeliveryOrder(body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal membuat surat jalan.", 400);
    }

    return successResponse(result.data, result.message, 201);
  } catch (error) {
    console.error("[API_DELIVERY_ORDERS_POST_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
