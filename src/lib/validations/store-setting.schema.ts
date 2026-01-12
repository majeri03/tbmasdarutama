import { z } from "zod";

export const storeSettingSchema = z.object({
  name: z.string().min(3, "Nama toko minimal 3 karakter"),
  tagline: z.string().optional(),
  logoUrl: z.string().url("URL logo tidak valid").optional().or(z.literal("")),
  phone: z.string().optional(),
  email: z.string().email("Email tidak valid").optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  website: z.string().url("URL website tidak valid").optional().or(z.literal("")),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  whatsapp: z.string().optional(),
  taxNumber: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankHolder: z.string().optional(),
});

export type StoreSettingFormValues = z.infer<typeof storeSettingSchema>;