"use server";

import prisma from "@/lib/prisma";
import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import {
  getClientIp,
  isRateLimited,
  recordRateLimitHit,
} from "@/lib/utils/rate-limit";
import {
  hashOtp,
  sendVerificationOtp,
  OTP_MAX_ATTEMPTS,
} from "@/lib/services/email-verification.service";
import {
  verifyTurnstileToken,
  TURNSTILE_ERROR_MESSAGE,
} from "@/lib/utils/turnstile";

// PKG-I (23 Nov 2026, OTP verifikasi email akun baru).
// Alur: SUPER_ADMIN membuat akun -> akun dibuat isActive=false + kode OTP
// 6 digit dikirim ke emailnya -> pemilik akun memasukkan kode di halaman
// publik /verify-email -> akun aktif dan bisa login. Akun yang belum
// terverifikasi tetap ditolak login (sudah begitu dari dulu, auth.ts
// dan jwt.ts tidak diubah).
//
// Keamanan (meniru pola reset password):
// - OTP disimpan sebagai hash SHA-256, bukan kode mentah.
// - Rate limit: verifikasi 10x/jam per IP; kirim ulang 1x/menit dan
//   5x/jam per email.
// - Pesan untuk email tidak terdaftar / sudah aktif SENGAJA sama dengan
//   pesan sukses, supaya penyerang tidak bisa menebak email mana yang
//   punya akun.

// Pesan yang SAMA untuk email terdaftar/tidak terdaftar/sudah aktif.
const RESEND_GENERIC_MESSAGE =
  "Jika email terdaftar dan belum terverifikasi, kode baru telah dikirim ke email Anda";
// HARDENING (24 Nov 2026, anti-enumeration): SATU pesan gagal yang sama
// untuk SEMUA kegagalan verifikasi — email tidak terdaftar, akun sudah
// aktif, token kedaluwarsa, kode salah, sampai batas percobaan habis.
// Sebelumnya tiap kondisi punya pesan berbeda ("Email sudah
// terverifikasi", "Kode sudah kedaluwarsa", "Kode salah..."), sehingga
// penyerang bisa menebak email mana yang punya akun + token aktif.
// Penghitung percobaan salah per token (OTP_MAX_ATTEMPTS) tetap jalan;
// hanya pesannya yang disamakan.
const VERIFY_INVALID_MESSAGE = "Kode tidak valid atau sudah kedaluwarsa";

const VERIFY_IP_WINDOW_MS = 60 * 60 * 1000;
const VERIFY_IP_MAX = 10;
const RESEND_MIN_WINDOW_MS = 60 * 1000;
const RESEND_MIN_MAX = 1;
const RESEND_HOUR_WINDOW_MS = 60 * 60 * 1000;
const RESEND_HOUR_MAX = 5;

async function getRequestIp(): Promise<string> {
  try {
    return getClientIp(await headers());
  } catch {
    return "unknown";
  }
}

function otpEquals(inputHash: string, storedHash: string): boolean {
  if (inputHash.length !== storedHash.length) return false;
  return timingSafeEqual(Buffer.from(inputHash, "utf8"), Buffer.from(storedHash, "utf8"));
}

//   VERIFIKASI KODE OTP (halaman publik /verify-email)
export async function verifyEmailOtp(
  email: string,
  otp: string,
  turnstileToken?: string
) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const code = otp.trim();

    if (!/^\d{6}$/.test(code)) {
      return { success: false, error: "Kode verifikasi harus 6 digit angka" };
    }

    // HARDENING (24 Nov 2026): cek bot Turnstile SEBELUM rate limit.
    // Kalau kunci belum diisi, cek dilewati (fail open).
    const ip = await getRequestIp();
    if (!(await verifyTurnstileToken(turnstileToken, ip))) {
      return { success: false, error: TURNSTILE_ERROR_MESSAGE };
    }

    // Rate limit dulu (sebelum cek user) supaya penyerang tidak bisa
    // menebak kode berkali-kali dari satu IP.
    const ipKey = `otp-verify:ip:${ip}`;
    if (await isRateLimited(ipKey, VERIFY_IP_MAX, VERIFY_IP_WINDOW_MS)) {
      return { success: false, error: "Terlalu banyak percobaan verifikasi. Coba lagi 1 jam lagi." };
    }
    await recordRateLimitHit(ipKey, VERIFY_IP_WINDOW_MS);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, isActive: true },
    });
    if (!user) {
      return { success: false, error: VERIFY_INVALID_MESSAGE };
    }
    // HARDENING (24 Nov 2026): akun sudah aktif menjawab dengan pesan
    // gagal generik yang SAMA — pesan sukses "sudah terverifikasi" di sini
    // sebelumnya membocorkan email mana yang punya akun aktif.
    if (user.isActive) {
      return { success: false, error: VERIFY_INVALID_MESSAGE };
    }

    const token = await prisma.emailVerificationToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    if (!token) {
      return { success: false, error: VERIFY_INVALID_MESSAGE };
    }

    if (token.expiresAt < new Date()) {
      await prisma.emailVerificationToken.delete({ where: { id: token.id } });
      return { success: false, error: VERIFY_INVALID_MESSAGE };
    }

    if (token.attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.emailVerificationToken.delete({ where: { id: token.id } });
      return { success: false, error: VERIFY_INVALID_MESSAGE };
    }

    if (!otpEquals(hashOtp(code), token.otpHash)) {
      const updated = await prisma.emailVerificationToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
        select: { attempts: true },
      });
      if (updated.attempts >= OTP_MAX_ATTEMPTS) {
        await prisma.emailVerificationToken.delete({ where: { id: token.id } });
        return { success: false, error: VERIFY_INVALID_MESSAGE };
      }
      return { success: false, error: VERIFY_INVALID_MESSAGE };
    }

    // Kode cocok: hapus token (sekali pakai) + aktifkan akun.
    await prisma.emailVerificationToken.delete({ where: { id: token.id } });
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: true, emailVerifiedAt: new Date() },
    });

    return { success: true, message: "Email berhasil diverifikasi. Akun Anda sudah aktif — silakan login." };
  } catch (error) {
    console.error("[VERIFY_EMAIL_OTP_ERROR]", error);
    return { success: false, error: "Gagal memverifikasi email" };
  }
}

