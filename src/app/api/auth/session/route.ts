import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { unauthorizedResponse } from "@/lib/utils/api";

/**
 * GET /api/auth/session
 * Verifikasi status login perangkat mobile.
 * Digunakan Expo untuk cek apakah token/cookie masih valid.
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return unauthorizedResponse("Sesi tidak valid. Silakan login ulang.");
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            role: session.user.role,
          },
          isAuthenticated: true,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API_AUTH_SESSION_ERROR]", error);
    return unauthorizedResponse("Gagal memverifikasi sesi.");
  }
}
