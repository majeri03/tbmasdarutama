import { z } from "zod";

export const unitSchema = z.object({
  name: z
    .string()
    .min(1, "Nama satuan wajib diisi")
    .max(50, "Nama satuan maksimal 50 karakter")
    .trim()
    .transform((val) => val.toUpperCase()),
  description: z
    .string()
    .max(200, "Deskripsi maksimal 200 karakter")
    .trim()
    .transform((val) => val || null)
    .nullable()
    .default(null),
});

export type UnitFormData = z.infer<typeof unitSchema>;