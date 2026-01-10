import { z } from "zod";
import { CustomerType } from "@prisma/client";

// ==================== CREATE CUSTOMER ====================
export const createCustomerSchema = z.object({
  name: z
    .string()
    .min(3, "Nama minimal 3 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  phone: z
    .string()
    .min(10, "Nomor telepon minimal 10 digit")
    .max(15, "Nomor telepon maksimal 15 digit")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .email("Format email tidak valid")
    .optional()
    .or(z.literal("")),
  address: z
    .string()
    .max(255, "Alamat maksimal 255 karakter")
    .optional()
    .or(z.literal("")),
  city: z
    .string()
    .max(100, "Kota maksimal 100 karakter")
    .optional()
    .or(z.literal("")),
  province: z
    .string()
    .max(100, "Provinsi maksimal 100 karakter")
    .optional()
    .or(z.literal("")),
  type: z.nativeEnum(CustomerType, {
    required_error: "Tipe customer harus dipilih",
  }),
});

// ==================== UPDATE CUSTOMER ====================
export const updateCustomerSchema = createCustomerSchema.partial();

// ==================== TYPE EXPORTS ====================
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;