/**
 * Verifikasi token Cloudflare Turnstile (bot check) — hardening 24 Nov 2026.
 *
 * Dipakai HANYA oleh form web: login web, lupa password, reset password,
 * verifikasi email + kirim ulang OTP. Login mobile (APK,
 * /api/auth/login) TIDAK memakai ini — APK tidak punya widget Turnstile.
 *
 * FAIL OPEN kalau kunci belum diisi: kalau TURNSTILE_SECRET_KEY tidak ada
 * di env, verifikasi dilewati dan fungsi mengembalikan true, supaya situs
 * tetap jalan sampai admin memasang kuncinya (lihat hardening-NOTES.md).
 * Kalau kunci SUDAH diisi, token yang kosong / tidak valid / gagal
 * diverifikasi DITOLAK (fail closed) — bot tidak bisa lolos hanya karena
 * Cloudflare sedang bermasalah.
 *
 * Verifikasi dilakukan server-side ke
 * https://challenges.cloudflare.com/turnstile/v0/siteverify — token dari
 * browser TIDAK PERNAH dipercaya begitu saja.
 */
const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const TURNSTILE_ERROR_MESSAGE =
  "Verifikasi keamanan gagal. Muat ulang halaman lalu coba lagi.";

export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteIp?: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn(
      "[TURNSTILE_NOT_CONFIGURED] TURNSTILE_SECRET_KEY belum diisi — cek bot dilewati (fail open). Pasang kunci di Vercel, lihat hardening-NOTES.md."
    );
    return true;
  }
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (!data.success) {
      console.warn("[TURNSTILE_FAILED]", data["error-codes"] ?? []);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[TURNSTILE_VERIFY_ERROR]", error);
    return false;
  }
}
