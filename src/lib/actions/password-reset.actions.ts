"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { changePasswordSchema } from "@/lib/validations/password-reset.schema";
import { revalidatePath } from "next/cache";
import { generatePasswordResetEmail, sendEmail } from "../utils/email";
import { requireAuth } from "@/lib/utils/role";
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

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
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
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { success: false, error: "Email tidak ditemukan" };
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

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
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