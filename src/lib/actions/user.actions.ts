"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { UserFormValues } from "../validations/user.schema";
import { Prisma, Role } from "@prisma/client";
import { sendVerificationOtp } from "@/lib/services/email-verification.service";
import {
  PASSWORD_ERROR_MESSAGE,
  validatePassword,
} from "@/lib/utils/password";
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
        emailVerifiedAt: true,
        createdAt: true,
        // Token OTP yang masih berlaku — dipakai tabel untuk badge
        // "Menunggu verifikasi" (akun nonaktif + ada token aktif).
        emailVerificationTokens: {
          where: { expiresAt: { gt: new Date() } },
          select: { id: true },
        },
        // Password TIDAK kita ambil demi keamanan
      },
    });

    // Serialisasi ringan: token -> boolean, supaya client tidak perlu
    // tahu bentuk tokennya.
    const data = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone,
      address: u.address,
      isActive: u.isActive,
      emailVerifiedAt: u.emailVerifiedAt,
      createdAt: u.createdAt,
      hasPendingVerification: u.emailVerificationTokens.length > 0,
    }));

    return { success: true, data };
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

    // Kebijakan password (24 Nov 2026): min 8, maks 128, 1 huruf besar,
    // 1 angka, 1 simbol — dicek server-side, client tidak bisa bypass.
    if (!data.password) {
      return {
        success: false,
        error: "Password wajib diisi minimal 8 karakter untuk user baru",
      };
    }
    if (!validatePassword(data.password).valid) {
      return { success: false, error: PASSWORD_ERROR_MESSAGE };
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    // PKG-I (23 Nov 2026, OTP verifikasi email): akun baru SELALU dibuat
    // nonaktif dulu (toggle "Akun Aktif" di form diabaikan untuk akun
    // baru) dan kode OTP 6 digit dikirim ke emailnya. Akun baru bisa
    // dipakai setelah pemiliknya memasukkan kode di /verify-email.
    // Login sudah menolak akun nonaktif (auth.ts + jwt.ts tidak diubah).
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role as Role,
        phone: data.phone,
        address: data.address,
        isActive: false,
      },
    });

    revalidatePath("/dashboard/users");

    // Kegagalan kirim email TIDAK menggagalkan pembuatan akun — token
    // OTP sudah tersimpan, jadi SUPER_ADMIN bisa kirim ulang dari tabel.
    const otp = await sendVerificationOtp(user.id);
    if (!otp.success) {
      return {
        success: true,
        message: `Akun dibuat, tetapi kode verifikasi gagal dikirim ke ${data.email}. Gunakan tombol "Kirim ulang OTP" di tabel akun.`,
      };
    }
    return {
      success: true,
      message: `Akun dibuat. Kode verifikasi 6 digit telah dikirim ke ${data.email} — akun baru bisa dipakai setelah email diverifikasi.`,
    };
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
      select: { isActive: true, role: true, email: true, emailVerifiedAt: true },
    });
    if (!current) return { success: false, error: "User tidak ditemukan" };

    // PKG-I: email akun yang BELUM terverifikasi diganti -> kirim OTP baru
    // ke alamat yang benar (OTP lama ikut gugur). Akun yang sudah aktif
    // tidak kena aturan ini.
    const emailChangedOnPendingAccount =
      !current.isActive && current.email !== data.email;

    // FIX (24 Nov 2026, OTP bypass): akun yang emailnya BELUM
    // terverifikasi TIDAK BOLEH diaktifkan dari form edit — dulu
    // `isActive: data.isActive` ditulis apa adanya DAN token OTP yang
    // menggantung dihapus, sehingga SUPER_ADMIN yang mencentang "Akun
    // Aktif" di form edit langsung mengaktifkan akun TANPA kode OTP.
    // Mulai sekarang akun hanya bisa aktif lewat verifyEmailOtp
    // (/verify-email). Kalau form mengirim isActive=true untuk akun yang
    // belum terverifikasi, nilainya DIBUANG (dipaksa tetap false) dan
    // perubahan lain tetap tersimpan — lihat pesan di bawah.
    // Akun yang emailnya SUDAH terverifikasi (pernah aktif lalu
    // dinonaktifkan admin) tetap boleh diaktifkan kembali dari sini.
    const activationBlocked =
      !current.isActive && data.isActive && !current.emailVerifiedAt;
    const effectiveIsActive = activationBlocked ? false : data.isActive;

    const updateData: Prisma.UserUpdateInput = {
      name: data.name,
      email: data.email,
      role: data.role as Role,
      phone: data.phone,
      address: data.address,
      isActive: effectiveIsActive,
    };

    // Hanya update password jika input tidak kosong
    let passwordChanged = false;
    if (data.password && data.password.trim() !== "") {
      // Kebijakan password (24 Nov 2026): sama seperti user baru.
      if (!validatePassword(data.password).valid)
        return { success: false, error: PASSWORD_ERROR_MESSAGE };
      updateData.password = await bcrypt.hash(data.password, 10);
      passwordChanged = true;
    }

    // FIX (22 Nov 2026): kalau akun dinonaktifkan, role diubah, atau
    // password diganti admin — cabut semua token mobile user ini dengan
    // menaikkan tokenVersion. Token lama langsung ditolak verifyMobileToken.
    const revokeSessions =
      (current.isActive && !effectiveIsActive) ||
      current.role !== (data.role as Role) ||
      passwordChanged;
    if (revokeSessions) {
      updateData.tokenVersion = { increment: 1 };
    }

    await prisma.user.update({
      where: { id },
      data: updateData,
    });

    // PKG-I: email akun yang belum terverifikasi diganti -> kirim OTP baru
    // ke alamat yang benar (OTP lama gugur karena sendVerificationOtp
    // menghapus token lama).
    if (emailChangedOnPendingAccount) {
      const otp = await sendVerificationOtp(id);
      revalidatePath("/dashboard/users");
      if (!otp.success) {
        return {
          success: true,
          message:
            "User berhasil diperbarui, tetapi kode verifikasi baru gagal dikirim ke email baru. Gunakan tombol \"Kirim ulang OTP\" di tabel akun." +
            (activationBlocked
              ? " Akun TIDAK diaktifkan — aktivasi hanya lewat kode OTP."
              : ""),
        };
      }
      return {
        success: true,
        message:
          `User berhasil diperbarui. Kode verifikasi baru dikirim ke ${data.email}.` +
          (activationBlocked
            ? " Akun TIDAK diaktifkan — aktivasi hanya lewat kode OTP."
            : ""),
      };
    }

    revalidatePath("/dashboard/users");
    if (activationBlocked) {
      return {
        success: true,
        message:
          "User berhasil diperbarui, tetapi akun TIDAK diaktifkan: akun yang belum terverifikasi hanya bisa aktif lewat kode OTP di halaman verifikasi.",
      };
    }
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