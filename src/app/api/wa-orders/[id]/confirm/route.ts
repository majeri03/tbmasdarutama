import { NextRequest, NextResponse } from 'next/server';
import { confirmWaOrder } from '@/lib/actions/wa-order.actions';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// POST /api/wa-orders/[id]/confirm - Konfirmasi orderan WA → buat Delivery Order
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { customerId, deliveryDate, driver, vehicle, notes, items } = body;

    if (!customerId || !deliveryDate || !items?.length) {
      return NextResponse.json(
        { success: false, message: 'customerId, deliveryDate, dan items wajib diisi' },
        { status: 400 }
      );
    }

    const result = await confirmWaOrder(id, {
      customerId,
      deliveryDate: new Date(deliveryDate),
      driver,
      vehicle,
      notes,
      items,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    console.error('[WA-ORDER CONFIRM]', error);
    return NextResponse.json({ success: false, message: 'Gagal konfirmasi orderan' }, { status: 500 });
  }
}
