"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { changePasswordSchema } from "@/lib/validations/password-reset.schema";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { generatePasswordResetEmail, sendEmail } from "../utils/email";
import { requireAuth } from "@/lib/utils/role";
import {
  verifyTurnstileToken,
  TURNSTILE_ERROR_MESSAGE,
} from "@/lib/utils/turnstile";
import {
  PASSWORD_ERROR_MESSAGE,
  validatePassword,
} from "@/lib/utils/password";
import {
  getClientIp,
  isRateLimited,
  recordRateLimitHit,
} from "@/lib/utils/rate-limit";

// SECURITY FIX (22 Nov 2026, pentest M1): SATU pesan sukses yang sama
// persis untuk email terdaftar dan tidak terdaftar. Sebelumnya dua pesan
// itu tulisannya berbeda ("Jika email terdaftar, ..." vs tanpa awalan),
// sehingga penyerang bisa menebak email mana yang punya akun.
const RESET_SUCCESS_MESSAGE =
  "Jika email terdaftar, link reset password telah dikirim ke email Anda";

// SECURITY FIX (22 Nov 2026, pentest M5): token reset disimpan sebagai
// hash SHA-256 di DB, bukan token mentah — kalau DB bocor, token yang
// tersimpan tidak bisa langsung dipakai. Link di email tetap berisi
// token mentah; saat verifikasi, token masuk di-hash lalu dicocokkan.
// PERUBAHAN PERILAKU: link reset yang diterbitkan SEBELUM patch ini
// (token plaintext di DB) tidak akan cocok lagi dan mati saat deploy.
function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Rate limit ganti password via action web (M4): 10x/jam per user,
// sama seperti route API-nya.
const CHANGE_PW_WINDOW_MS = 60 * 60 * 1000;
const CHANGE_PW_MAX_ATTEMPTS = 10;
// Rate limit minta link reset (M5): 5x per email+IP dalam 1 jam.
const RESET_WINDOW_MS = 60 * 60 * 1000;
const RESET_MAX_REQUESTS = 5;
// Rate limit pakai token reset (L-8): 10x per IP dalam 1 jam.
const RESET_USE_WINDOW_MS = 60 * 60 * 1000;
const RESET_USE_MAX_ATTEMPTS = 10;

async function getRequestIp(): Promise<string> {
  try {
    return getClientIp(await headers());
  } catch {
    // headers() tidak tersedia (mis. dipanggil di luar request).
    return "unknown";
  }
}
export async function changePassword(formData: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requireAuth(session); // Just need to be logged in
    // SECURITY FIX (22 Nov 2026, pentest M4): action ganti password web
    // sebelumnya TANPA rate limit — password lama bisa ditebak berkali-kali
    // dengan sesi curian. Sekarang sama seperti route API-nya: 10x/jam
    // per user (hitungan di DB, tabel rate_limits).
    const changePwKey = `changepw-action:user:${session.user.id}`;
    if (await isRateLimited(changePwKey, CHANGE_PW_MAX_ATTEMPTS, CHANGE_PW_WINDOW_MS)) {
      return { success: false, error: "Terlalu banyak percobaan ganti password. Coba lagi 1 jam lagi." };
    }
    await recordRateLimitHit(changePwKey, CHANGE_PW_WINDOW_MS);

    // Kebijakan password (24 Nov 2026): min 8, maks 128, 1 huruf besar,
    // 1 angka, 1 simbol — dicek server-side di sini SEBELUM zod parse,
    // supaya pesan penolakannya selalu pesan yang sama persis.
    if (
      typeof formData.newPassword !== "string" ||
      !validatePassword(formData.newPassword).valid
    ) {
      return { success: false, error: PASSWORD_ERROR_MESSAGE };
    }

    // Validate
    const validated = changePasswordSchema.parse(formData);

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    });

    if (!user) {
      return { success: false, error: "User tidak ditemukan" };
    }

    // Verify current password
    const isValid = await bcrypt.compare(validated.currentPassword, user.password);

    if (!isValid) {
      return { success: false, error: "Password lama tidak sesuai" };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(validated.newPassword, 10);

    // Update password + cabut semua token mobile lama (tokenVersion naik).
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, tokenVersion: { increment: 1 } },
    });

    revalidatePath("/dashboard/settings");

    return { success: true, message: "Password berhasil diubah" };
  } catch (error) {
    console.error("[CHANGE_PASSWORD_ERROR]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal mengubah password",
    };
  }
}

