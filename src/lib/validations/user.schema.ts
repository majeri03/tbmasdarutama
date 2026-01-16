import { z } from "zod";

export const userFormSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  email: z.string().email("Format email tidak valid"),
  // Password optional saat edit, tapi wajib saat create (nanti divalidasi logicnya di UI/Action)
  password: z.string().optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "KASIR"], {
    required_error: "Role wajib dipilih",
  }),
  phone: z.string().optional(),
  address: z.string().optional(),
  isActive: z.boolean(),
});

export type UserFormValues = z.infer<typeof userFormSchema>;