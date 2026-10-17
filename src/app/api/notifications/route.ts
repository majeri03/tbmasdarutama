import { NextRequest } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse, successResponse, errorResponse } from "@/lib/utils/api";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

/**
 * GET /api/notifications
 * Mengambil daftar riwayat notifikasi dari database PostgreSQL.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 100);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const unreadOnly = searchParams.get("unread") === "true";

    const userRole = session.user.role as Role;
    const userId = session.user.id;

    // Filter notifikasi milik user atau role-nya
    const whereClause: any = {
      OR: [
        { userId: userId },
        { role: userRole },
        ...(userRole === "SUPER_ADMIN" || userRole === "ADMIN" ? [{ role: "ADMIN" as Role }, { role: null }] : []),
      ],
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.notification.count({ where: whereClause }),
      prisma.notification.count({
        where: {
          ...whereClause,
          isRead: false,
        },
      }),
    ]);

    return successResponse({
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    });
  } catch (error) {
    console.error("[API_NOTIFICATIONS_GET_ERROR]", error);
    return errorResponse("Gagal mengambil data notifikasi");
  }
}

/**
 * PATCH /api/notifications
 * Menandai notifikasi sebagai terbaca (by ID atau all).
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user) return unauthorizedResponse();

    const body = await request.json();
    const { id, readAll } = body;

    if (readAll) {
      const userRole = session.user.role as Role;
      await prisma.notification.updateMany({
        where: {
          OR: [
            { userId: session.user.id },
            { role: userRole },
            ...(userRole === "SUPER_ADMIN" || userRole === "ADMIN" ? [{ role: "ADMIN" as Role }, { role: null }] : []),
          ],
          isRead: false,
        },
        data: { isRead: true },
      });
      return successResponse({ success: true }, "Semua notifikasi ditandai telah dibaca");
    }

    if (id) {
      await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });
      return successResponse({ success: true }, "Notifikasi ditandai telah dibaca");
    }

    return errorResponse("id atau readAll wajib disertakan", 400);
  } catch (error) {
    console.error("[API_NOTIFICATIONS_PATCH_ERROR]", error);
    return errorResponse("Gagal memperbarui status notifikasi");
  }
}


