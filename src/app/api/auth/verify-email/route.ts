import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/utils/api";
import { verifyEmailOtp } from "@/lib/actions/email-verification.actions";

// APK OTP (24 Nov 2026): route tipis REST di atas server action web
// verifyEmailOtp (PKG-I 23 Nov 2026 + patch web OTP 24 Nov 2026).
// TIDAK ada skema OTP baru di sini: kode 6 digit, hash SHA-256,
// kedaluwarsa 15 menit, maks 5x salah, rate limit 10x/jam per IP —
// semuanya tetap di dalam verifyEmailOtp. Route ini PUBLIK (tanpa login),
// sama seperti halaman web /verify-email.
// Catatan: verifyEmailOtp memakai headers() untuk rate limit per IP;
// di dalam route handler, headers() membaca header request ini.

// SECURITY: pesan gagal sengaja generik ("Kode tidak valid atau sudah
// kedaluwarsa") supaya tidak membocorkan email mana yang terdaftar.

/**
 * POST /api/auth/verify-email
 * Body: { email: string, otp: string (6 digit) }.
 * Sukses: akun aktif + emailVerifiedAt terisi, lalu APK bisa login.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email : "";
    const otp = typeof body?.otp === "string" ? body.otp : "";

    if (!email || !otp) {
      return errorResponse("Email dan kode OTP wajib diisi.", 400);
    }

    const result = await verifyEmailOtp(email, otp);

    if (!result.success) {
      return errorResponse(result.error || "Kode tidak valid atau sudah kedaluwarsa", 400);
    }

    return successResponse(null, result.message);
  } catch (error) {
    console.error("[API_AUTH_VERIFY_EMAIL_ERROR]", error);
    return errorResponse("Terjadi kesalahan server saat verifikasi email.");
  }
}
