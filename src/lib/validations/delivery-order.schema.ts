import { z } from "zod";
import { DeliveryStatus } from "@prisma/client";

export const deliveryItemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  unitId: z.string().min(1, "Unit is required"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  notes: z.string().optional(),
});

export const createDeliveryOrderSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  saleId: z.string().optional(),
  deliveryDate: z.coerce.date({
    required_error: "Delivery date is required",
  }),
  driver: z.string().optional(),
  vehicle: z.string().optional(),
  notes: z.string().optional(),
  proofImage: z.string().optional().nullable(),
  items: z.array(deliveryItemSchema).min(1, "At least one item is required"),
});

export const updateDeliveryStatusSchema = z.object({
  id: z.string().min(1, "Delivery order ID is required"),
  status: z.nativeEnum(DeliveryStatus),
  receivedBy: z.string().optional(),
  receivedDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  proofImage: z.string().optional().nullable(),
});

export const updateDeliveryOrderSchema = z.object({
  id: z.string().min(1, "Delivery order ID is required"),
  deliveryDate: z.coerce.date().optional(),
  driver: z.string().optional().nullable(),
  vehicle: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  proofImage: z.string().optional().nullable(),
  status: z.nativeEnum(DeliveryStatus).optional(),
  receivedBy: z.string().optional().nullable(),
  receivedDate: z.coerce.date().optional().nullable(),
});

export type CreateDeliveryOrderInput = z.infer<typeof createDeliveryOrderSchema>;
export type UpdateDeliveryStatusInput = z.infer<typeof updateDeliveryStatusSchema>;
export type UpdateDeliveryOrderInput = z.infer<typeof updateDeliveryOrderSchema>;