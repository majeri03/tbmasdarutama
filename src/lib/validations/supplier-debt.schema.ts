import { z } from "zod";
import { PaymentMethod } from "@prisma/client";

export const addSupplierPaymentSchema = z.object({
  debtId: z.string().min(1, "Debt ID required"),
  amount: z.number().positive("Amount must be greater than 0").max(1_000_000_000, "Amount too large"), // FIX PENTEST (22 Nov 2026, L11)
  paymentMethod: z.nativeEnum(PaymentMethod, {
    required_error: "Payment method is required",
  }),
  paymentDate: z.coerce.date({
    required_error: "Payment date is required",
  }),
  notes: z.string().max(500, "Notes max 500 characters").optional(),
});

export type AddSupplierPaymentInput = z.infer<typeof addSupplierPaymentSchema>;