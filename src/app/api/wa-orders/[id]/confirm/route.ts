import { NextRequest, NextResponse } from 'next/server';
import { confirmWaOrder } from '@/lib/actions/wa-order.actions';
import { auth } from '@/lib/auth';

// POST /api/wa-orders/[id]/confirm - Konfirmasi orderan WA → buat Delivery Order
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { customerId, deliveryDate, driver, vehicle, notes, items, createDeliveryOrder } = body;

    // Jika membuat surat jalan (default true jika tidak dikirim)
    const shouldCreateDO = createDeliveryOrder !== false;

    if (!customerId || !items?.length) {
      return NextResponse.json(
        { success: false, message: 'customerId dan items wajib diisi' },
        { status: 400 }
      );
    }
    
    if (shouldCreateDO && !deliveryDate) {
      return NextResponse.json(
        { success: false, message: 'deliveryDate wajib diisi jika membuat surat jalan' },
        { status: 400 }
      );
    }

    const result = await confirmWaOrder(id, {
      customerId,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
      driver,
      vehicle,
      notes,
      createDeliveryOrder: shouldCreateDO,
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
