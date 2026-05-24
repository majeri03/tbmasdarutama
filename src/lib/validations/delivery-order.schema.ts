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
  items: z.array(deliveryItemSchema).min(1, "At least one item is required"),
});

export const updateDeliveryStatusSchema = z.object({
  id: z.string().min(1, "Delivery order ID is required"),
  status: z.nativeEnum(DeliveryStatus),
  receivedBy: z.string().optional(),
  receivedDate: z.coerce.date().optional(),
});

export type CreateDeliveryOrderInput = z.infer<typeof createDeliveryOrderSchema>;
export type UpdateDeliveryStatusInput = z.infer<typeof updateDeliveryStatusSchema>;