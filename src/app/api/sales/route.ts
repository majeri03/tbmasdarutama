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

// Ubah tanggal menjadi akhir hari itu (23:59:59.999) supaya filter tanggal
// mencakup seluruh hari yang dipilih (M-31).
function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

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

    // M-31: dateTo harus akhir hari (23:59:59.999), bukan tengah malam —
    // kalau tidak, filter satu hari (mis. dari APK: dateFrom = dateTo =
    // hari yang sama) hampir tidak mengembalikan apa pun.
    const dateToEnd = params.dateTo ? endOfDay(params.dateTo) : undefined;

    const result = await getSales({
      search: params.search,
      page: params.page,
      limit: params.limit,
      customerId: params.customerId,
      cashierId: params.cashierId,
      paymentMethod: params.paymentMethod as PaymentMethod | undefined,
      status: params.status as SaleStatus | undefined,
      dateFrom: params.dateFrom,
      dateTo: dateToEnd,
      sortOrder: params.sortOrder as "asc" | "desc" | undefined,
    }, session);

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

    // Trigger Notifikasi ke Admin/Owner secara realtime
    try {
      interface SaleWithCustomer {
        id: string;
        invoiceNumber?: string;
        customer?: { name?: string } | null;
        grandTotal: number | string;
      }
      const saleData = result.data as unknown as SaleWithCustomer;
      const custName = saleData?.customer?.name || "Pelanggan";
      const invoiceNo = saleData?.invoiceNumber || "INV";
      const grandTotal = Number(saleData?.grandTotal || 0);
      const saleId = saleData?.id || "";
      if (saleId) {
        const { NotificationService } = await import("@/lib/services/notification.service");
        NotificationService.onNewOrder(saleId, invoiceNo, custName, grandTotal).catch((e) =>
          console.error("[Notif] Error notifying new order:", e)
        );
      }
    } catch (e) {
      console.error("[Notif] Order notification dispatch error:", e);
    }

    return successResponse(result.data, result.message, 201);
  } catch (error) {
    console.error("[API_SALES_POST_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
