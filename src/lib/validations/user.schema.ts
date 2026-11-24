import { z } from "zod";
import {
  PASSWORD_ERROR_MESSAGE,
  validatePassword,
} from "@/lib/utils/password";

export const userFormSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  email: z.string().email("Format email tidak valid"),
  // Password optional saat edit (kosong = tidak diubah), tapi wajib saat
  // create (divalidasi di server action createUser). Kalau diisi, harus
  // lolos kebijakan password (24 Nov 2026): min 8, maks 128, 1 huruf
  // besar, 1 angka, 1 simbol — validator bersama di @/lib/utils/password.
  password: z
    .string()
    .optional()
    .superRefine((value, ctx) => {
      if (value && value.length > 0 && !validatePassword(value).valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: PASSWORD_ERROR_MESSAGE,
        });
      }
    }),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "KASIR"], {
    required_error: "Role wajib dipilih",
  }),
  phone: z.string().optional(),
  address: z.string().optional(),
  isActive: z.boolean(),
});

export type UserFormValues = z.infer<typeof userFormSchema>;
