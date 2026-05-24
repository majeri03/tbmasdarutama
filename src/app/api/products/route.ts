import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  parseSearchParams,
} from "@/lib/utils/api";
import { getProducts, createProduct } from "@/lib/actions/product.actions";
import { hasMinimumRole, hasPermission } from "@/lib/utils/role";

/**
 * GET /api/products
 * Mengambil daftar produk dengan filter, search, dan pagination.
 * Role: KASIR+ (semua role terautentikasi)
 * KASIR: buyPrice otomatis 0 (ditangani oleh action)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasPermission(session, "VIEW_PRODUCTS")) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);

    const result = await getProducts({
      search: params.search,
      page: params.page,
      limit: params.limit,
      categoryId: params.categoryId,
      supplierId: params.supplierId,
      isActive: params.isActive !== undefined ? params.isActive : null,
      lowStock: params.lowStock,
    });

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil data produk.", 400);
    }

    return successResponse(result.data, undefined, 200);
  } catch (error) {
    console.error("[API_PRODUCTS_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}

/**
 * POST /api/products
 * Membuat produk baru beserta unit dan gambar dalam satu transaksi.
 * Role: ADMIN+
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const body = await request.json();
    const result = await createProduct(body);

    if (!result.success) {
      return errorResponse(result.error || "Gagal membuat produk.", 400);
    }

    return successResponse(result.data, result.message, 201);
  } catch (error) {
    console.error("[API_PRODUCTS_POST_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
