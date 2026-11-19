import { NextRequest } from "next/server";
import { getAuthenticatedUser, successResponse, errorResponse } from "@/lib/utils/api";
import { NotificationService } from "@/lib/services/notification.service";

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
 * 1. Cron eksternal (mis. cron-job.org, tiap hari 08:00 WITA):
 *    GET https://masdarutama.tech/api/notifications/check-overdue?key=<NOTIFICATION_CRON_SECRET>
 *    + set env NOTIFICATION_CRON_SECRET di hosting.
 * 2. Login sebagai ADMIN / SUPER_ADMIN lalu buka URL yang sama tanpa ?key=
 *    (dipakai untuk tes manual).
 */
async function handler(request: NextRequest) {
  try {
    const cronSecret = process.env.NOTIFICATION_CRON_SECRET;
    const url = new URL(request.url);
    const keyOk =
      !!cronSecret &&
      (url.searchParams.get("key") === cronSecret ||
        request.headers.get("x-cron-secret") === cronSecret);

    if (!keyOk) {
      const session = await getAuthenticatedUser();
      const role = (session?.user as { role?: string } | undefined)?.role;
      if (!session?.user || (role !== "SUPER_ADMIN" && role !== "ADMIN")) {
        return errorResponse("Unauthorized", 401);
      }
    }

    const result = await NotificationService.checkOverdueAndLowStock();
    return successResponse(result, `Cek selesai: ${result.debtSent} notifikasi hutang, ${result.stockSent} notifikasi stok rendah dikirim.`);
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
