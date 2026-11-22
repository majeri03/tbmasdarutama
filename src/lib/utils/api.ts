import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { hasMinimumRole, hasPermission, type Permission } from "@/lib/utils/role";
import { Role } from "@prisma/client";
import { verifyMobileToken } from "@/lib/utils/jwt";

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

/**
 * Validates the session and returns the authenticated user.
 * Returns null if not authenticated.
 */
export async function getAuthenticatedUser() {
  // 1. Coba dari NextAuth session cookie (Web dashboard)
  try {
    const session = await auth();
    if (session?.user?.id) return session;
  } catch {
    // Sesi NextAuth tidak aktif
  }

  // 2. Coba dari Authorization header atau Cookie (Mobile App)
  try {
    const reqHeaders = await headers();
    let token: string | null = null;

    const authHeader = reqHeaders.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }

    if (!token) {
      const cookieHeader = reqHeaders.get("cookie");
      if (cookieHeader) {
        const match = cookieHeader.match(/(?:__Secure-)?authjs\.session-token=([^;]+)/);
        if (match) token = match[1];
      }
    }

    if (token) {
      const payload = await verifyMobileToken(token);
      if (payload) {
        return {
          user: {
            id: payload.id,
            email: payload.email,
            name: payload.name,
            role: payload.role as Role,
          },
        };
      }
    }
  } catch (err) {
    console.error("[GET_AUTH_USER_HEADER_CHECK_ERROR]", err);
  }

  return null;
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

/**
 * PENTEST FIX (22 Nov 2026, M11/M20 + L16): page/limit di-clamp supaya
 * tidak bisa dipakai dump massal (?limit=1000000) dan nilai non-angka
 * (NaN) tidak diteruskan ke Prisma (dulu jadi 500). Tanggal tidak valid
 * juga diubah jadi undefined, bukan Invalid Date.
 */
export function parsePageLimit(searchParams: URLSearchParams): { page: number; limit: number } {
  const rawPage = parseInt(searchParams.get("page") || "", 10);
  const rawLimit = parseInt(searchParams.get("limit") || "", 10);
  const page = Number.isFinite(rawPage) ? Math.min(10000, Math.max(1, rawPage)) : 1;
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 10;
  return { page, limit };
}

function parseOptionalDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function parseSearchParams(searchParams: URLSearchParams) {
  const { page, limit } = parsePageLimit(searchParams);
  return {
    search: searchParams.get("search") || undefined,
    page,
    limit,
    categoryId: searchParams.get("categoryId") || undefined,
    supplierId: searchParams.get("supplierId") || undefined,
    customerId: searchParams.get("customerId") || undefined,
    cashierId: searchParams.get("cashierId") || undefined,
    status: searchParams.get("status") || undefined,
    isActive: searchParams.has("isActive")
      ? searchParams.get("isActive") === "true"
      : undefined,
    lowStock: searchParams.get("lowStock") === "true",
    dateFrom: parseOptionalDate(searchParams.get("dateFrom")),
    dateTo: parseOptionalDate(searchParams.get("dateTo")),
    paymentMethod: searchParams.get("paymentMethod") || undefined,
    includeSubCategories: searchParams.get("includeSubCategories") !== "false",
    productId: searchParams.get("productId") || undefined,
    sortOrder: searchParams.get("sortOrder") || undefined,
  };
}
