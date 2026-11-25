import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPublicLandingData } from "@/lib/actions/landing-public.actions";
import LoginForm from "./LoginForm";

// Nama cookie sesi Auth.js v5 (sinkron dengan src/middleware.ts dan
// src/app/api/auth/logout/route.ts).
const SESSION_COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
] as const;

export default async function LoginPage() {
  // FIX (25 Nov 2026, WS-A, batch 1a): keputusan "sudah login" diambil
  // DI SINI (runtime Node, auth() menjalankan cek tokenVersion penuh
  // di DB), BUKAN di middleware. Middleware jalan di Edge Runtime dan
  // tidak bisa membedakan sesi valid dari sesi basi (tokenVersion
  // dicabut / token lawas tanpa klaim tv) — dulu middleware
  // memantulkan /login ke /dashboard untuk sesi basi, lalu auth() di
  // dashboard menolak dan redirect balik ke /login → loop.
  const session = await auth();
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  // Sesi basi: auth() null tapi browser masih mengirim cookie sesi
  // (mis. tokenVersion sudah dicabut lewat logout di perangkat lain /
  // ganti password, atau token lawas tanpa klaim tv). Jangan memantul
  // ke mana-mana — bersihkan cookie lewat GET /api/auth/logout (Route
  // Handler, satu-satunya tempat cookie bisa dihapus dengan aman)
  // lalu kembali ke /login tanpa cookie. Server Component tidak boleh
  // menghapus cookie sendiri (cookies() di sini read-only di Next 16:
  // set/delete melempar "Cookies can only be modified in a Server
  // Action or Route Handler"). Hanya redirect kalau cookie memang
  // ada, supaya pengunjung baru tetap langsung mendapat 200 tanpa
  // redirect tambahan.
  const cookieStore = await cookies();
  const hasStaleSessionCookie = SESSION_COOKIE_NAMES.some((name) =>
    cookieStore.has(name)
  );
  if (hasStaleSessionCookie) {
    redirect("/api/auth/logout?next=/login");
  }

  const result = await getPublicLandingData();
  const logoUrl = result.data?.store?.logoUrl ?? null;

  return (
    <div>
      <LoginForm logoUrl={logoUrl} />
    </div>
  );
}
