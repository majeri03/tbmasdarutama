import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/utils/api";

/**
 * POST /api/auth/change-password
 * Ganti password dari APK (SettingsScreen kirim { currentPassword, newPassword }).
 * Sebelumnya route ini tidak ada (404), jadi ganti password dari APK selalu gagal.
 * Catatan: action changePassword() yang lama butuh confirmPassword dan hanya
 * bisa dipanggil dari web (auth() NextAuth) — route ini ditulis langsung
 * dengan prisma + bcrypt supaya bisa dipakai sesi mobile juga.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user?.id) return unauthorizedResponse();

    const body = await request.json();
    const { currentPassword, newPassword } = body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return validationErrorResponse("Password lama dan password baru wajib diisi.");
    }
    if (newPassword.length < 6) {
      return validationErrorResponse("Password baru minimal 6 karakter.");
    }
    if (newPassword === currentPassword) {
      return validationErrorResponse("Password baru tidak boleh sama dengan password lama.");
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    });
    if (!user) return unauthorizedResponse("User tidak ditemukan.");

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return validationErrorResponse("Password lama tidak sesuai.");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return successResponse(null, "Password berhasil diubah. Silakan login ulang.");
  } catch (error) {
    console.error("[API_CHANGE_PASSWORD_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
