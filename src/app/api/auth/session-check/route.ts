import { NextResponse } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/utils/api";

/**
 * GET /api/auth/session-check
 * Verifikasi status login perangkat mobile.
 * Digunakan Flutter/Expo untuk cek apakah token/cookie masih valid.
 *
 * PENTING: path ini sengaja BUKAN /api/auth/session. Di Next.js App Router
 * segmen statis menang atas catch-all [...nextauth], jadi route kustom di
 * /api/auth/session membayangi endpoint session bawaan NextAuth dan membuat
 * useSession() di web menerima bentuk session yang salah (session.user
 * undefined) — akibatnya tab Sales & Poin kosong dan tab Profil berkata
 * "Sesi tidak ditemukan". Jangan pindahkan kembali ke /api/auth/session.
 */
export async function GET() {
  try {
    const session = await getAuthenticatedUser();

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
            // WS-9 (26 Nov 2026): avatarUrl ikut di sini supaya APK
            // menampilkannya dari hasil checkSession (lihat
            // getAuthenticatedUser + verifyMobileToken).
            avatarUrl: (session.user as { avatarUrl?: string | null }).avatarUrl ?? null,
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
