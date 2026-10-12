import { z } from "zod";

export const storeSettingSchema = z.object({
  name: z.string().min(1, "Nama toko tidak boleh kosong").optional().or(z.literal("")),
  tagline: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
  facebook: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  taxNumber: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankAccount: z.string().optional().nullable(),
  bankHolder: z.string().optional().nullable(),
  invoiceLayoutType: z.string().optional().nullable(),
  invoicePaperSize: z.string().optional().nullable(),
  invoiceDocumentPaperSize: z.string().optional().nullable(),
  invoiceShowHeader: z.boolean().optional(),
  invoiceShowLogo: z.boolean().optional(),
  invoiceShowCustomerInfo: z.boolean().optional(),
  invoiceShowPaymentInfo: z.boolean().optional(),
  invoiceShowSignature: z.boolean().optional(),
  invoiceShowFooter: z.boolean().optional(),
  invoiceFooterTerms: z.string().optional().nullable(),
});

export type StoreSettingFormValues = z.infer<typeof storeSettingSchema>;