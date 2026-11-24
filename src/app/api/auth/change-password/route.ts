import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/utils/api";
import {
  isRateLimited,
  recordRateLimitHit,
} from "@/lib/utils/rate-limit";
import {
  PASSWORD_ERROR_MESSAGE,
  validatePassword,
} from "@/lib/utils/password";

// FIX (22 Nov 2026): rate-limit ganti password — 10 percobaan per user
// dalam 1 jam, lalu 429.
// SECURITY FIX (22 Nov 2026, pentest M28): hitungan pindah dari Map
// in-memory per instance ke tabel rate_limits di DB (berlaku
// antar-instance serverless).
const CHANGE_PW_WINDOW_MS = 60 * 60 * 1000;
const CHANGE_PW_MAX_ATTEMPTS = 10;

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
      currentPassword?: unknown;
      newPassword?: unknown;
    };

    // SECURITY FIX (22 Nov 2026, pentest L8 API): validasi tipe dulu —
    // body non-string sebelumnya bisa membuat bcrypt.compare melempar.
    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      !currentPassword ||
      !newPassword
    ) {
      return validationErrorResponse("Password lama dan password baru wajib diisi.");
    }
    // Rate-limit: hitung setiap percobaan (berhasil atau gagal).
    const changePwKey = `changepw:user:${session.user.id}`;
    if (await isRateLimited(changePwKey, CHANGE_PW_MAX_ATTEMPTS, CHANGE_PW_WINDOW_MS)) {
      return NextResponse.json(
        { success: false, error: "Terlalu banyak percobaan ganti password. Coba lagi 1 jam lagi." },
        { status: 429 }
      );
    }
    await recordRateLimitHit(changePwKey, CHANGE_PW_WINDOW_MS);
    // Kebijakan password (24 Nov 2026): min 8, maks 128, 1 huruf besar,
    // 1 angka, 1 simbol — sama seperti ganti password di web.
    if (!validatePassword(newPassword).valid) {
      return validationErrorResponse(PASSWORD_ERROR_MESSAGE);
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
    // FIX (22 Nov 2026): naikkan tokenVersion — semua token mobile lama
    // (termasuk yang mungkin dicuri) langsung tidak berlaku. Pengguna harus
    // login ulang di semua perangkat, termasuk HP ini.
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, tokenVersion: { increment: 1 } },
    });

    return successResponse(null, "Password berhasil diubah. Silakan login ulang.");
  } catch (error) {
    console.error("[API_CHANGE_PASSWORD_ERROR]", error);
    return errorResponse("Terjadi kesalahan internal server.");
  }
}
