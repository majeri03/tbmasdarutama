import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAuthenticatedUser,
  successResponse,
} from "@/lib/utils/api";

// Nama cookie yang dihapus saat logout. Auth.js v5 memakai
// "__Secure-authjs.session-token" di https dan "authjs.session-token"
// di http; cookie csrf + callback-url ikut dibersihkan supaya tidak
// ada sisa sesi basi yang tertinggal di browser (sinkron dengan
// src/middleware.ts dan src/app/login/page.tsx).
const COOKIES_TO_CLEAR = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Host-authjs.csrf-token",
  "authjs.csrf-token",
  "__Secure-authjs.callback-url",
  "authjs.callback-url",
] as const;

const clearSessionCookies = (response: NextResponse): void => {
  for (const name of COOKIES_TO_CLEAR) {
    response.cookies.delete(name);
  }
};

// Tujuan redirect GET harus path relatif di aplikasi sendiri — nilai
// lain (URL absolut, //evil.com, backslash) ditolak dan diganti
// /login (anti open-redirect).
const safeNextPath = (value: string | null): string => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/login";
  }
  if (value.includes("://") || value.includes("\\")) {
    return "/login";
  }
  return value;
};

/**
 * POST /api/auth/logout
 * Logout dari APK: menaikkan User.tokenVersion pemanggil, sehingga SEMUA
 * token mobile milik akun ini langsung tidak berlaku (verifyMobileToken
 * menolak tv yang tidak sama). Dipakai saat logout di APK — APK juga harus
 * menghapus sessionToken yang tersimpan di SecureStore-nya sendiri.
 * Juga menghapus cookie sesi web kalau ada (best effort).
 * FIX (22 Nov 2026): sebelumnya tidak ada cara mencabut token mobile —
 * token curang tetap berlaku sampai 30 hari.
 *
 * FIX (25 Nov 2026, WS-A, batch 1a): logout HARUS berhasil menghapus
 * cookie sesi walau sesinya sendiri sudah tidak valid. Sebelumnya sesi
 * basi/invalid langsung 401 di sini SEBELUM cookie dihapus — cookie
 * basi tertinggal di browser dan ikut memicu loop /login ↔ /dashboard.
 * Sekarang: pencabutan tokenVersion best-effort (kalau sesi masih
 * valid), cookie SELALU dihapus, dan respons selalu sukses. Logout itu
 * idempotent: "sudah logout" tetap berarti logout, bukan error.
 */
export async function POST(_request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (session?.user?.id) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { tokenVersion: { increment: 1 } },
      });
    }
  } catch (error) {
    // Pencabutan gagal (mis. DB bermasalah) — tetap lanjut hapus cookie
    // supaya pengguna tidak terjebak dengan sesi basi.
    console.error("[API_AUTH_LOGOUT_REVOKE_ERROR]", error);
  }

  const response = successResponse(null, "Logout berhasil. Semua sesi akun ini telah dicabut.");
  clearSessionCookies(response);
  return response;
}

/**
 * GET /api/auth/logout?next=/login
 * Jalur logout yang TIDAK melewati halaman bawaan Auth.js
 * (/api/auth/signout). Dipakai untuk:
 * 1. Membersihkan cookie sesi basi — halaman /login mengarahkan ke sini
 *    kalau auth() null tapi cookie sesi masih ada (lihat
 *    src/app/login/page.tsx). Tokennya sudah mati di server (itu
 *    sebabnya auth() null), jadi yang dibutuhkan hanya menghapus
 *    cookie di browser, lalu kembali ke `next` (default /login).
 * 2. Jalan keluar manual kalau halaman signout Auth.js tidak bisa
 *    dipakai (tombol Sign out tidak submit — batch 1a).
 * SENGAJA TIDAK menaikkan tokenVersion: GET bisa dipicu lintas situs
 * (mis. <img src="...">) dan pencabutan tokenVersion akan mematikan
 * SEMUA sesi akun (termasuk APK). Pencabutan tetap lewat POST di atas
 * (dilindungi CSRF origin check middleware) atau server action
 * logout() yang dipakai tombol Logout di Sidebar.
 * Redirect tujuan dibangun dari request.url (host request), bukan
 * hardcode domain — supaya tidak pernah mendarat di domain lama.
 */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(next, request.url));
  clearSessionCookies(response);
  return response;
}
