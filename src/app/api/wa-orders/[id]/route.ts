import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET /api/wa-orders/[id] - Detail satu orderan
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const order = await prisma.waOrder.findUnique({
      where: { id },
      include: { confirmedBy: { select: { id: true, name: true } } },
    });
    if (!order) {
      return NextResponse.json({ success: false, message: 'Orderan tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('[WA-ORDER GET]', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil data' }, { status: 500 });
  }
}

// PATCH /api/wa-orders/[id] - Update status (REJECT / edit parsedItems)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, rejectedReason, parsedItems, customerName, notes } = body;

    const order = await prisma.waOrder.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ success: false, message: 'Orderan tidak ditemukan' }, { status: 404 });
    }

    const updated = await prisma.waOrder.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(rejectedReason && { rejectedReason }),
        ...(parsedItems && { parsedItems }),
        ...(customerName !== undefined && { customerName }),
        ...(notes !== undefined && { notes }),
        ...(status === 'REJECTED' && {
          confirmedById: session.user.id,
          confirmedAt: new Date(),
        }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[WA-ORDER PATCH]', error);
    return NextResponse.json({ success: false, message: 'Gagal memperbarui orderan' }, { status: 500 });
  }
}
