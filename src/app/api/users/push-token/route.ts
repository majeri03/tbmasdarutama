import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/utils/api';
import prisma from '@/lib/prisma';

/**
 * PENTEST FIX (22 Nov 2026, M3 — susulan): token push orang lain tidak
 * boleh diklaim lewat upsert. Logika sama seperti
 * src/app/api/notifications/register-token/route.ts: token yang sudah
 * terikat ke user lain ditolak diam-diam (sukses generik, tanpa
 * menimpa), dan format token divalidasi (Expo push token + batas
 * panjang). Sebelumnya upsert berdasarkan nilai token menimpa userId
 * menjadi milik penyerang kalau dia tahu nilai token korban.
 */
const EXPO_PUSH_TOKEN_RE = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;
const MAX_PUSH_TOKEN_LENGTH = 255;

function isValidPushToken(token: string): boolean {
  if (token.length === 0 || token.length > MAX_PUSH_TOKEN_LENGTH) return false;
  if (/\s/.test(token)) return false;
  return EXPO_PUSH_TOKEN_RE.test(token);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    const userId = session?.user?.id;
    const userEmail = session?.user?.email;
    if (!userId && !userEmail) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ success: false, message: 'Token is required' }, { status: 400 });
    }
    if (!isValidPushToken(token)) {
      return NextResponse.json({ success: false, message: 'Format token perangkat tidak valid' }, { status: 400 });
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          ...(userId ? [{ id: userId }] : []),
          ...(userEmail ? [{ email: userEmail }] : []),
        ],
      },
      select: { id: true },
    });

    if (targetUser) {
      // Tolak klaim token milik user lain — tanpa membocorkan siapa pemiliknya.
      const existing = await prisma.deviceToken.findUnique({
        where: { token },
        select: { id: true, userId: true },
      });
      if (existing && existing.userId !== targetUser.id) {
        return NextResponse.json({ success: true, message: 'Push token saved successfully' });
      }

      await prisma.deviceToken.upsert({
        where: { token },
        update: {
          userId: targetUser.id,
          lastSeenAt: new Date(),
        },
        create: {
          userId: targetUser.id,
          token,
          platform: "android",
          lastSeenAt: new Date(),
        },
      });

      await prisma.user.update({
        where: { id: targetUser.id },
        data: { expoPushToken: token },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, message: 'Push token saved successfully' });
  } catch (error) {
    console.error('[API PUSH TOKEN]', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save push token' },
      { status: 500 }
    );
  }
}
