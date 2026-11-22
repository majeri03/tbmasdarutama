import { z } from "zod";
import { PaymentMethod, SaleStatus } from "@prisma/client";

export const saleItemSchema = z.object({
  productId: z.string().min(1, "Produk wajib dipilih"),
  productUnitId: z.string().min(1, "Satuan wajib dipilih"),
  // FIX PENTEST (22 Nov 2026, L11): batas atas supaya satu baris tidak bisa
  // berisi angka absurd (tagihan/kembalian raksasa, DoS transaksi).
  quantity: z.number().int().min(1, "Jumlah minimal 1").max(1_000_000, "Jumlah terlalu besar"),
  unitPrice: z.number().min(0, "Harga tidak boleh negatif").max(1_000_000_000, "Harga terlalu besar"),
  discount: z.number().min(0, "Diskon tidak boleh negatif").max(1_000_000_000, "Diskon terlalu besar").default(0),
  subtotal: z.number().min(0, "Subtotal tidak boleh negatif").max(1_000_000_000_000, "Subtotal terlalu besar"),
});

export type SaleItemInput = z.infer<typeof saleItemSchema>;

export const createSaleSchema = z.object({
  customerId: z.string().min(1, "Customer wajib dipilih"),
  items: z
    .array(saleItemSchema)
    .min(1, "Minimal harus ada 1 produk")
    .max(200, "Maksimal 200 produk per transaksi")
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
  totalAmount: z.number().min(0, "Total tidak boleh negatif").max(1_000_000_000_000, "Total terlalu besar"),
  discount: z.number().min(0, "Diskon tidak boleh negatif").max(1_000_000_000, "Diskon terlalu besar").default(0),
  tax: z.number().min(0, "Pajak tidak boleh negatif").max(100_000_000, "Pajak terlalu besar").default(0),
  grandTotal: z.number().min(0, "Grand total tidak boleh negatif").max(1_000_000_000_000, "Grand total terlalu besar"),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    required_error: "Metode pembayaran wajib dipilih",
  }),
  paidAmount: z.number().min(0, "Jumlah bayar tidak boleh negatif").max(1_000_000_000, "Jumlah bayar terlalu besar"),
  changeAmount: z.number().min(0, "Kembalian tidak boleh negatif").max(1_000_000_000, "Kembalian terlalu besar").default(0),
  notes: z.string().trim().max(500, "Catatan maksimal 500 karakter").optional().nullable(),
})
  // FIX PENTEST (22 Nov 2026, L11): pajak maksimal 25% dari total
  // (PPN 11% — 25% sudah longgar). Tanpa ini, tax: 999999999999 lolos
  // dan membengkakkan tagihan.
  .refine((data) => data.tax <= data.totalAmount * 0.25, {
    message: "Pajak maksimal 25% dari total",
    path: ["tax"],
  });

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const saleFilterSchema = z.object({
  search: z.string().optional(),
  customerId: z.string().optional(),
  cashierId: z.string().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  status: z.nativeEnum(SaleStatus).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10), // FIX PENTEST (22 Nov 2026, L11): batas atas 100 — tanpa ini KASIR bisa dump massal
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type SaleFilterInput = z.input<typeof saleFilterSchema>;

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