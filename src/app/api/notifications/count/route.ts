import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/utils/api';
import { hasMinimumRole } from '@/lib/utils/role';
import prisma from '@/lib/prisma';
import { Prisma, Role } from '@prisma/client';

/**
 * GET /api/notifications/count
 *
 * PENTEST FIX (22 Nov 2026, M23): dulu tanpa cek role — KASIR mana pun
 * mendapat hitungan bisnis seluruh toko (DO PENDING, piutang jatuh tempo,
 * order hari ini). Sekarang hitungan bisnis hanya untuk ADMIN+.
 * Non-ADMIN tetap mendapat angka loncengnya sendiri: jumlah notifikasi
 * belum dibaca yang memang ditujukan ke user/role-nya (scope sama seperti
 * GET /api/notifications), supaya badge notifikasi APK tetap jalan.
 */
export async function GET() {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    if (hasMinimumRole(session, 'ADMIN')) {
      // NOTE (Nov 2026): hitungan WaOrder DIHAPUS — endpoint WA order & bot
      // dihapus atas permintaan pemilik. Field `waOrders` dipertahankan = 0
      // supaya APK lama yang membaca field ini tidak error.
      const [deliveriesPending, overdueDebts, todayOrders] = await Promise.all([
        prisma.deliveryOrder.count({
          where: { status: 'PENDING' }
        }),
        prisma.customerDebt.count({
          where: {
            status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] },
            dueDate: { lt: new Date() }
          }
        }),
        prisma.sale.count({
          where: { createdAt: { gte: todayStart } }
        })
      ]);

      const totalUnread = deliveriesPending + overdueDebts;

      return NextResponse.json({
        success: true,
        data: {
          total: totalUnread,
          waOrders: 0,
          deliveries: deliveriesPending,
          overdueDebts,
          todayOrders
        }
      });
    }

    // Non-ADMIN: hanya hitungan notifikasi miliknya sendiri.
    const userRole = session.user.role as Role;
    const unreadCount = await prisma.notification.count({
      where: {
        OR: [
          { userId: session.user.id },
          { role: userRole },
          { role: null },
          ...(userRole === 'SUPER_ADMIN' ? [{ role: 'ADMIN' as Role }] : []),
        ],
        isRead: false,
      } satisfies Prisma.NotificationWhereInput,
    });

    return NextResponse.json({
      success: true,
      data: {
        total: unreadCount,
        waOrders: 0,
        deliveries: 0,
        overdueDebts: 0,
        todayOrders: 0
      }
    });
  } catch (error) {
    console.error('[API NOTIFICATIONS COUNT]', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil jumlah notifikasi' },
      { status: 500 }
    );
  }
}
