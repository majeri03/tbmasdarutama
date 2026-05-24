import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasMinimumRole, hasPermission, type Permission } from "@/lib/utils/role";
import { Role } from "@prisma/client";

// ==================== STANDARD API RESPONSE ====================
export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

// ==================== RESPONSE HELPERS ====================
export function successResponse<T>(data: T, message?: string, status = 200) {
  const body: ApiResponse<T> = { success: true, data };
  if (message) body.message = message;
  return NextResponse.json(body, { status });
}

export function errorResponse(error: string, status = 500) {
  return NextResponse.json(
    { success: false, error } satisfies ApiResponse,
    { status }
  );
}

export function unauthorizedResponse(message = "Unauthorized. Token tidak valid atau sesi telah kedaluwarsa.") {
  return NextResponse.json(
    { success: false, error: message } satisfies ApiResponse,
    { status: 401 }
  );
}

export function forbiddenResponse(message = "Forbidden. Anda tidak memiliki akses ke resource ini.") {
  return NextResponse.json(
    { success: false, error: message } satisfies ApiResponse,
    { status: 403 }
  );
}

export function notFoundResponse(resource = "Resource") {
  return NextResponse.json(
    { success: false, error: `${resource} tidak ditemukan.` } satisfies ApiResponse,
    { status: 404 }
  );
}

export function validationErrorResponse(message: string) {
  return NextResponse.json(
    { success: false, error: message } satisfies ApiResponse,
    { status: 400 }
  );
}

// ==================== AUTH GUARD ====================
/**
 * Validates the session and returns the authenticated user.
 * Returns null if not authenticated.
 */
export async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session;
}

/**
 * Validates the session AND checks minimum role.
 * Returns the session if authorized, null otherwise.
 */
export async function requireAuthAndRole(minimumRole: Role) {
  const session = await getAuthenticatedUser();
  if (!session) return null;
  if (!hasMinimumRole(session, minimumRole)) return null;
  return session;
}

/**
 * Validates the session AND checks specific permission.
 * Returns the session if authorized, null otherwise.
 */
export async function requireAuthAndPermission(permission: Permission) {
  const session = await getAuthenticatedUser();
  if (!session) return null;
  if (!hasPermission(session, permission)) return null;
  return session;
}

// ==================== PARSE SEARCH PARAMS ====================
export function parseSearchParams(searchParams: URLSearchParams) {
  return {
    search: searchParams.get("search") || undefined,
    page: parseInt(searchParams.get("page") || "1"),
    limit: parseInt(searchParams.get("limit") || "10"),
    categoryId: searchParams.get("categoryId") || undefined,
    supplierId: searchParams.get("supplierId") || undefined,
    customerId: searchParams.get("customerId") || undefined,
    cashierId: searchParams.get("cashierId") || undefined,
    status: searchParams.get("status") || undefined,
    isActive: searchParams.has("isActive")
      ? searchParams.get("isActive") === "true"
      : undefined,
    lowStock: searchParams.get("lowStock") === "true",
    dateFrom: searchParams.get("dateFrom")
      ? new Date(searchParams.get("dateFrom")!)
      : undefined,
    dateTo: searchParams.get("dateTo")
      ? new Date(searchParams.get("dateTo")!)
      : undefined,
    paymentMethod: searchParams.get("paymentMethod") || undefined,
    includeSubCategories: searchParams.get("includeSubCategories") !== "false",
    productId: searchParams.get("productId") || undefined,
    sortOrder: searchParams.get("sortOrder") || undefined,
  };
}
