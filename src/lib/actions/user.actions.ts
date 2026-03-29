"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { UserFormValues } from "../validations/user.schema";
import { Prisma, Role } from "@prisma/client";
async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") {
    throw new Error(
      "Unauthorized: Akses ditolak. Hanya Super Admin yang diizinkan."
    );
  }
  return user;
}

// GET ALL USERS
export async function getUsers() {
  try {
    await requireSuperAdmin();

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        address: true,
        isActive: true,
        createdAt: true,
      },
    });

    return { success: true, data: users };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return { success: false, error: message };
  }
}

// CREATE USER
export async function createUser(data: UserFormValues) {
  try {
    await requireSuperAdmin();

    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing)
      return { success: false, error: "Email sudah digunakan user lain" };

    if (!data.password || data.password.length < 6) {
      return {
        success: false,
        error: "Password wajib diisi minimal 6 karakter untuk user baru",
      };
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role as Role,
        phone: data.phone,
        address: data.address,
        isActive: data.isActive,
      },
    });

    revalidatePath("/dashboard/users");
    return { success: true, message: "User berhasil dibuat" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return { success: false, error: message };
}
}

// UPDATE USER
export async function updateUser(id: string, data: UserFormValues) {
  try {
    await requireSuperAdmin();

    const existing = await prisma.user.findFirst({
      where: {
        email: data.email,
        NOT: { id: id },
      },
    });
    if (existing)
      return { success: false, error: "Email sudah digunakan user lain" };

    const updateData: Prisma.UserUpdateInput = {
      name: data.name,
      email: data.email,
      role: data.role as Role,
      phone: data.phone,
      address: data.address,
      isActive: data.isActive,
    };

    if (data.password && data.password.trim() !== "") {
      if (data.password.length < 6)
        return { success: false, error: "Password minimal 6 karakter" };
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    await prisma.user.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/dashboard/users");
    return { success: true, message: "User berhasil diperbarui" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return { success: false, error: message };
}
}

// DELETE USER
export async function deleteUser(id: string) {
  try {
    const currentUser = await requireSuperAdmin();
    
    if (currentUser.id === id) {
        return { success: false, error: "Anda tidak bisa menghapus akun anda sendiri!" };
    }

    await prisma.user.delete({ where: { id } });
    
    revalidatePath("/dashboard/users");
    return { success: true, message: "User berhasil dihapus" };

  } catch (error) {
    console.error("Delete User Error:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (
      errorMessage.includes("foreign key constraint") || 
      errorMessage.includes("violates RESTRICT setting") ||
      errorMessage.includes("23001") || 
      errorMessage.includes("P2003")    
    ) {
      return { 
        success: false, 
        error: "Gagal: User ini memiliki data transaksi (Penjualan/Pembelian). Silakan non-aktifkan user ini saja." 
      };
    }

    return { success: false, error: "Gagal menghapus user. Terjadi kesalahan sistem." };
  }
}