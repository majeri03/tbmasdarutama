import { z } from "zod";

export const supplierSchema = z.object({
  name: z
    .string()
    .min(1, "Nama supplier wajib diisi")
    .max(100, "Nama supplier maksimal 100 karakter")
    .trim(),
  phone: z
    .string()
    .min(1, "Nomor telepon wajib diisi")
    .max(20, "Nomor telepon maksimal 20 karakter")
    .regex(/^[0-9+\-() ]+$/, "Format nomor telepon tidak valid")
    .trim(),
  email: z
    .string()
    .email("Format email tidak valid")
    .max(100, "Email maksimal 100 karakter")
    .trim()
    .optional()
    .nullable()
    .transform((val) => val || null),
  address: z
    .string()
    .max(200, "Alamat maksimal 200 karakter")
    .trim()
    .optional()
    .nullable()
    .transform((val) => val || null),
  city: z
    .string()
    .max(50, "Kota maksimal 50 karakter")
    .trim()
    .optional()
    .nullable()
    .transform((val) => val || null),
  province: z
    .string()
    .max(50, "Provinsi maksimal 50 karakter")
    .trim()
    .optional()
    .nullable()
    .transform((val) => val || null),
  description: z
    .string()
    .max(500, "Deskripsi maksimal 500 karakter")
    .trim()
    .optional()
    .nullable()
    .transform((val) => val || null),
  isActive: z
    .boolean()
    .default(true),
});

export type SupplierFormData = z.infer<typeof supplierSchema>;