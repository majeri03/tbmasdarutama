"use server";

// Site key Turnstile bersifat PUBLIK (tampil di HTML halaman login) —
// aman dikirim ke browser. Secret key TIDAK PERNAH keluar dari server
// (hanya dipakai src/lib/utils/turnstile.ts).
// Dibaca dari TURNSTILE_SITE_KEY (atau NEXT_PUBLIC_TURNSTILE_SITE_KEY
// sebagai cadangan). Kalau belum diisi, kembalikan null — widget tidak
// tampil dan form tetap jalan (fail open, lihat hardening-NOTES.md).
export async function getTurnstileSiteKey(): Promise<string | null> {
  return (
    process.env.TURNSTILE_SITE_KEY ||
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    null
  );
}
