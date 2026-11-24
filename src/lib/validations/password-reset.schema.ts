import { z } from "zod";
import {
  PASSWORD_ERROR_MESSAGE,
  validatePassword,
} from "@/lib/utils/password";

export const requestPasswordResetSchema = z.object({
  email: z.string().email("Email tidak valid"),
});

// Aturan password baru (24 Nov 2026): min 8, maks 128, 1 huruf besar,
// 1 angka, 1 simbol — validator bersama di @/lib/utils/password,
// sama seperti yang dipakai server-side di action.
const strongPassword = z
  .string()
  .superRefine((value, ctx) => {
    if (!validatePassword(value).valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: PASSWORD_ERROR_MESSAGE,
      });
    }
  });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token required"),
    newPassword: strongPassword,
    confirmPassword: z.string().min(8, "Konfirmasi password minimal 8 karakter"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Password tidak cocok",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password lama required"),
    newPassword: strongPassword,
    confirmPassword: z.string().min(8, "Konfirmasi password minimal 8 karakter"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Password tidak cocok",
    path: ["confirmPassword"],
  });

export type RequestPasswordResetValues = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
