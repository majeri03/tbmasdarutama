"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  createCustomerSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from "@/lib/validations/customer.schema";
import { Prisma } from "@prisma/client";

// ==================== GENERATE CUSTOMER CODE ====================
async function generateCustomerCode(): Promise<string> {
  const lastCustomer = await prisma.customer.findFirst({
    orderBy: { code: "desc" },
    select: { code: true },
  });

  if (!lastCustomer) {
    return "CUST-00001";
  }

  const lastNumber = parseInt(lastCustomer.code.split("-")[1]);
  const newNumber = lastNumber + 1;
  return `CUST-${newNumber.toString().padStart(5, "0")}`;
}

// ==================== CREATE CUSTOMER ====================
export async function createCustomer(data: CreateCustomerInput) {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = createCustomerSchema.parse(data);

    // Check duplicate name
    const existingCustomer = await prisma.customer.findFirst({
      where: { name: { equals: validatedData.name, mode: "insensitive" } },
    });

    if (existingCustomer) {
      return {
        success: false,
        error: `Customer dengan nama "${validatedData.name}" sudah ada.`,
      };
    }

    // Generate customer code
    const code = await generateCustomerCode();

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        code,
        name: validatedData.name,
        phone: validatedData.phone || null,
        email: validatedData.email || null,
        address: validatedData.address || null,
        city: validatedData.city || null,
        province: validatedData.province || null,
        type: validatedData.type,
      },
    });

    revalidatePath("/dashboard/customers");

    return {
      success: true,
      message: `Customer "${customer.name}" (${customer.code}) berhasil ditambahkan!`,
    };
  } catch (error) {
    console.error("[CREATE_CUSTOMER_ERROR]", error);

    if (error instanceof Error) {
      return { success: false, error: error.message };
    }

    return {
      success: false,
      error: "Gagal menambahkan customer. Silakan coba lagi.",
    };
  }
}

// ==================== UPDATE CUSTOMER ====================
export async function updateCustomer(id: string, data: UpdateCustomerInput) {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = updateCustomerSchema.parse(data);

    // Check if customer exists
    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return { success: false, error: "Customer tidak ditemukan." };
    }

    // Check duplicate name (exclude current customer)
    if (validatedData.name) {
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          name: { equals: validatedData.name, mode: "insensitive" },
          id: { not: id },
        },
      });

      if (existingCustomer) {
        return {
          success: false,
          error: `Customer dengan nama "${validatedData.name}" sudah ada.`,
        };
      }
    }

    // Update customer
    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        name: validatedData.name,
        phone: validatedData.phone || null,
        email: validatedData.email || null,
        address: validatedData.address || null,
        city: validatedData.city || null,
        province: validatedData.province || null,
        type: validatedData.type,
      },
    });

    revalidatePath("/dashboard/customers");

    return {
      success: true,
      message: `Customer "${updatedCustomer.name}" berhasil diperbarui!`,
    };
  } catch (error) {
    console.error("[UPDATE_CUSTOMER_ERROR]", error);

    if (error instanceof Error) {
      return { success: false, error: error.message };
    }

    return {
      success: false,
      error: "Gagal memperbarui customer. Silakan coba lagi.",
    };
  }
}

// ==================== DELETE CUSTOMER ====================
export async function deleteCustomer(id: string) {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            sales: true,
            customerDebts: true,
          },
        },
      },
    });

    if (!customer) {
      return { success: false, error: "Customer tidak ditemukan." };
    }

    // Check if has transactions
    if (customer._count.sales > 0) {
      return {
        success: false,
        error: `Customer "${customer.name}" tidak dapat dihapus karena memiliki ${customer._count.sales} transaksi penjualan. Gunakan fitur "Nonaktifkan" jika ingin menyembunyikan customer ini.`,
      };
    }

    // Check if has debts
    if (customer._count.customerDebts > 0) {
      return {
        success: false,
        error: `Customer "${customer.name}" tidak dapat dihapus karena memiliki data utang. Selesaikan utang terlebih dahulu.`,
      };
    }

    // Delete customer
    await prisma.customer.delete({
      where: { id },
    });

    revalidatePath("/dashboard/customers");

    return {
      success: true,
      message: `Customer "${customer.name}" (${customer.code}) berhasil dihapus!`,
    };
  } catch (error) {
    console.error("[DELETE_CUSTOMER_ERROR]", error);

    if (error instanceof Error) {
      return { success: false, error: error.message };
    }

    return {
      success: false,
      error: "Gagal menghapus customer. Silakan coba lagi.",
    };
  }
}

// ==================== TOGGLE ACTIVE STATUS ====================
export async function toggleCustomerStatus(id: string) {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return { success: false, error: "Customer tidak ditemukan." };
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: { isActive: !customer.isActive },
    });

    revalidatePath("/dashboard/customers");

    return {
      success: true,
      message: `Customer "${updatedCustomer.name}" berhasil ${
        updatedCustomer.isActive ? "diaktifkan" : "dinonaktifkan"
      }!`,
    };
  } catch (error) {
    console.error("[TOGGLE_CUSTOMER_STATUS_ERROR]", error);
    return {
      success: false,
      error: "Gagal mengubah status customer.",
    };
  }
}
// ==================== GET ALL CUSTOMERS ====================
export async function getCustomers(filters?: { status?: "ACTIVE" | "INACTIVE" }) {
  try {
    const where: Prisma.CustomerWhereInput = {};

    if (filters?.status === "ACTIVE") {
      where.isActive = true;
    } else if (filters?.status === "INACTIVE") {
      where.isActive = false;
    }

    const customers = await prisma.customer.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        province: true,
        type: true,
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return { success: true, data: customers };
  } catch (error) {
    console.error("[GET_CUSTOMERS_ERROR]", error);
    return {
      success: false,
      error: "Gagal mengambil data customer.",
    };
  }
}