import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signIn } from "@/lib/auth";
import { errorResponse, validationErrorResponse } from "@/lib/utils/api";
import { cookies } from "next/headers";

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

    // 5. Trigger NextAuth signIn untuk mendapatkan session token/cookie
    // NextAuth v5 akan mengatur Set-Cookie header secara otomatis
    try {
      await signIn("credentials", {
        email: user.email,
        password,
        redirect: false,
      });
    } catch (authError: unknown) {
      // NextAuth v5 signIn throws NEXT_REDIRECT on success (expected behavior)
      // We catch and handle it — the cookie is already set
      const error = authError as { digest?: string; message?: string };
      if (error?.digest?.includes("NEXT_REDIRECT")) {
        // This is actually a success — NextAuth sets the cookie before redirecting
        const cookieStore = await cookies();
        const token = cookieStore.get("authjs.session-token")?.value || cookieStore.get("__Secure-authjs.session-token")?.value;
        const cookieName = cookieStore.get("authjs.session-token") ? "authjs.session-token" : "__Secure-authjs.session-token";

        return NextResponse.json(
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
              sessionToken: token || null,
              cookieName: cookieName,
            },
          },
          { status: 200 }
        );
      }
      throw authError;
    }

    // 6. Return user data (cookie sudah di-set oleh NextAuth)
    const cookieStore = await cookies();
    const token = cookieStore.get("authjs.session-token")?.value || cookieStore.get("__Secure-authjs.session-token")?.value;
    const cookieName = cookieStore.get("authjs.session-token") ? "authjs.session-token" : "__Secure-authjs.session-token";

    return NextResponse.json(
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
          sessionToken: token || null,
          cookieName: cookieName,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API_AUTH_LOGIN_ERROR]", error);
    return errorResponse("Terjadi kesalahan server saat login.");
  }
}
