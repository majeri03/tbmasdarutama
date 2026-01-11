import { z } from "zod";
import { PaymentMethod } from "@prisma/client";

// ==================== PURCHASE ITEM SCHEMA ====================
export const purchaseItemSchema = z.object({
  productId: z.string().min(1, "Produk harus dipilih"),
  unitId: z.string().min(1, "Satuan harus dipilih"),
  quantity: z.number().min(1, "Quantity minimal 1"),
  unitPrice: z.number().min(0, "Harga tidak boleh negatif"),
  discount: z.number().min(0, "Diskon tidak boleh negatif").default(0),
  subtotal: z.number().min(0),
});

export type PurchaseItemInput = z.infer<typeof purchaseItemSchema>;

// ==================== CREATE PURCHASE SCHEMA ====================
export const createPurchaseSchema = z.object({
  supplierId: z.string().min(1, "Supplier harus dipilih"),
  purchaseDate: z.date().default(() => new Date()),
  items: z.array(purchaseItemSchema).min(1, "Minimal 1 produk harus ditambahkan"),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  notes: z.string().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  paidAmount: z.number().min(0).default(0),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

// ==================== UPDATE PURCHASE SCHEMA ====================
export const updatePurchaseSchema = z.object({
  id: z.string().min(1),
  supplierId: z.string().min(1, "Supplier harus dipilih"),
  purchaseDate: z.date(),
  items: z.array(purchaseItemSchema).min(1, "Minimal 1 produk harus ditambahkan"),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  notes: z.string().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  paidAmount: z.number().min(0).default(0),
});

export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;

// ==================== RECEIVE PURCHASE SCHEMA ====================
export const receivePurchaseSchema = z.object({
  id: z.string().min(1),
  receivedDate: z.date().default(() => new Date()),
  notes: z.string().optional(),
});

export type ReceivePurchaseInput = z.infer<typeof receivePurchaseSchema>;

// ==================== FILTER PURCHASE SCHEMA ====================
export const filterPurchaseSchema = z.object({
  search: z.string().optional(),
  supplierId: z.string().optional(),
  status: z.enum(["PENDING", "RECEIVED", "PARTIAL", "CANCELLED"]).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

export type FilterPurchaseInput = z.infer<typeof filterPurchaseSchema>;