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

    // Jika belum ada data, kembalikan default lengkap agar tidak error di client
    const data = result.data ?? {
      id: null,
      name: "TB Masdar Utama",
      tagline: "Distributor Bahan Bangunan Terpercaya",
      logoUrl: null,
      phone: "6285398346677",
      email: null,
      address: "Jl. Poros Maros - Pangkep, Maccini Baji, Kec. Lau, Kabupaten Maros, Sulawesi Selatan",
      city: "Maros",
      province: "Sulawesi Selatan",
      postalCode: null,
      bankName: "BCA",
      bankAccount: "1234567890",
      bankHolder: "TB Masdar Utama",
      taxRate: 0,
      receiptFooter: null,
      currency: "IDR",
      invoiceLayoutType: "INVOICE_BESAR",
      invoicePaperSize: "58mm",
      invoiceDocumentPaperSize: "A4",
      invoiceShowHeader: true,
      invoiceShowLogo: true,
      invoiceShowCustomerInfo: true,
      invoiceShowPaymentInfo: true,
      invoiceShowSignature: true,
      invoiceShowFooter: true,
      invoiceFooterTerms: "BARANG YANG SUDAH DIBELI TIDAK DAPAT DITUKAR/DIKEMBALIKAN KECUALI ADA PERJANJIAN.",
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
