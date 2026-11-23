import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getAuthenticatedUser, successResponse, errorResponse } from "@/lib/utils/api";
import { NotificationService } from "@/lib/services/notification.service";
import { updateAllOverdueDebts } from "@/lib/actions/customer-debt.actions";
import {
  isRateLimited,
  recordRateLimitHit,
} from "@/lib/utils/rate-limit";

// SECURITY FIX (22 Nov 2026, pentest L13 API): rate limit pemicu cron —
// tiap panggilan menjalankan updateAllOverdueDebts + cek stok rendah
// (beban DB penuh) walau dedup 24 jam membatasi push ganda. 30x/jam
// per pemanggil (cron atau admin) sudah sangat longgar untuk cron harian.
const CHECK_OVERDUE_WINDOW_MS = 60 * 60 * 1000;
const CHECK_OVERDUE_MAX_CALLS = 30;

/**
 * Perbandingan secret yang aman terhadap timing attack.
 * timingSafeEqual butuh buffer sama panjang — panjang berbeda langsung
 * false tanpa membocorkan apa pun lewat waktu.
 */
function secretsEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * GET /api/notifications/check-overdue
 * POST /api/notifications/check-overdue
 *
 * Cek berkala (cron harian) — FIX Nov 2026:
 * Hutang jatuh tempo & stok rendah sebelumnya TIDAK PERNAH punya pemicu
 * di backend, jadi tidak pernah jadi push. Endpoint ini yang memicunya,
 * dengan dedup 24 jam di NotificationService supaya tidak spam.
 *
 * Cara pakai (pilih satu):
 * 1. Cron Vercel (vercel.json, tiap hari 01:00 UTC = 08:00 WITA):
 *    Vercel mengirim header `Authorization: Bearer <CRON_SECRET>`
 *    (CRON_SECRET dibuat otomatis oleh Vercel saat cron terpasang).
 * 2. Cron eksternal (mis. cron-job.org, tiap hari 08:00 WITA):
 *    GET https://tbmasdarutama.vercel.app/api/notifications/check-overdue
 *    dengan header `x-cron-secret: <NOTIFICATION_CRON_SECRET>`
 *    + set env NOTIFICATION_CRON_SECRET di hosting.
 *    (SECURITY FIX Nov 2026, M7: secret TIDAK BOLEH lagi dikirim lewat
 *    query `?key=` — URL tercatat di log akses & riwayat browser. Hanya
 *    lewat header.)
 * 3. Login sebagai ADMIN / SUPER_ADMIN lalu buka URL yang sama tanpa header
 *    (dipakai untuk tes manual).
 *
 * PKG-H (23 Nov 2026): setelah push, endpoint ini juga mengirim email
 * ringkasan utang jatuh tempo (piutang pelanggan + utang supplier) ke
 * penerima yang diatur SUPER_ADMIN — lihat
 * NotificationService.sendDebtDueEmails(). Satu email per hari, hanya
 * kalau ada utang yang mencapai jadwal pengingat (default 3/7/30 hari
 * lewat jatuh tempo).
 */
async function handler(request: NextRequest) {
  try {
    const cronSecret = process.env.NOTIFICATION_CRON_SECRET;
    // SECURITY FIX (22 Nov 2026, pentest L13 API): perbandingan secret
    // pakai timingSafeEqual, bukan === (mencegah timing attack).
    const keyOk =
      !!cronSecret &&
      secretsEqual(request.headers.get("x-cron-secret") ?? "", cronSecret);

    // PKG-H (23 Nov 2026, cron Vercel): Vercel Cron TIDAK BISA mengirim
    // header kustom — ia mengirim `Authorization: Bearer <CRON_SECRET>`,
    // dan CRON_SECRET dibuat otomatis oleh Vercel saat cron terpasang
    // (vercel.json). Terima itu sebagai cara kedua, dengan perbandingan
    // yang sama amannya. Secret TIDAK PERNAH lewat query string.
    const vercelCronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization") ?? "";
    const vercelCronOk =
      !!vercelCronSecret &&
      authHeader.startsWith("Bearer ") &&
      secretsEqual(authHeader.slice("Bearer ".length), vercelCronSecret);

    let rateKey: string | null = null;
    if (!keyOk && !vercelCronOk) {
      const session = await getAuthenticatedUser();
      const role = (session?.user as { role?: string } | undefined)?.role;
      if (!session?.user || (role !== "SUPER_ADMIN" && role !== "ADMIN")) {
        return errorResponse("Unauthorized", 401);
      }
      rateKey = `check-overdue:user:${session.user.id}`;
    } else {
      rateKey = "check-overdue:cron";
    }

    if (
      await isRateLimited(rateKey, CHECK_OVERDUE_MAX_CALLS, CHECK_OVERDUE_WINDOW_MS)
    ) {
      return errorResponse(
        "Terlalu banyak permintaan cek hutang jatuh tempo. Coba lagi 1 jam lagi.",
        429
      );
    }
    await recordRateLimitHit(rateKey, CHECK_OVERDUE_WINDOW_MS);

    // QA FIX (M-18, Nov 2026): sebelum mengirim notifikasi, balik dulu status
    // hutang yang sudah lewat jatuh tempo jadi OVERDUE (pelanggan + supplier).
    // Fungsi ini dari patch QA backend (customer-debt.actions.ts).
    // Kalau patch QA belum dipasang, baris ini gagal di-build — pasang patch
    // QA dulu, atau hapus 2 baris ini sementara (notifikasi tetap jalan).
    // PKG-H: force=true — route sudah mengautentikasi pemanggilnya (cron
    // secret / ADMIN+), sementara updateAllOverdueDebts tanpa force akan
    // mengembalikan `skipped` karena cron tidak membawa sesi web.
    const overdue = await updateAllOverdueDebts({ force: true });
    const result = await NotificationService.checkOverdueAndLowStock();
    // PKG-H: email ringkasan utang jatuh tempo (piutang + utang supplier)
    // ke penerima yang diatur SUPER_ADMIN. Dedup harian di dalam fungsi.
    const email = await NotificationService.sendDebtDueEmails();
    return successResponse(
      { ...result, overdueUpdated: overdue.count, email },
      `Cek selesai: ${overdue.count} hutang jadi OVERDUE, ${result.debtSent} notifikasi hutang, ${result.stockSent} notifikasi stok rendah dikirim. Email utang: ${email.sent ? `terkirim ke ${email.recipientCount} penerima` : `tidak dikirim (${email.reason})`}.`
    );
  } catch (error) {
    console.error("[CHECK_OVERDUE_ERROR]", error);
    return errorResponse("Gagal mengecek hutang jatuh tempo / stok rendah");
  }
}

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

// Supaya Next.js tidak menganggap route ini statis / di-cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;
