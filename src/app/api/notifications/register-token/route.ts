import { NextRequest } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse, successResponse, errorResponse } from "@/lib/utils/api";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user?.id) return unauthorizedResponse();

    const body = await request.json();
    const { token, platform, deviceName } = body;

    if (!token || typeof token !== "string") {
      return errorResponse("Token wajib diisi", 400);
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
