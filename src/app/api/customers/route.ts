import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  parseSearchParams,
} from "@/lib/utils/api";
import { getCustomers, createCustomer } from "@/lib/actions/customer.actions";
import { hasMinimumRole } from "@/lib/utils/role";

/**
 * GET /api/customers
 * Mengambil daftar customer.
 * Role: KASIR+ (semua role)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "KASIR")) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);

    // Map isActive to status filter
    let statusFilter: "ACTIVE" | "INACTIVE" | undefined;
    if (params.isActive === true) statusFilter = "ACTIVE";
    else if (params.isActive === false) statusFilter = "INACTIVE";

    const result = await getCustomers({ status: statusFilter }, session);

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil data customer.", 400);
    }

    // M-32 FIX (Nov 2026): param `search` sebelumnya diterima lalu dibuang —
    // getCustomers tidak punya filter search, jadi pencarian pelanggan di APK
    // tidak pernah memfilter apa pun. getCustomers ada di customer.actions.ts
    // (di luar cakupan patch ini), jadi filter dilakukan di sini: daftar
    // pelanggan toko kecil (5 pelanggan saat audit), dan hasilnya sama dengan
    // filter contains-insensitive di nama/telepon/kode.
    // TODO untuk pemilik customer.actions.ts: pindahkan filter ini ke
    // getCustomers (where OR name/phone/code contains) supaya tetap cepat
    // kalau pelanggan sudah banyak.
    let data = result.data as Array<{ name?: string; phone?: string | null; code?: string }>;
    if (params.search) {
      const q = params.search.toLowerCase();
      data = data.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.code?.toLowerCase().includes(q)
      );
    }

    return successResponse(data);
  } catch (error) {
    console.error("[API_CUSTOMERS_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * POST /api/customers
 * Membuat customer baru.
 * Role: KASIR+
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "KASIR")) return forbiddenResponse();

    const body = await request.json();
    const result = await createCustomer(body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal membuat customer.", 400);
    }

    return successResponse(result.data, result.message, 201);
  } catch (error) {
    console.error("[API_CUSTOMERS_POST_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
