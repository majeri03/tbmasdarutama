/**
 * Rate limit berbasis database (pentest 22 Nov 2026, M28).
 *
 * Menggantikan semua Map in-memory per instance (login mobile, login web,
 * ganti password, reset password) yang tidak berlaku antar-instance
 * serverless Vercel. Hitungan disimpan di tabel `rate_limits`
 * (model RateLimit, migrasi 20261122230000_rate_limit).
 *
 * Semantik mengikuti kode lama:
 * - isRateLimited(): cek saja, tanpa mencatat.
 * - recordRateLimitHit(): catat satu percobaan; jendela direset kalau
 *   sudah kedaluwarsa.
 * - clearRateLimit(): hapus hitungan (dipanggil saat login berhasil).
 *
 * Kalau database sedang tidak bisa dijangkau, fungsi-fungsi ini gagal
 * TERBUKA (isRateLimited -> false) supaya rate limit tidak memblokir
 * login saat DB bermasalah — login itu sendiri tetap akan gagal di
 * langkah berikutnya kalau DB memang mati. Semua kegagalan dicatat
 * ke console.error server.
 */
import prisma from "@/lib/prisma";

/**
 * Ambil IP client dari header.
 * SECURITY FIX (pentest M2): pakai elemen TERAKHIR X-Forwarded-For —
 * elemen itu ditambahkan proxy tepercaya (Vercel). Elemen pertama
 * adalah nilai kiriman client dan bisa dipalsukan sembarang, jadi
 * memakainya membuat penyerang bisa membuat kunci rate limit baru
 * di tiap percobaan.
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  // Header IP resmi Vercel (kalau ada) sebagai cadangan.
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export async function isRateLimited(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<boolean> {
  try {
    const row = await prisma.rateLimit.findUnique({ where: { key } });
    if (!row) return false;
    if (Date.now() - row.windowStart.getTime() > windowMs) return false;
    return row.count >= maxAttempts;
  } catch (error) {
    console.error("[RATE_LIMIT_CHECK_ERROR]", key, error);
    return false;
  }
}

export async function recordRateLimitHit(
  key: string,
  windowMs: number
): Promise<void> {
  try {
    const now = new Date();
    const row = await prisma.rateLimit.findUnique({ where: { key } });
    if (!row || now.getTime() - row.windowStart.getTime() > windowMs) {
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, windowStart: now },
        update: { count: 1, windowStart: now },
      });
    } else {
      await prisma.rateLimit.update({
        where: { key },
        data: { count: { increment: 1 } },
      });
    }
    // Sapu oportunistik baris yang sudah sangat kedaluwarsa supaya tabel
    // tidak tumbuh tanpa batas. Best-effort; kegagalan diabaikan.
    try {
      await prisma.rateLimit.deleteMany({
        where: {
          windowStart: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
    } catch {
      // Abaikan — pembersihan bukan bagian kritis.
    }
  } catch (error) {
    console.error("[RATE_LIMIT_RECORD_ERROR]", key, error);
  }
}

export async function clearRateLimit(key: string): Promise<void> {
  try {
    await prisma.rateLimit.delete({ where: { key } });
  } catch {
    // Baris mungkin sudah tidak ada — bukan error.
  }
}
