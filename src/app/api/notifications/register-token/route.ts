import { NextRequest } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse, successResponse, errorResponse } from "@/lib/utils/api";
import prisma from "@/lib/prisma";
import {
  isRateLimited,
  recordRateLimitHit,
} from "@/lib/utils/rate-limit";

/**
 * PENTEST FIX (22 Nov 2026, M3): token push orang lain tidak boleh
 * diklaim lewat upsert. Sebelumnya upsert berdasarkan nilai token
 * menimpa userId menjadi milik penyerang kalau dia tahu nilai token
 * korban — korban berhenti menerima notifikasi, penyerang menerima
 * notifikasi korban. Sekarang: token yang sudah terikat ke user lain
 * ditolak diam-diam (sukses generik, tanpa menimpa), dan format token
 * divalidasi (Expo push token + batas panjang).
 *
 * Endpoint kembar src/app/api/users/push-token/route.ts sudah diberi
 * logika yang sama (patch susulan z, 22 Nov 2026).
 */
const EXPO_PUSH_TOKEN_RE = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;
const MAX_PUSH_TOKEN_LENGTH = 255;

// HARDENING (24 Nov 2026): endpoint ini sebelumnya TANPA rate limit —
// walau butuh login, satu sesi curian / satu HP bisa membanjiri DB dengan
// upsert token tanpa batas. 30x/jam per user sudah sangat longgar
// (APK normal memanggil 1x saat login / 1x saat ganti token).
const PUSH_TOKEN_WINDOW_MS = 60 * 60 * 1000;
const PUSH_TOKEN_MAX_CALLS = 30;

async function checkPushTokenLimit(userId: string): Promise<boolean> {
  const key = `push-token:user:${userId}`;
  if (await isRateLimited(key, PUSH_TOKEN_MAX_CALLS, PUSH_TOKEN_WINDOW_MS)) {
    return false;
  }
  await recordRateLimitHit(key, PUSH_TOKEN_WINDOW_MS);
  return true;
}

function isValidPushToken(token: string): boolean {
  if (token.length === 0 || token.length > MAX_PUSH_TOKEN_LENGTH) return false;
  if (/\s/.test(token)) return false;
  return EXPO_PUSH_TOKEN_RE.test(token);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user?.id) return unauthorizedResponse();

    if (!(await checkPushTokenLimit(session.user.id))) {
      return errorResponse(
        "Terlalu banyak permintaan pendaftaran token. Coba lagi 1 jam lagi.",
        429
      );
    }

    const body = await request.json();
    const { token, platform, deviceName } = body;

    if (!token || typeof token !== "string") {
      return errorResponse("Token wajib diisi", 400);
    }
    if (!isValidPushToken(token)) {
      return errorResponse("Format token perangkat tidak valid", 400);
    }

    // Tolak klaim token milik user lain — tanpa membocorkan siapa pemiliknya.
    const existing = await prisma.deviceToken.findUnique({
      where: { token },
      select: { id: true, userId: true },
    });
    if (existing && existing.userId !== session.user.id) {
      return successResponse({ id: existing.id }, "Token perangkat berhasil didaftarkan");
    }

    // Upsert token ke tabel DeviceToken
    const device = await prisma.deviceToken.upsert({
      where: { token },
      update: {
        userId: session.user.id,
        platform: platform ?? "android",
        deviceName: deviceName ?? null,
        lastSeenAt: new Date(),
      },
      create: {
        userId: session.user.id,
        token,
        platform: platform ?? "android",
        deviceName: deviceName ?? null,
        lastSeenAt: new Date(),
      },
    });

    // Sinkronkan juga ke User.expoPushToken untuk backward-compatibility
    await prisma.user.update({
      where: { id: session.user.id },
      data: { expoPushToken: token },
    }).catch(() => {});

    return successResponse({ id: device.id }, "Token perangkat berhasil didaftarkan");
  } catch (error) {
    console.error("[REGISTER_DEVICE_TOKEN_ERROR]", error);
    return errorResponse("Gagal mendaftarkan token perangkat");
  }
}

/**
 * DELETE /api/notifications/register-token
 * Menghapus token perangkat saat logout sehingga tidak menerima push setelah keluar.
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user?.id) return unauthorizedResponse();

    if (!(await checkPushTokenLimit(session.user.id))) {
      return errorResponse(
        "Terlalu banyak permintaan pendaftaran token. Coba lagi 1 jam lagi.",
        429
      );
    }

    const body = await request.json().catch(() => ({}));
    const { token } = body;

    if (!token || typeof token !== "string") {
      return errorResponse("Token wajib diisi", 400);
    }

    // Hanya hapus jika token milik user yang sedang logout (keamanan)
    await prisma.deviceToken.deleteMany({
      where: { token, userId: session.user.id },
    });

    // Bersihkan juga dari User.expoPushToken jika sama
    await prisma.user.updateMany({
      where: { id: session.user.id, expoPushToken: token },
      data: { expoPushToken: null },
    }).catch(() => {});

    return successResponse({}, "Token perangkat berhasil dihapus");
  } catch (error) {
    console.error("[DELETE_DEVICE_TOKEN_ERROR]", error);
    return errorResponse("Gagal menghapus token perangkat");
  }
}
