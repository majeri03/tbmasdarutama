import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api";
import {
  getStoreSetting,
  updateStoreSetting,
} from "@/lib/actions/store-setting.actions";
import { hasPermission } from "@/lib/utils/role";

/**
 * GET /api/settings
 * Mengambil pengaturan toko (nama, logo, alamat, tema, dll).
 * Role: Semua role terautentikasi (KASIR, ADMIN, SUPER_ADMIN)
 */
export async function GET() {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "VIEW_SETTINGS")) return forbiddenResponse();

    const result = await getStoreSetting();

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil pengaturan toko.", 400);
    }

    // Jika belum ada data, kembalikan default kosong agar tidak error di client
    const data = result.data ?? {
      id: null,
      name: "Toko Masdar Utama",
      tagline: null,
      logoUrl: null,
      phone: null,
      email: null,
      address: null,
      city: null,
      province: null,
      postalCode: null,
      bankName: null,
      bankAccount: null,
      bankHolder: null,
      taxRate: 0,
      receiptFooter: null,
      currency: "IDR",
      createdAt: null,
      updatedAt: null,
    };

    return successResponse(data);
  } catch (error) {
    console.error("[API_SETTINGS_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * PUT /api/settings
 * Memperbarui pengaturan toko.
 * Role: SUPER_ADMIN only
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "MANAGE_STORE_SETTINGS")) return forbiddenResponse();

    const body = await request.json();
    const result = await updateStoreSetting(body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal menyimpan pengaturan toko.", 400);
    }

    return successResponse(result.data, "Pengaturan toko berhasil diperbarui.");
  } catch (error) {
    console.error("[API_SETTINGS_PUT_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
