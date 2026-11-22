import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api";

/**
 * POST /api/auth/logout
 * Logout dari APK: menaikkan User.tokenVersion pemanggil, sehingga SEMUA
 * token mobile milik akun ini langsung tidak berlaku (verifyMobileToken
 * menolak tv yang tidak sama). Dipakai saat logout di APK — APK juga harus
 * menghapus sessionToken yang tersimpan di SecureStore-nya sendiri.
 * Juga menghapus cookie sesi web kalau ada (best effort).
 * FIX (22 Nov 2026): sebelumnya tidak ada cara mencabut token mobile —
 * token curang tetap berlaku sampai 30 hari.
 */
export async function POST(_request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user?.id) return unauthorizedResponse();

    await prisma.user.update({
      where: { id: session.user.id },
      data: { tokenVersion: { increment: 1 } },
    });

    const response = successResponse(null, "Logout berhasil. Semua sesi akun ini telah dicabut.");
    response.cookies.delete("authjs.session-token");
    response.cookies.delete("__Secure-authjs.session-token");
    return response;
  } catch (error) {
    console.error("[API_AUTH_LOGOUT_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
