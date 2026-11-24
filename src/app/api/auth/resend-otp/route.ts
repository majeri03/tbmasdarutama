import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/utils/api";
import { resendVerificationOtp } from "@/lib/actions/email-verification.actions";

// APK OTP (24 Nov 2026): route tipis REST di atas server action web
// resendVerificationOtp (PKG-I 23 Nov 2026). TIDAK ada skema OTP baru:
// kode 6 digit, hash SHA-256, kedaluwarsa 15 menit — sama seperti web.
// Rate limit kirim ulang tetap di dalam action: 1x/menit dan 5x/jam
// per email. Route ini PUBLIK (tanpa login), sama seperti halaman web
// /verify-email.
// SECURITY: jawaban sukses sengaja generik (pesan yang sama untuk email
// terdaftar/tidak terdaftar/sudah aktif) supaya tidak membocorkan email
// mana yang punya akun — meniru pola requestPasswordReset.

/**
 * POST /api/auth/resend-otp
 * Body: { email: string }.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email : "";

    if (!email) {
      return errorResponse("Email wajib diisi.", 400);
    }

    const result = await resendVerificationOtp(email);

    if (!result.success) {
      return errorResponse(result.error || "Gagal mengirim ulang kode verifikasi.", 400);
    }

    return successResponse(null, result.message);
  } catch (error) {
    console.error("[API_AUTH_RESEND_OTP_ERROR]", error);
    return errorResponse("Terjadi kesalahan server saat mengirim ulang kode.");
  }
}
