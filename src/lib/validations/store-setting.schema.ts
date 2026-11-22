import { z } from "zod";

// FIX PENTEST (22 Nov 2026, M11): semua field string diberi .max() supaya
// pengaturan toko tidak bisa diisi string raksasa (DoS penyimpanan /
// kerusakan tampilan invoice). Batas disesuaikan dengan isi yang wajar.
export const storeSettingSchema = z.object({
  name: z.string().min(1, "Nama toko tidak boleh kosong").max(100).optional().or(z.literal("")),
  tagline: z.string().max(200).optional().nullable(),
  logoUrl: z.string().max(500).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().max(100).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  province: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(10).optional().nullable(),
  website: z.string().max(200).optional().nullable(),
  instagram: z.string().max(100).optional().nullable(),
  facebook: z.string().max(100).optional().nullable(),
  whatsapp: z.string().max(30).optional().nullable(),
  taxNumber: z.string().max(30).optional().nullable(),
  bankName: z.string().max(100).optional().nullable(),
  bankAccount: z.string().max(50).optional().nullable(),
  bankHolder: z.string().max(100).optional().nullable(),
  invoiceLayoutType: z.string().max(50).optional().nullable(),
  invoicePaperSize: z.string().max(20).optional().nullable(),
  invoiceDocumentPaperSize: z.string().max(20).optional().nullable(),
  invoiceShowHeader: z.boolean().optional(),
  invoiceShowLogo: z.boolean().optional(),
  invoiceShowCustomerInfo: z.boolean().optional(),
  invoiceShowPaymentInfo: z.boolean().optional(),
  invoiceShowSignature: z.boolean().optional(),
  invoiceShowFooter: z.boolean().optional(),
  invoiceFooterTerms: z.string().max(2000).optional().nullable(),
});

export type StoreSettingFormValues = z.infer<typeof storeSettingSchema>;
