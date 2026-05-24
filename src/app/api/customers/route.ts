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

    const result = await getCustomers({ status: statusFilter });

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengambil data customer.", 400);
    }

    return successResponse(result.data);
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
