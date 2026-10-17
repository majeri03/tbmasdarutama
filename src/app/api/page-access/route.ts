import { NextRequest } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse, forbiddenResponse, successResponse, errorResponse } from "@/lib/utils/api";
import { getPageAccessMatrix, updatePageAccess, getAllowedPagesForRole } from "@/lib/actions/page-access.actions";
import { Role } from "@prisma/client";

/**
 * GET /api/page-access
 * - If user is SUPER_ADMIN: returns full matrix + allowed pages.
 * - For others: returns only list of allowed page keys for their role.
 */
export async function GET() {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user) {
      return unauthorizedResponse();
    }

    const role = (session.user.role || "").toUpperCase().replace(/[\s-]+/g, "_") as Role;
    const allowedPages = await getAllowedPagesForRole(role);

    if (role === "SUPER_ADMIN") {
      const matrixResult = await getPageAccessMatrix();
      return successResponse({
        allowedPages,
        matrix: matrixResult.success ? matrixResult.data : [],
      });
    }

    return successResponse({ allowedPages });
  } catch (error) {
    console.error("[API_PAGE_ACCESS_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan server saat mengambil akses halaman.");
  }
}

/**
 * PUT /api/page-access
 * - Updates page access matrix (SUPER_ADMIN only).
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user) {
      return unauthorizedResponse();
    }

    if ((session.user.role || "").toUpperCase().replace(/[\s-]+/g, "_") !== "SUPER_ADMIN") {
      return forbiddenResponse("Hanya SUPER_ADMIN yang diizinkan mengubah konfigurasi ini.");
    }

    const body = await request.json();
    const { pageKey, role, enabled } = body;

    if (!pageKey || !role || typeof enabled !== "boolean") {
      return errorResponse("Parameter pageKey, role, dan enabled wajib disertakan dengan tipe data yang benar.", 400);
    }

    if (!["SUPER_ADMIN", "ADMIN", "KASIR"].includes(role)) {
      return errorResponse("Role tidak valid.", 400);
    }

    const result = await updatePageAccess(pageKey, role as Role, enabled);

    if (!result.success) {
      return errorResponse(result.error || "Gagal memperbarui konfigurasi.", 400);
    }

    return successResponse(result.data, "Akses halaman berhasil diperbarui.");
  } catch (error) {
    console.error("[API_PAGE_ACCESS_PUT_ERROR]", error);
    return errorResponse("Terjadi kesalahan server saat memperbarui akses halaman.");
  }
}