//   KIRIM ULANG OTP (halaman publik /verify-email)
export async function resendVerificationOtp(
  email: string,
  turnstileToken?: string
) {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    // HARDENING (24 Nov 2026): cek bot Turnstile SEBELUM rate limit —
    // endpoint ini mengirim email (target email-bombing). Kalau kunci
    // belum diisi, cek dilewati (fail open).
    const ip = await getRequestIp();
    if (!(await verifyTurnstileToken(turnstileToken, ip))) {
      return { success: false, error: TURNSTILE_ERROR_MESSAGE };
    }

    // Rate limit dulu (sebelum cek user) supaya inbox siapa pun tidak
    // bisa dibanjiri. Pesan penolakan sengaja sama untuk semua.
    const minKey = `otp-resend-min:${normalizedEmail}`;
    if (await isRateLimited(minKey, RESEND_MIN_MAX, RESEND_MIN_WINDOW_MS)) {
      return { success: false, error: "Tunggu 1 menit sebelum minta kode baru." };
    }
    const hourKey = `otp-resend-hour:${ip}:${normalizedEmail}`;
    if (await isRateLimited(hourKey, RESEND_HOUR_MAX, RESEND_HOUR_WINDOW_MS)) {
      return { success: false, error: "Terlalu banyak permintaan kode. Coba lagi 1 jam lagi." };
    }
    await recordRateLimitHit(minKey, RESEND_MIN_WINDOW_MS);
    await recordRateLimitHit(hourKey, RESEND_HOUR_WINDOW_MS);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, isActive: true },
    });

    // Jangan bocorkan email terdaftar atau tidak — jawabannya selalu sama,
    // dan kode hanya benar-benar dikirim kalau akunnya ada DAN belum aktif.
    // (Meniru pola requestPasswordReset.)
    if (!user || user.isActive) {
      return { success: true, message: RESEND_GENERIC_MESSAGE };
    }

    const result = await sendVerificationOtp(user.id);
    if (!result.success) {
      console.error("[OTP_RESEND_EMAIL_ERROR]", normalizedEmail, result.error);
    }

    return { success: true, message: RESEND_GENERIC_MESSAGE };
  } catch (error) {
    console.error("[RESEND_VERIFICATION_OTP_ERROR]", error);
    return { success: false, error: "Gagal mengirim ulang kode verifikasi" };
  }
}

//   KIRIM ULANG OTP (SUPER_ADMIN, dari tabel Manajemen Akun)
export async function resendUserVerificationOtp(userId: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
      return { success: false, error: "Unauthorized: Hanya Super Admin yang diizinkan." };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isActive: true },
    });
    if (!user) {
      return { success: false, error: "User tidak ditemukan" };
    }
    if (user.isActive) {
      return { success: false, error: "Akun sudah aktif, tidak perlu kode OTP." };
    }

    const rateKey = `otp-resend-admin:${user.id}`;
    if (await isRateLimited(rateKey, RESEND_HOUR_MAX, RESEND_HOUR_WINDOW_MS)) {
      return { success: false, error: "Terlalu banyak kirim ulang kode. Coba lagi 1 jam lagi." };
    }
    await recordRateLimitHit(rateKey, RESEND_HOUR_WINDOW_MS);

    const result = await sendVerificationOtp(user.id);
    if (!result.success) {
      return { success: false, error: result.error || "Gagal mengirim kode verifikasi." };
    }
    return { success: true, message: `Kode verifikasi baru dikirim ke ${user.email}.` };
  } catch (error) {
    console.error("[RESEND_USER_VERIFICATION_OTP_ERROR]", error);
    return { success: false, error: "Gagal mengirim ulang kode verifikasi." };
  }
}
