import { z } from "zod";
import { PaymentMethod } from "@prisma/client";

export const purchaseItemSchema = z.object({
  productId: z.string().min(1, "Produk harus dipilih"),
  unitId: z.string().min(1, "Satuan harus dipilih"),
  // FIX PENTEST (22 Nov 2026, L11): batas atas angka.
  quantity: z.number().min(1, "Quantity minimal 1").max(1_000_000, "Quantity terlalu besar"),
  unitPrice: z.number().min(0, "Harga tidak boleh negatif").max(1_000_000_000, "Harga terlalu besar"),
  discount: z.number().min(0, "Diskon tidak boleh negatif").max(1_000_000_000, "Diskon terlalu besar").default(0),
  subtotal: z.number().min(0).max(1_000_000_000_000, "Subtotal terlalu besar"),
});

export type PurchaseItemInput = z.infer<typeof purchaseItemSchema>;

export const createPurchaseSchema = z.object({
  supplierId: z.string().min(1, "Supplier harus dipilih"),
  purchaseDate: z.coerce.date().default(() => new Date()),
  // FIX PENTEST (22 Nov 2026, M25): items dibatasi 100 per PO.
  items: z.array(purchaseItemSchema).min(1, "Minimal 1 produk harus ditambahkan").max(100, "Maksimal 100 produk per PO"),
  discount: z.number().min(0).max(1_000_000_000).default(0),
  tax: z.number().min(0).max(100_000_000).default(0),
  notes: z.string().max(500, "Catatan maksimal 500 karakter").optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  paidAmount: z.number().min(0).max(1_000_000_000).default(0),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

export const updatePurchaseSchema = z.object({
  id: z.string().min(1),
  supplierId: z.string().min(1, "Supplier harus dipilih"),
  purchaseDate: z.coerce.date(),
  items: z.array(purchaseItemSchema).min(1, "Minimal 1 produk harus ditambahkan").max(100, "Maksimal 100 produk per PO"),
  discount: z.number().min(0).max(1_000_000_000).default(0),
  tax: z.number().min(0).max(100_000_000).default(0),
  notes: z.string().max(500, "Catatan maksimal 500 karakter").optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  paidAmount: z.number().min(0).max(1_000_000_000).default(0),
});

export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;

export const receivePurchaseSchema = z.object({
  id: z.string().min(1),
  receivedDate: z.coerce.date().default(() => new Date()),
  notes: z.string().max(500, "Catatan maksimal 500 karakter").optional(),
});

export type ReceivePurchaseInput = z.infer<typeof receivePurchaseSchema>;

export const filterPurchaseSchema = z.object({
  search: z.string().optional(),
  supplierId: z.string().optional(),
  status: z.enum(["PENDING", "RECEIVED", "PARTIAL", "CANCELLED"]).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

export type FilterPurchaseInput = z.infer<typeof filterPurchaseSchema>;