import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser, unauthorizedResponse, errorResponse, successResponse } from '@/lib/utils/api';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

    const order = await prisma.waOrder.findUnique({ where: { id } });
    if (!order) {
      return errorResponse('Orderan tidak ditemukan', 404);
    }

    const updated = await prisma.waOrder.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedReason: reason || 'Ditolak dari aplikasi',
        confirmedById: session.user.id,
        confirmedAt: new Date(),
      },
    });

    // Send webhook to wa-bot
    try {
      await fetch('http://localhost:3001/webhook/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: order.senderPhone,
          text: `❌ Mohon maaf, orderan Anda kami tolak karena: ${reason || 'Alasan lain'}.\nSilakan hubungi Admin untuk info lebih lanjut.`,
          apiKey: process.env.BOT_API_KEY || process.env.WA_BOT_API_KEY || ''
        })
      });
    } catch (webhookErr) {
      console.error('[WA-ORDER REJECT] Gagal memanggil webhook bot', webhookErr);
    }

    return successResponse(updated, 'Orderan WA berhasil ditolak');
  } catch (error) {
    console.error('[WA-ORDER REJECT POST]', error);
    return errorResponse('Gagal menolak orderan', 500);
  }
}
