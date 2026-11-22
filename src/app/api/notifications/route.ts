import { NextRequest } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse, successResponse, errorResponse, parsePageLimit } from "@/lib/utils/api";
import prisma from "@/lib/prisma";
import { Prisma, Role } from "@prisma/client";

/**
 * PENTEST FIX (22 Nov 2026, L15): satu definisi scope notifikasi yang
 * dipakai keempat handler (GET, PATCH id, PATCH readAll, DELETE).
 * Sebelumnya definisinya beda-beda: broadcast ({role: null}) ikut di GET
 * dan PATCH id untuk semua role, tapi tidak di readAll/DELETE kecuali
 * ADMIN+ — kasir bisa membaca/menandai broadcast satu-per-satu tapi
 * tidak bisa readAll/menghapusnya. Sekarang konsisten: notifikasi milik
 * user, notifikasi role-nya, broadcast umum, plus ADMIN-role untuk
 * SUPER_ADMIN.
 */
function notificationScopeWhere(session: { user: { id: string; role: string } }): Prisma.NotificationWhereInput {
  const userRole = session.user.role as Role;
  return {
    OR: [
      { userId: session.user.id },
      { role: userRole },
      { role: null }, // broadcast umum selalu terlihat oleh semua staff
      ...(userRole === "SUPER_ADMIN" ? [{ role: "ADMIN" as Role }] : []),
    ],
  };
}

/**
 * GET /api/notifications
 * Mengambil daftar riwayat notifikasi dari database PostgreSQL.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    // PENTEST FIX (L16): parseInt("abc") = NaN dulu diteruskan ke Prisma
    // (take/skip NaN -> 500). Sekarang pakai helper yang fallback ke default.
    const { page, limit } = parsePageLimit(searchParams);
    const unreadOnly = searchParams.get("unread") === "true";

    // Filter notifikasi milik user atau role-nya
    const whereClause: Prisma.NotificationWhereInput = {
      ...notificationScopeWhere(session),
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
      await prisma.notification.updateMany({
        where: {
          ...notificationScopeWhere(session),
          isRead: false,
        },
        data: { isRead: true },
      });
      return successResponse({ success: true }, "Semua notifikasi ditandai telah dibaca");
    }

    if (id) {
      // SECURITY FIX (Nov 2026, H5): sebelumnya update by id tanpa batasan —
      // kasir mana pun bisa menandai notifikasi admin sebagai dibaca.
      // Sekarang hanya notifikasi milik user / role-nya yang bisa diubah.
      const scopedWhere: Prisma.NotificationWhereInput = {
        id,
        ...notificationScopeWhere(session),
      };
      const res = await prisma.notification.updateMany({
        where: scopedWhere,
        data: { isRead: true },
      });
      if (res.count === 0) return errorResponse("Notifikasi tidak ditemukan", 404);
      return successResponse({ success: true }, "Notifikasi ditandai telah dibaca");
    }

    return errorResponse("id atau readAll wajib disertakan", 400);
  } catch (error) {
    console.error("[API_NOTIFICATIONS_PATCH_ERROR]", error);
    return errorResponse("Gagal memperbarui status notifikasi");
  }
}

/**
 * DELETE /api/notifications
 * Menghapus notifikasi:
 * - clearRead: true -> hapus notifikasi yang sudah dibaca milik user
 * - olderThanDays: 3 -> hapus notifikasi yang sudah lewat 3 hari
 * - id: string -> hapus notifikasi spesifik
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const clearRead = searchParams.get("clearRead") === "true";
    const olderThanDays = searchParams.get("olderThanDays");

    const baseWhere: Prisma.NotificationWhereInput = notificationScopeWhere(session);

    if (id) {
      // SECURITY FIX (Nov 2026, H5): sama seperti PATCH — hapus hanya kalau
      // notifikasi itu milik user / role-nya (baseWhere yang sebelumnya
      // dihitung tapi tidak dipakai di cabang ini).
      const res = await prisma.notification.deleteMany({
        where: { id, ...baseWhere },
      });
      if (res.count === 0) return errorResponse("Notifikasi tidak ditemukan", 404);
      return successResponse({ success: true }, "Notifikasi berhasil dihapus");
    }

    if (clearRead) {
      const res = await prisma.notification.deleteMany({
        where: {
          ...baseWhere,
          isRead: true,
        },
      });
      return successResponse({ success: true, count: res.count }, `Berhasil membersihkan ${res.count} notifikasi terbaca`);
    }

    if (olderThanDays) {
      // PENTEST FIX (L16/M14): dulu parseInt("-5") lolos -> cutoff di masa
      // depan -> SEMUA notifikasi dalam scope ikut terhapus. Sekarang
      // wajib bilangan bulat 1-365.
      const days = Number(olderThanDays);
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        return errorResponse("olderThanDays harus bilangan bulat 1–365", 400);
      }
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const res = await prisma.notification.deleteMany({
        where: {
          ...baseWhere,
          createdAt: { lt: cutoff },
        },
      });
      return successResponse({ success: true, count: res.count }, `Berhasil membersihkan notifikasi yang lebih dari ${days} hari`);
    }

    return errorResponse("Parameter penghapusan tidak valid", 400);
  } catch (error) {
    console.error("[API_NOTIFICATIONS_DELETE_ERROR]", error);
    return errorResponse("Gagal menghapus notifikasi");
  }
}


