import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// DELETE /api/wa-orders/cleanup
export async function DELETE(request: NextRequest) {
  try {
    // Validasi API key (bisa dipanggil dari bot WA atau cron external)
    const apiKey = request.headers.get('x-bot-api-key');
    const validKey = process.env.WA_BOT_API_KEY || process.env.BOT_API_KEY;
    
    if (validKey && apiKey !== validKey) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Hitung tanggal 7 hari yang lalu
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Hapus WA Order yang berstatus CONFIRMED (sudah diproses) dan dibuat lebih dari 7 hari lalu
    const result = await prisma.waOrder.deleteMany({
      where: {
        status: 'CONFIRMED',
        createdAt: {
          lt: sevenDaysAgo,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Berhasil menghapus ${result.count} data orderan WA lama.`,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error('[WA-ORDERS CLEANUP]', error);
    return NextResponse.json(
      { success: false, message: 'Gagal membersihkan data orderan WA' },
      { status: 500 }
    );
  }
}
