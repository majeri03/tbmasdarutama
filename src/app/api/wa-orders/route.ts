import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { WaOrderStatus } from '@prisma/client';

// GET /api/wa-orders - List semua orderan WA
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as WaOrderStatus | null;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where = status ? { status } : {};

    // Auto-delete CONFIRMED/REJECTED orders older than 7 days
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      await prisma.waOrder.deleteMany({
        where: {
          status: { in: ['CONFIRMED', 'REJECTED'] },
          createdAt: { lt: sevenDaysAgo }
        }
      });
    } catch (e) {
      console.error('[WA-ORDERS AUTO-CLEANUP]', e);
    }

    const [orders, total] = await Promise.all([
      prisma.waOrder.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip,
        take: limit,
        include: {
          confirmedBy: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.waOrder.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[WA-ORDERS GET]', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil data' }, { status: 500 });
  }
}

// POST /api/wa-orders - Terima orderan baru dari bot WA
export async function POST(request: NextRequest) {
  try {
    // Validasi API key dari bot
    const apiKey = request.headers.get('x-bot-api-key');
    const validKey = process.env.WA_BOT_API_KEY;
    if (validKey && apiKey !== validKey) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { rawMessage, senderPhone, senderName, groupName, parsedItems, customerName, notes } = body;

    if (!rawMessage || !senderPhone || !senderName) {
      return NextResponse.json(
        { success: false, message: 'rawMessage, senderPhone, senderName wajib diisi' },
        { status: 400 }
      );
    }

    const waOrder = await prisma.waOrder.create({
      data: {
        rawMessage,
        senderPhone,
        senderName,
        groupName,
        parsedItems: parsedItems || null,
        customerName,
        notes,
        status: 'PENDING',
      },
    });

    return NextResponse.json({ success: true, data: waOrder }, { status: 201 });
  } catch (error) {
    console.error('[WA-ORDERS POST]', error);
    return NextResponse.json({ success: false, message: 'Gagal menyimpan orderan' }, { status: 500 });
  }
}
