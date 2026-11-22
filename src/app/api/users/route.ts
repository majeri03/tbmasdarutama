import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api";
import { hasMinimumRole } from "@/lib/utils/role";

/**
 * GET /api/users
 * Daftar user aktif untuk dropdown penugasan sopir di halaman Armada
 * (sopir utama + pendamping). ADMIN+ saja.
 * Hanya id, nama, role, dan no HP — TANPA password/hash/token apa pun.
 * Tidak mengubah endpoint push-token (src/app/api/users/push-token).
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    if (!hasMinimumRole(session, "ADMIN")) return forbiddenResponse();

    const users = await prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true, phone: true },
    });

    return successResponse(users);
  } catch (error) {
    console.error("[API_USERS_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan saat memuat daftar pengguna.");
  }
}
