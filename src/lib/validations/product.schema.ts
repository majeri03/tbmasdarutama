import { z } from "zod";

// ==================== PRODUCT SCHEMAS ====================

// Product unit schema (untuk nested validation)
export const productUnitSchema = z.object({
  unitId: z.string().min(1, "Satuan wajib dipilih"),
  conversionValue: z.number().int().min(1, "Nilai konversi minimal 1"),
  buyPrice: z.number().min(0, "Harga beli tidak boleh negatif"),
  sellPrice: z.number().min(0, "Harga jual tidak boleh negatif"),
  isPrimary: z.boolean().default(false),
});

// Product image schema (untuk nested validation)
export const productImageSchema = z.object({
  imageUrl: z.string().url("URL gambar tidak valid"),
  isPrimary: z.boolean().default(false),
});

// Main product schema untuk CREATE
export const createProductSchema = z
  .object({
    name: z
      .string()
      .min(1, "Nama produk wajib diisi")
      .max(100, "Nama produk maksimal 100 karakter")
      .trim(),
    barcode: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val === "" ? null : val)),
    description: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val === "" ? null : val)),
    categoryId: z.string().min(1, "Kategori wajib dipilih"),
    subCategoryId: z
      .string()
      .optional()
      .nullable()
      .transform((val) => (val === "" ? null : val)),
    supplierId: z
      .string()
      .optional()
      .nullable()
      .transform((val) => (val === "" ? null : val)),
    minStock: z.number().int().min(0, "Min stock tidak boleh negatif").default(0),
    isActive: z.boolean().default(true),
    // Nested arrays
    units: z
      .array(productUnitSchema)
      .min(1, "Minimal harus ada 1 satuan")
      .refine(
        (units) => units.filter((u) => u.isPrimary).length === 1,
        "Harus ada tepat 1 satuan utama (primary)"
      )
      .refine(
        (units) => {
          const primaryUnit = units.find((u) => u.isPrimary);
          return primaryUnit ? primaryUnit.conversionValue === 1 : true;
        },
        "Satuan utama (primary) harus memiliki konversi = 1"
      )
      .refine(
        (units) => {
          return units.every((unit) => unit.sellPrice >= unit.buyPrice);
        },
        "Harga jual harus lebih besar atau sama dengan harga beli"
      ),
    images: z
      .array(productImageSchema)
      .max(5, "Maksimal 5 gambar")
      .optional()
      .default([])
      .refine(
        (images) => {
          if (images.length === 0) return true;
          return images.filter((img) => img.isPrimary).length <= 1;
        },
        "Hanya boleh ada 1 gambar utama"
      ),
  })
  .refine(
    (data) => {
      // Validasi: tidak boleh ada unit yang sama
      const unitIds = data.units.map((u) => u.unitId);
      return unitIds.length === new Set(unitIds).size;
    },
    {
      message: "Tidak boleh ada satuan yang sama",
      path: ["units"],
    }
  );

// Schema untuk UPDATE (semua field optional kecuali units validation)
export const updateProductSchema = z
  .object({
    name: z
      .string()
      .min(1, "Nama produk wajib diisi")
      .max(100, "Nama produk maksimal 100 karakter")
      .trim()
      .optional(),
    barcode: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val === "" ? null : val)),
    description: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val === "" ? null : val)),
    categoryId: z.string().min(1, "Kategori wajib dipilih").optional(),
    subCategoryId: z
      .string()
      .optional()
      .nullable()
      .transform((val) => (val === "" ? null : val)),
    supplierId: z
      .string()
      .optional()
      .nullable()
      .transform((val) => (val === "" ? null : val)),
    minStock: z.number().int().min(0, "Min stock tidak boleh negatif").optional(),
    isActive: z.boolean().optional(),
    units: z
      .array(productUnitSchema)
      .min(1, "Minimal harus ada 1 satuan")
      .refine(
        (units) => units.filter((u) => u.isPrimary).length === 1,
        "Harus ada tepat 1 satuan utama (primary)"
      )
      .refine(
        (units) => {
          const primaryUnit = units.find((u) => u.isPrimary);
          return primaryUnit ? primaryUnit.conversionValue === 1 : true;
        },
        "Satuan utama (primary) harus memiliki konversi = 1"
      )
      .refine(
        (units) => {
          return units.every((unit) => unit.sellPrice >= unit.buyPrice);
        },
        "Harga jual harus lebih besar atau sama dengan harga beli"
      )
      .optional(),
    images: z
      .array(productImageSchema)
      .max(5, "Maksimal 5 gambar")
      .optional()
      .refine(
        (images) => {
          if (!images || images.length === 0) return true;
          return images.filter((img) => img.isPrimary).length <= 1;
        },
        "Hanya boleh ada 1 gambar utama"
      ),
  })
  .refine(
    (data) => {
      if (!data.units) return true;
      const unitIds = data.units.map((u) => u.unitId);
      return unitIds.length === new Set(unitIds).size;
    },
    {
      message: "Tidak boleh ada satuan yang sama",
      path: ["units"],
    }
  );

// Type exports
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductUnitInput = z.infer<typeof productUnitSchema>;
export type ProductImageInput = z.infer<typeof productImageSchema>;