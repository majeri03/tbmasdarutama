"use server";

import { signOut, auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function logout() {
  // SECURITY FIX (22 Nov 2026, pentest H1): logout web sebelumnya HANYA
  // menghapus cookie di browser — sesi web yang dicuri tetap berlaku
  // sampai 30 hari. Sekarang tokenVersion dinaikkan dulu, supaya SEMUA
  // sesi akun ini (web + mobile) langsung mati, baru cookie dihapus.
  // Sama seperti POST /api/auth/logout untuk APK.
  try {
    const session = await auth();
    if (session?.user?.id) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { tokenVersion: { increment: 1 } },
      });
    }
  } catch (error) {
    // Pencabutan gagal (mis. DB bermasalah) — tetap lanjut hapus cookie
    // supaya pengguna tidak terjebak di halaman dashboard.
    console.error("[WEB_LOGOUT_REVOKE_ERROR]", error);
  }
  await signOut({ redirectTo: "/login" });
}
