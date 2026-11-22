import { z } from "zod";
import { DeliveryStatus } from "@prisma/client";

export const deliveryItemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  unitId: z.string().min(1, "Unit is required"),
  // FIX PENTEST (22 Nov 2026, L11): batas atas angka & panjang string.
  quantity: z.number().positive("Quantity must be greater than 0").max(1_000_000, "Quantity too large"),
  notes: z.string().max(500, "Notes max 500 characters").optional(),
});

export const createDeliveryOrderSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  saleId: z.string().optional(),
  deliveryDate: z.coerce.date({
    required_error: "Delivery date is required",
  }),
  driver: z.string().max(100, "Driver max 100 characters").optional(),
  vehicle: z.string().max(100, "Vehicle max 100 characters").optional(),
  notes: z.string().max(1000, "Notes max 1000 characters").optional(),
  proofImage: z.string().max(500, "Proof image URL max 500 characters").optional().nullable(),
  items: z.array(deliveryItemSchema).min(1, "At least one item is required").max(200, "Max 200 items"),
});

export const updateDeliveryStatusSchema = z.object({
  id: z.string().min(1, "Delivery order ID is required"),
  status: z.nativeEnum(DeliveryStatus),
  receivedBy: z.string().max(100, "Received by max 100 characters").optional(),
  receivedDate: z.coerce.date().optional(),
  notes: z.string().max(1000, "Notes max 1000 characters").optional(),
  proofImage: z.string().max(500, "Proof image URL max 500 characters").optional().nullable(),
});

export const updateDeliveryOrderSchema = z.object({
  id: z.string().min(1, "Delivery order ID is required"),
  deliveryDate: z.coerce.date().optional(),
  driver: z.string().max(100, "Driver max 100 characters").optional().nullable(),
  vehicle: z.string().max(100, "Vehicle max 100 characters").optional().nullable(),
  notes: z.string().max(1000, "Notes max 1000 characters").optional().nullable(),
  proofImage: z.string().max(500, "Proof image URL max 500 characters").optional().nullable(),
  status: z.nativeEnum(DeliveryStatus).optional(),
  receivedBy: z.string().max(100, "Received by max 100 characters").optional().nullable(),
  receivedDate: z.coerce.date().optional().nullable(),
});

export type CreateDeliveryOrderInput = z.infer<typeof createDeliveryOrderSchema>;
export type UpdateDeliveryStatusInput = z.infer<typeof updateDeliveryStatusSchema>;
export type UpdateDeliveryOrderInput = z.infer<typeof updateDeliveryOrderSchema>;