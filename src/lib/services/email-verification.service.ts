import prisma from "@/lib/prisma";
import { createHash } from "node:crypto";
import { generateOtpEmail, sendEmail } from "../utils/email";

// PKG-I (23 Nov 2026, OTP verifikasi email akun baru).
// Modul layanan biasa (BUKAN server action) — helper kirim OTP dipakai
// createUser (user.actions.ts) dan aksi kirim ulang
// (email-verification.actions.ts). Kalau helper ini diekspor dari file
// "use server", ia jadi action yang bisa dipanggil siapa pun dengan
// userId sembarang — karena itu sengaja ditaruh di sini.

export const OTP_TTL_MS = 15 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

/** Hash SHA-256 dari kode OTP (bukan kode mentah — meniru hashResetToken). */
export function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Kode 6 digit angka acak (100000–999999). */
export function generateOtpCode(): string {
  const buf = crypto.getRandomValues(new Uint32Array(1))[0];
  return String(100000 + (buf % 900000));
}

/**
 * Buat OTP baru untuk user (menggugurkan OTP lama — satu user, satu token
 * aktif) dan kirim ke emailnya. Dipakai saat akun baru dibuat dan saat
 * kirim ulang. Akun yang sudah aktif tidak dikirimi OTP. Kegagalan kirim
 * email TIDAK melempar — pemanggil yang memutuskan pesannya (akun tetap
 * dibuat / token tetap tersimpan).
 */
export async function sendVerificationOtp(userId: string): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, isActive: true },
  });
  if (!user) return { success: false, error: "User tidak ditemukan" };
  if (user.isActive) return { success: false, error: "Akun sudah aktif" };

  await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });

  const code = generateOtpCode();
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      otpHash: hashOtp(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      attempts: 0,
    },
  });

  const emailResult = await sendEmail({
    to: user.email,
    subject: "Kode Verifikasi Email - TB Masdar Utama",
    html: generateOtpEmail(user.name, code),
  });
  if (!emailResult.success) {
    console.error("[OTP_EMAIL_ERROR]", user.email, emailResult.error);
    return { success: false, error: "Gagal mengirim email kode verifikasi" };
  }
  return { success: true };
}