export async function requestPasswordReset(
  email: string,
  turnstileToken?: string
) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const ip = await getRequestIp();
    // HARDENING (24 Nov 2026): cek bot Turnstile SEBELUM rate limit —
    // endpoint ini mengirim email (target email-bombing). Kalau kunci
    // Turnstile belum diisi, cek dilewati (fail open).
    if (!(await verifyTurnstileToken(turnstileToken, ip))) {
      return { success: false, error: TURNSTILE_ERROR_MESSAGE };
    }
    // Rate-limit dulu (sebelum cek user) supaya penyerang tidak bisa
    // membanjiri inbox siapa pun. Pesan penolakan sengaja sama untuk semua.
    // SECURITY FIX (22 Nov 2026, pentest M2 + M28): IP dari elemen TERAKHIR
    // X-Forwarded-For dan hitungan di DB (bukan in-memory per instance).
    const rateKey = `reset-request:${ip}:${normalizedEmail}`;
    if (await isRateLimited(rateKey, RESET_MAX_REQUESTS, RESET_WINDOW_MS)) {
      return { success: false, error: "Terlalu banyak permintaan reset password. Coba lagi 1 jam lagi." };
    }
    await recordRateLimitHit(rateKey, RESET_WINDOW_MS);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // SECURITY FIX (Nov 2026, M1): jangan bocorkan email terdaftar atau
    // tidak — jawabannya selalu sama persis, email reset hanya benar-benar
    // dikirim kalau akunnya ada DAN aktif. Akun nonaktif juga mendapat
    // jawaban yang sama (tidak ada link yang dibuat).
    if (!user || !user.isActive) {
      return { success: true, message: RESET_SUCCESS_MESSAGE };
    }

    // Generate token (32 random bytes)
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const expiresAt = new Date(Date.now() + 3600000);

    // SECURITY FIX (22 Nov 2026, pentest M5): JANGAN hapus token lama saat
    // minta baru — sebelumnya tiap request baru menggugurkan link reset sah
    // milik korban. Yang dihapus hanya token yang SUDAH kedaluwarsa.
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    });

    // Create new token — yang disimpan HANYA hash-nya (M5).
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: hashResetToken(token),
        expiresAt,
      },
    });

    // Send email
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
    
    const emailResult = await sendEmail({
      to: email,
      subject: "Reset Password - TB Masdar Utama",
      html: generatePasswordResetEmail(user.name, resetUrl),
    });

    if (!emailResult.success) {
      console.error("[EMAIL_SEND_ERROR]", emailResult.error);
    }

    return {
      success: true,
      message: RESET_SUCCESS_MESSAGE,
    };
  } catch (error) {
    console.error("[REQUEST_RESET_ERROR]", error);
    return {
      success: false,
      error: "Gagal mengirim link reset password",
    };
  }
}

export async function resetPassword(
  token: string,
  newPassword: string,
  turnstileToken?: string
) {
  try {
    // HARDENING (24 Nov 2026): cek bot Turnstile SEBELUM rate limit /
    // pemakaian token. Kalau kunci belum diisi, cek dilewati (fail open).
    const ip = await getRequestIp();
    if (!(await verifyTurnstileToken(turnstileToken, ip))) {
      return { success: false, error: TURNSTILE_ERROR_MESSAGE };
    }
    // SECURITY FIX (22 Nov 2026, pentest L-8): pemakaian token reset
    // sebelumnya tanpa rate limit. Sekarang 10x/jam per IP (hitungan DB).
    const useKey = `reset-use:ip:${ip}`;
    if (await isRateLimited(useKey, RESET_USE_MAX_ATTEMPTS, RESET_USE_WINDOW_MS)) {
      return { success: false, error: "Terlalu banyak percobaan reset password. Coba lagi 1 jam lagi." };
    }
    await recordRateLimitHit(useKey, RESET_USE_WINDOW_MS);

    // Token masuk di-hash dulu, lalu dicocokkan dengan hash di DB (M5).
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: hashResetToken(token) },
      include: { user: true },
    });

    if (!resetToken) {
      return { success: false, error: "Token tidak valid" };
    }

    if (resetToken.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      });
      return { success: false, error: "Token sudah expired" };
    }

    // Akun yang sudah dinonaktifkan tidak boleh memakai link reset
    // (token dibuat saat akun masih aktif).
    if (!resetToken.user.isActive) {
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      });
      return { success: false, error: "Token tidak valid" };
    }

    // Kebijakan password (24 Nov 2026): min 8, maks 128, 1 huruf besar,
    // 1 angka, 1 simbol — dicek server-side di sini (action ini tidak
    // memakai zod schema, validasi langsung).
    if (!validatePassword(newPassword).valid) {
      return { success: false, error: PASSWORD_ERROR_MESSAGE };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password + cabut semua token mobile lama (tokenVersion naik).
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword, tokenVersion: { increment: 1 } },
    });

    // Delete used token
    await prisma.passwordResetToken.delete({
      where: { id: resetToken.id },
    });

    return { success: true, message: "Password berhasil direset" };
  } catch (error) {
    console.error("[RESET_PASSWORD_ERROR]", error);
    return {
      success: false,
      error: "Gagal reset password",
    };
  }
}