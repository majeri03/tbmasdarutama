import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signMobileToken } from "@/lib/utils/jwt";
import { errorResponse, validationErrorResponse } from "@/lib/utils/api";

// SECURITY FIX (Nov 2026, H1): rate-limit login mobile. Sebelumnya tidak ada
// batas percobaan sama sekali — password bisa ditebak berkali-kali.
// Sederhana dan in-memory: 10 kegagalan per email+IP dalam 15 menit, lalu 429.
// Catatan: di serverless (Vercel) tiap instance punya hitungannya sendiri,
// jadi ini memperlambat brute-force, bukan menghilangkannya sepenuhnya.
// Untuk perlindungan penuh, tambahkan rate-limit di edge (mis. Vercel /
// Cloudflare) atau simpan hitungan di Redis/DB.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILED = 10;
const failedLogins = new Map<string, { count: number; firstAt: number }>();

function loginRateKey(request: NextRequest, email: string): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return `${ip}:${email.toLowerCase().trim()}`;
}

function isLoginRateLimited(key: string): boolean {
  const entry = failedLogins.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
    failedLogins.delete(key);
    return false;
  }
  return entry.count >= LOGIN_MAX_FAILED;
}

function recordFailedLogin(key: string): void {
  const now = Date.now();
  const entry = failedLogins.get(key);
  if (!entry || now - entry.firstAt > LOGIN_WINDOW_MS) {
    failedLogins.set(key, { count: 1, firstAt: now });
  } else {
    entry.count += 1;
  }
}

/**
 * POST /api/auth/login
 * Endpoint login untuk aplikasi mobile (Expo).
 * Mengembalikan session cookie yang dapat disimpan di SecureStore.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // 1. Validasi input
    if (!email || !password) {
      return validationErrorResponse("Email dan password wajib diisi.");
    }

    // 1b. Rate-limit: tolak sebelum cek password kalau sudah terlalu banyak gagal.
    const rateKey = loginRateKey(request, String(email));
    if (isLoginRateLimited(rateKey)) {
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
      recordFailedLogin(rateKey);
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
      recordFailedLogin(rateKey);
      return NextResponse.json(
        { success: false, error: "Email atau password salah." },
        { status: 401 }
      );
    }

    // 4. Verifikasi password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      recordFailedLogin(rateKey);
      return NextResponse.json(
        { success: false, error: "Email atau password salah." },
        { status: 401 }
      );
    }

    // Login berhasil: bersihkan hitungan gagal untuk kunci ini.
    failedLogins.delete(rateKey);

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

    const cookieName = "authjs.session-token";

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
