import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/utils/api';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [waOrdersPending, deliveriesPending, overdueDebts, todayOrders] = await Promise.all([
      prisma.waOrder.count({
        where: { status: 'PENDING' }
      }),
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

    const totalUnread = waOrdersPending + deliveriesPending + overdueDebts;

    return NextResponse.json({
      success: true,
      data: {
        total: totalUnread,
        waOrders: waOrdersPending,
        deliveries: deliveriesPending,
        overdueDebts,
        todayOrders
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
