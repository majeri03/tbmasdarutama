import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const [waOrdersPending, deliveriesPending] = await Promise.all([
      prisma.waOrder.count({
        where: { status: 'PENDING' }
      }),
      prisma.deliveryOrder.count({
        where: { status: 'PENDING' }
      })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        waOrders: waOrdersPending,
        deliveries: deliveriesPending,
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
