import { z } from "zod";
import { PaymentMethod, SaleStatus } from "@prisma/client";

// ==================== SALE ITEM SCHEMA ====================
export const saleItemSchema = z.object({
  productId: z.string().min(1, "Produk wajib dipilih"),
  productUnitId: z.string().min(1, "Satuan wajib dipilih"),
  quantity: z.number().int().min(1, "Jumlah minimal 1"),
  unitPrice: z.number().min(0, "Harga tidak boleh negatif"),
  discount: z.number().min(0, "Diskon tidak boleh negatif").default(0),
  subtotal: z.number().min(0, "Subtotal tidak boleh negatif"),
});

export type SaleItemInput = z.infer<typeof saleItemSchema>;

// ==================== CREATE SALE SCHEMA ====================
export const createSaleSchema = z.object({
  customerId: z.string().min(1, "Customer wajib dipilih"),
  items: z
    .array(saleItemSchema)
    .min(1, "Minimal harus ada 1 produk")
    .refine(
      (items) => {
        // Validasi tidak ada produk duplikat dengan unit yang sama
        const uniqueKeys = new Set(
          items.map((item) => `${item.productId}-${item.productUnitId}`)
        );
        return uniqueKeys.size === items.length;
      },
      {
        message: "Tidak boleh ada produk dengan satuan yang sama lebih dari 1x",
      }
    ),
  totalAmount: z.number().min(0, "Total tidak boleh negatif"),
  discount: z.number().min(0, "Diskon tidak boleh negatif").default(0),
  tax: z.number().min(0, "Pajak tidak boleh negatif").default(0),
  grandTotal: z.number().min(0, "Grand total tidak boleh negatif"),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    required_error: "Metode pembayaran wajib dipilih",
  }),
  paidAmount: z.number().min(0, "Jumlah bayar tidak boleh negatif"),
  changeAmount: z.number().min(0, "Kembalian tidak boleh negatif").default(0),
  notes: z.string().trim().max(500, "Catatan maksimal 500 karakter").optional().nullable(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

// ==================== SALE FILTER SCHEMA ====================
export const saleFilterSchema = z.object({
  search: z.string().optional(),
  customerId: z.string().optional(),
  cashierId: z.string().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  status: z.nativeEnum(SaleStatus).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(10),
});

export type SaleFilterInput = z.infer<typeof saleFilterSchema>;

// ==================== PAYMENT VALIDATION SCHEMA ====================
export const paymentValidationSchema = z
  .object({
    paymentMethod: z.nativeEnum(PaymentMethod),
    customerId: z.string().min(1),
    grandTotal: z.number().min(0),
    paidAmount: z.number().min(0),
  })
  .refine(
    (data) => {
      // Jika CREDIT, customer tidak boleh "Customer Umum"
      if (data.paymentMethod === "CREDIT") {
        return data.customerId !== "customer-umum-id"; // Nanti diganti dengan ID real
      }
      return true;
    },
    {
      message: "Pembayaran CREDIT tidak tersedia untuk Customer Umum",
      path: ["paymentMethod"],
    }
  )
  .refine(
    (data) => {
      // Jika bukan CREDIT, paidAmount harus >= grandTotal
      if (data.paymentMethod !== "CREDIT") {
        return data.paidAmount >= data.grandTotal;
      }
      return true;
    },
    {
      message: "Jumlah bayar kurang dari total yang harus dibayar",
      path: ["paidAmount"],
    }
  );

export type PaymentValidationInput = z.infer<typeof paymentValidationSchema>;