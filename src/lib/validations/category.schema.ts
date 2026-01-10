import { z } from "zod";

// ==================== CATEGORY SCHEMA ====================
export const categorySchema = z.object({
  name: z
    .string()
    .min(1, "Nama kategori wajib diisi")
    .max(100, "Nama kategori maksimal 100 karakter")
    .trim(),
  description: z
    .string()
    .max(500, "Deskripsi maksimal 500 karakter")
    .trim()
    .optional()
    .nullable()
    .transform((val) => val || null),
});

export type CategoryFormData = z.infer<typeof categorySchema>;

// ==================== SUB-CATEGORY SCHEMA ====================
export const subCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Nama sub-kategori wajib diisi")
    .max(100, "Nama sub-kategori maksimal 100 karakter")
    .trim(),
  description: z
    .string()
    .max(500, "Deskripsi maksimal 500 karakter")
    .trim()
    .optional()
    .nullable()
    .transform((val) => val || null),
  categoryId: z
    .string()
    .min(1, "Kategori wajib dipilih"),
});

export type SubCategoryFormData = z.infer<typeof subCategorySchema>;