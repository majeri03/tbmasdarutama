"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { changePasswordSchema } from "@/lib/validations/password-reset.schema";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { generatePasswordResetEmail, sendEmail } from "../utils/email";
import { requireAuth } from "@/lib/utils/role";

// FIX (22 Nov 2026): rate-limit minta link reset — max 5x per email+IP dalam
// 1 jam, lalu ditolak 1 jam. Tanpa ini penyerang bisa membanjiri inbox
// korban dan membuat link reset sah milik korban kedaluwarsa berulang kali.
// In-memory per instance, sama seperti rate-limit login.
const RESET_WINDOW_MS = 60 * 60 * 1000;
const RESET_MAX_REQUESTS = 5;
const resetRequests = new Map<string, { count: number; firstAt: number }>();

async function resetRateKey(email: string): Promise<string> {
  let ip = "unknown";
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  } catch {
    // headers() tidak tersedia (mis. dipanggil di luar request) — pakai kunci email saja.
  }
  return `${ip}:${email.toLowerCase().trim()}`;
}

function isResetRateLimited(key: string): boolean {
  const entry = resetRequests.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > RESET_WINDOW_MS) {
    resetRequests.delete(key);
    return false;
  }
  return entry.count >= RESET_MAX_REQUESTS;
}

function recordResetRequest(key: string): void {
  const now = Date.now();
  const entry = resetRequests.get(key);
  if (!entry || now - entry.firstAt > RESET_WINDOW_MS) {
    resetRequests.set(key, { count: 1, firstAt: now });
  } else {
    entry.count += 1;
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

export async function requestPasswordReset(email: string) {
  try {
    // Rate-limit dulu (sebelum cek user) supaya penyerang tidak bisa
    // membanjiri inbox siapa pun. Pesan penolakan sengaja sama untuk semua.
    const rateKey = await resetRateKey(email);
    if (isResetRateLimited(rateKey)) {
      return { success: false, error: "Terlalu banyak permintaan reset password. Coba lagi 1 jam lagi." };
    }
    recordResetRequest(rateKey);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    // SECURITY FIX (Nov 2026, M1): jangan bocorkan email terdaftar atau tidak.
    // Sebelumnya pesan "Email tidak ditemukan" membuat penyerang bisa
    // menebak alamat email mana yang punya akun. Sekarang jawabannya selalu
    // sama — email reset hanya benar-benar dikirim kalau akunnya ada.
    if (!user) {
      return { success: true, message: "Jika email terdaftar, link reset password telah dikirim ke email Anda" };
    }

    // Generate token (32 random bytes)
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const expiresAt = new Date(Date.now() + 3600000);

    // Delete old tokens
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // Create new token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
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
      message: "Link reset password telah dikirim ke email Anda",
    };
  } catch (error) {
    console.error("[REQUEST_RESET_ERROR]", error);
    return {
      success: false,
      error: "Gagal mengirim link reset password",
    };
  }
}

export async function resetPassword(token: string, newPassword: string) {
  try {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
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

    // FIX (22 Nov 2026): minimum password baru naik dari 6 ke 8 karakter
    // (action ini tidak memakai zod schema — validasi langsung di sini).
    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: "Password baru minimal 8 karakter" };
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