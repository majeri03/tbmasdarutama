import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signMobileToken } from "@/lib/utils/jwt";
import { errorResponse } from "@/lib/utils/api";
import {
  getClientIp,
  isRateLimited,
  recordRateLimitHit,
  clearRateLimit,
} from "@/lib/utils/rate-limit";

// SECURITY FIX (Nov 2026, H1): rate-limit login mobile. Sebelumnya tidak ada
// batas percobaan sama sekali — password bisa ditebak berkali-kali.
// SECURITY FIX (22 Nov 2026, pentest M28): hitungan pindah dari Map
// in-memory per instance ke tabel rate_limits di DB (berlaku antar-instance
// serverless). SECURITY FIX (pentest M2): IP dari elemen TERAKHIR
// X-Forwarded-For (ditambahkan proxy tepercaya) — elemen pertama bisa
// dipalsukan penyerang untuk membuat kunci rate limit baru tiap percobaan.
// 10 kegagalan per IP+email dalam 15 menit, lalu 429.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILED = 10;

// SECURITY FIX (22 Nov 2026, pentest L8 API): validasi tipe input dengan
// zod SEBELUM dipakai — email non-string sebelumnya membuat
// .toLowerCase() melempar dan berakhir 500. Batas panjang juga melindungi
// bcrypt (memotong di 72 byte).
const loginBodySchema = z.object({
  email: z.string().min(1).max(254),
  password: z.string().min(1).max(128),
});

function loginRateKey(request: NextRequest, email: string): string {
  const ip = getClientIp(request.headers);
  return `${ip}:${email.toLowerCase().trim()}`;
}

/**
 * POST /api/auth/login
 * Endpoint login untuk aplikasi mobile (Expo).
 * Mengembalikan session cookie yang dapat disimpan di SecureStore.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginBodySchema.safeParse(body);

    // 1. Validasi input — bentuk body tidak valid dijawab generik 401
    // (bukan 400 dengan rincian) supaya tidak membocorkan apa pun.
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Email atau password salah." },
        { status: 401 }
      );
    }
    const { email, password } = parsed.data;

    // 1b. Rate-limit: tolak sebelum cek password kalau sudah terlalu banyak gagal.
    const rateKey = loginRateKey(request, email);
    if (await isRateLimited(rateKey, LOGIN_MAX_FAILED, LOGIN_WINDOW_MS)) {
      return NextResponse.json(
        { success: false, error: "Terlalu banyak percobaan login. Coba lagi 15 menit lagi." },
        { status: 429 }
      );
    }

    // 2. Cari user di database
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true,
        isActive: true,
        tokenVersion: true,
      },
    });

    if (!user) {
      await recordRateLimitHit(rateKey, LOGIN_WINDOW_MS);
      return NextResponse.json(
        { success: false, error: "Email atau password salah." },
        { status: 401 }
      );
    }

    // 3. Cek status akun
    // SECURITY FIX (Nov 2026, L4): pesan dibedakan sebelumnya (403 khusus
    // akun nonaktif) membocorkan akun mana yang nonaktif. Sekarang jawabannya
    // sama seperti password salah — admin yang memberitahu pengguna langsung.
    if (!user.isActive) {
      await recordRateLimitHit(rateKey, LOGIN_WINDOW_MS);
      return NextResponse.json(
        { success: false, error: "Email atau password salah." },
        { status: 401 }
      );
    }

    // 4. Verifikasi password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await recordRateLimitHit(rateKey, LOGIN_WINDOW_MS);
      return NextResponse.json(
        { success: false, error: "Email atau password salah." },
        { status: 401 }
      );
    }

    // Login berhasil: bersihkan hitungan gagal untuk kunci ini.
    await clearRateLimit(rateKey);

    // 5. Generate mobile token yang terverifikasi.
    // FIX (22 Nov 2026): sertakan tv = tokenVersion saat ini, supaya token
    // ini mati begitu tokenVersion dinaikkan (ganti password / logout / dll).
    const sessionToken = await signMobileToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tv: user.tokenVersion,
    });

    // SECURITY FIX (22 Nov 2026, pentest L-6): di production cookie memakai
    // prefix __Secure- supaya browser mengikatnya ke HTTPS secara paksa.
    // Nama ini sama dengan yang dipakai middleware untuk memetakan Bearer
    // token (middleware.ts) dan yang dihapus route logout — dan dikembalikan
    // di field cookieName supaya APK menyesuaikan. Di development tetap
    // tanpa prefix supaya login lokal tetap jalan lewat HTTP.
    const cookieName =
      process.env.NODE_ENV === "production"
        ? "__Secure-authjs.session-token"
        : "authjs.session-token";

    // 6. Return response dengan session token dan Set-Cookie
    const response = NextResponse.json(
      {
        success: true,
        message: "Login berhasil.",
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          sessionToken,
          cookieName,
        },
      },
      { status: 200 }
    );

    response.cookies.set(cookieName, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 hari
    });

    return response;
  } catch (error) {
    console.error("[API_AUTH_LOGIN_ERROR]", error);
    return errorResponse("Terjadi kesalahan server saat login.");
  }
}
