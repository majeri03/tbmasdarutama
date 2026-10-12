import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signMobileToken } from "@/lib/utils/jwt";
import { errorResponse, validationErrorResponse } from "@/lib/utils/api";

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
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Email atau password salah." },
        { status: 401 }
      );
    }

    // 3. Cek status akun
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: "Akun Anda telah dinonaktifkan. Hubungi admin." },
        { status: 403 }
      );
    }

    // 4. Verifikasi password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "Email atau password salah." },
        { status: 401 }
      );
    }

    // 5. Generate mobile token yang terverifikasi
    const sessionToken = signMobileToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
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
