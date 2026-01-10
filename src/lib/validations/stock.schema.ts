import { z } from "zod";
import { MovementType } from "@prisma/client";

// ==================== STOCK ADJUSTMENT SCHEMA ====================
export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1, "Produk wajib dipilih"),
  type: z.nativeEnum(MovementType, {
    errorMap: () => ({ message: "Tipe pergerakan tidak valid" }),
  }),
  quantity: z
    .number()
    .int("Quantity harus berupa angka bulat")
    .positive("Quantity harus lebih dari 0"),
  notes: z
    .string()
    .min(1, "Catatan wajib diisi")
    .max(500, "Catatan maksimal 500 karakter")
    .trim(),
  referenceType: z.string().optional().default("Manual Adjustment"),
  referenceId: z.string().optional().nullable(),
});

// ==================== STOCK FILTER SCHEMA ====================
export const stockFilterSchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  supplierId: z.string().optional(),
  movementType: z.nativeEnum(MovementType).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(10),
});

// ==================== TYPE EXPORTS ====================
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type StockFilterInput = z.infer<typeof stockFilterSchema>;