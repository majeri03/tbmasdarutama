import { handlers } from "@/lib/auth";
import type { NextRequest } from "next/server";

// FIX (25 Nov 2026, WS-A, batch 1a): Auth.js membangun URL redirect
// absolut (signIn / signOut / error) dari base URL-nya — dan base itu
// berasal dari env AUTH_URL / NEXTAUTH_URL. Kalau env di Vercel masih
// berisi domain lama, redirect Auth.js mendarat di
// https://masdarutama.tech/... lalu 301 kembali ke domain baru (dan
// POST yang kena 301 berubah jadi GET — itu penjelasan paling masuk
// akal kenapa tombol Sign out di halaman /api/auth/signout tampak
// tidak submit: form-nya POST ke domain lama, 301 mengubahnya jadi
// GET, halaman signout sekadar dimuat ulang).
// Selama env belum dibetulkan, tulis ulang Location yang mengarah ke
// domain lama menjadi host request di sini. Ini pengaman lapis kedua;
// perbaikan yang benar tetap mengganti env di Vercel (lihat NOTES
// WS-A). Host lama ditulis eksplisit supaya tidak ada domain lain
// yang ikut ditulis ulang (fail-closed: hanya masdarutama.tech).
// Kalau env sudah benar, fungsi ini tidak mengubah apa pun (tidak ada
// Location domain lama yang lewat).
const LEGACY_HOST = "masdarutama.tech";

const isLegacyUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      url.hostname === LEGACY_HOST || url.hostname.endsWith(`.${LEGACY_HOST}`)
    );
  } catch {
    // Location relatif (mis. "/login") atau tidak bisa diparse — bukan
    // URL domain lama, biarkan apa adanya.
    return false;
  }
};

const rewriteLegacyRedirect = (
  request: NextRequest,
  response: Response
): Response => {
  const location = response.headers.get("location");
  if (!location || !isLegacyUrl(location)) return response;
  try {
    const target = new URL(location);
    const requestUrl = new URL(request.url);
    target.protocol = requestUrl.protocol;
    target.hostname = requestUrl.hostname;
    target.port = requestUrl.port;
    // Ubah header di objek response yang sama — supaya tidak ada
    // header lain yang hilang (khususnya Set-Cookie penghapus cookie
    // pada POST /api/auth/signout, yang rusak kalau header disalin
    // lewat Headers baru).
    response.headers.set("location", target.toString());
  } catch {
    // URL tidak bisa diparse — biarkan response apa adanya.
  }
  return response;
};

export async function GET(request: NextRequest) {
  return rewriteLegacyRedirect(request, await handlers.GET(request));
}

export async function POST(request: NextRequest) {
  return rewriteLegacyRedirect(request, await handlers.POST(request));
}
