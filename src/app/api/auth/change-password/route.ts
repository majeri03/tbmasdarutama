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

// FIX (22 Nov 2026): rate-limit ganti password — 10 percobaan per user
// dalam 1 jam, lalu 429. In-memory per instance, sama seperti rate-limit
// login (lihat src/app/api/auth/login/route.ts).
const CHANGE_PW_WINDOW_MS = 60 * 60 * 1000;
const CHANGE_PW_MAX_ATTEMPTS = 10;
const changePwAttempts = new Map<string, { count: number; firstAt: number }>();

function isChangePwRateLimited(userId: string): boolean {
  const entry = changePwAttempts.get(userId);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > CHANGE_PW_WINDOW_MS) {
    changePwAttempts.delete(userId);
    return false;
  }
  return entry.count >= CHANGE_PW_MAX_ATTEMPTS;
}

function recordChangePwAttempt(userId: string): void {
  const now = Date.now();
  const entry = changePwAttempts.get(userId);
  if (!entry || now - entry.firstAt > CHANGE_PW_WINDOW_MS) {
    changePwAttempts.set(userId, { count: 1, firstAt: now });
  } else {
    entry.count += 1;
  }
}

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
    // Rate-limit: hitung setiap percobaan (berhasil atau gagal).
    if (isChangePwRateLimited(session.user.id)) {
      return NextResponse.json(
        { success: false, error: "Terlalu banyak percobaan ganti password. Coba lagi 1 jam lagi." },
        { status: 429 }
      );
    }
    recordChangePwAttempt(session.user.id);
    // FIX (22 Nov 2026): minimum password baru naik dari 6 ke 8 karakter.
    if (newPassword.length < 8) {
      return validationErrorResponse("Password baru minimal 8 karakter.");
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
