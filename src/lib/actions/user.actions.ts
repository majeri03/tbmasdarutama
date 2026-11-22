"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { UserFormValues } from "../validations/user.schema";
import { Prisma, Role } from "@prisma/client";
// Helper: Security Check
async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") {
    throw new Error(
      "Unauthorized: Akses ditolak. Hanya Super Admin yang diizinkan."
    );
  }
  return user;
}

// 1. GET ALL USERS
export async function getUsers() {
  try {
    await requireSuperAdmin(); // Proteksi level data

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
        // Password TIDAK kita ambil demi keamanan
      },
    });

    return { success: true, data: users };
  } catch (error) {
    // Cek apakah error adalah instance dari Error javascript
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return { success: false, error: message };
  }
}

// 2. CREATE USER
export async function createUser(data: UserFormValues) {
  try {
    await requireSuperAdmin();

    // Cek duplikat email
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing)
      return { success: false, error: "Email sudah digunakan user lain" };

    // SECURITY FIX (22 Nov 2026, pentest L-2): minimum password user baru
    // disamakan 8 karakter seperti ganti password di tempat lain (dulu 6 —
    // "123456" bisa lolos). Maksimal 128 (bcrypt memotong di 72 byte).
    if (!data.password || data.password.length < 8) {
      return {
        success: false,
        error: "Password wajib diisi minimal 8 karakter untuk user baru",
      };
    }
    if (data.password.length > 128) {
      return {
        success: false,
        error: "Password maksimal 128 karakter",
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
    // Cek apakah error adalah instance dari Error javascript
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return { success: false, error: message };
}
}

// 3. UPDATE USER
export async function updateUser(id: string, data: UserFormValues) {
  try {
    await requireSuperAdmin();

    // Cek apakah email bentrok dengan user lain
    const existing = await prisma.user.findFirst({
      where: {
        email: data.email,
        NOT: { id: id },
      },
    });
    if (existing)
      return { success: false, error: "Email sudah digunakan user lain" };

    // Ambil kondisi akun saat ini — dipakai untuk memutuskan apakah semua
    // token mobile user ini harus dicabut (lihat bawah).
    const current = await prisma.user.findUnique({
      where: { id },
      select: { isActive: true, role: true },
    });
    if (!current) return { success: false, error: "User tidak ditemukan" };

    const updateData: Prisma.UserUpdateInput = {
      name: data.name,
      email: data.email,
      role: data.role as Role,
      phone: data.phone,
      address: data.address,
      isActive: data.isActive,
    };

    // Hanya update password jika input tidak kosong
    let passwordChanged = false;
    if (data.password && data.password.trim() !== "") {
      // SECURITY FIX (22 Nov 2026, pentest L-2): samakan minimal 8 karakter
      // (dulu 6) + maksimal 128.
      if (data.password.length < 8)
        return { success: false, error: "Password minimal 8 karakter" };
      if (data.password.length > 128)
        return { success: false, error: "Password maksimal 128 karakter" };
      updateData.password = await bcrypt.hash(data.password, 10);
      passwordChanged = true;
    }

    // FIX (22 Nov 2026): kalau akun dinonaktifkan, role diubah, atau
    // password diganti admin — cabut semua token mobile user ini dengan
    // menaikkan tokenVersion. Token lama langsung ditolak verifyMobileToken.
    const revokeSessions =
      (current.isActive && !data.isActive) ||
      current.role !== (data.role as Role) ||
      passwordChanged;
    if (revokeSessions) {
      updateData.tokenVersion = { increment: 1 };
    }

    await prisma.user.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/dashboard/users");
    return { success: true, message: "User berhasil diperbarui" };
  } catch (error) {
    // Cek apakah error adalah instance dari Error javascript
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return { success: false, error: message };
}
}

// 4. DELETE USER
export async function deleteUser(id: string) {
  try {
    const currentUser = await requireSuperAdmin();
    
    if (currentUser.id === id) {
        return { success: false, error: "Anda tidak bisa menghapus akun anda sendiri!" };
    }

    await prisma.user.delete({ where: { id } });
    
    revalidatePath("/dashboard/users");
    return { success: true, message: "User berhasil dihapus" };

  } catch (error) { // <--- HAPUS ': any', biarkan default (unknown)
    console.error("Delete User Error:", error);

    // Cara aman mengambil pesan error dari tipe 'unknown'
    // Cek apakah ini object Error, jika ya ambil .message, jika tidak ubah jadi string
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