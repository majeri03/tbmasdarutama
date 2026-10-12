import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/utils/api';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    const userId = session?.user?.id;
    const userEmail = session?.user?.email;
    if (!userId && !userEmail) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ success: false, message: 'Token is required' }, { status: 400 });
    }

    await prisma.user.updateMany({
      where: {
        OR: [
          ...(userId ? [{ id: userId }] : []),
          ...(userEmail ? [{ email: userEmail }] : []),
        ],
      },
      data: { expoPushToken: token },
    });

    return NextResponse.json({ success: true, message: 'Push token saved successfully' });
  } catch (error) {
    console.error('[API PUSH TOKEN]', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save push token' },
      { status: 500 }
    );
  }
}
