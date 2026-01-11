import { z } from "zod";
import { PaymentMethod } from "@prisma/client";

export const addSupplierPaymentSchema = z.object({
  debtId: z.string().min(1, "Debt ID required"),
  amount: z.number().positive("Amount must be greater than 0"),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    required_error: "Payment method is required",
  }),
  paymentDate: z.date({
    required_error: "Payment date is required",
  }),
  notes: z.string().optional(),
});

export type AddSupplierPaymentInput = z.infer<typeof addSupplierPaymentSchema>;