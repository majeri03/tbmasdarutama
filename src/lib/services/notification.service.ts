import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import prisma from '@/lib/prisma';
import { NotificationType, Prisma, Role } from '@prisma/client';

const expo = new Expo();

export interface SendNotificationOptions {
  userId?: string;
  role?: Role;
  title: string;
  body: string;
  type: NotificationType;
  screen?: string;
  params?: Record<string, unknown>;
  channelId?: string;
}

export class NotificationService {
  static async send(options: SendNotificationOptions): Promise<void> {
    try {
      // 1. Simpan ke database
      const saved = await prisma.notification.create({
        data: {
          userId: options.userId ?? null,
          role: options.role ?? null,
          title: options.title,
          body: options.body,
          type: options.type,
          screen: options.screen ?? null,
          params: (options.params as Prisma.InputJsonValue) ?? undefined,
          isRead: false,
        },
      });

      // 2. Query target tokens
      let tokens: string[] = [];

      if (options.userId) {
        const devs = await prisma.deviceToken.findMany({
          where: { userId: options.userId },
          select: { token: true },
        });
        tokens = devs.map((d) => d.token);

        const u = await prisma.user.findUnique({
          where: { id: options.userId },
          select: { expoPushToken: true },
        });
        if (u?.expoPushToken && !tokens.includes(u.expoPushToken)) tokens.push(u.expoPushToken);
      } else {
        const targetRoles: Role[] = options.role ? [options.role, 'SUPER_ADMIN'] : ['SUPER_ADMIN', 'ADMIN'];
        const devs = await prisma.deviceToken.findMany({
          where: { user: { role: { in: targetRoles }, isActive: true } },
          select: { token: true },
        });
        tokens = devs.map((d) => d.token);

        const users = await prisma.user.findMany({
          where: { role: { in: targetRoles }, isActive: true, expoPushToken: { not: null } },
          select: { expoPushToken: true },
        });
        for (const u of users) {
          if (u.expoPushToken && !tokens.includes(u.expoPushToken)) tokens.push(u.expoPushToken);
        }
      }

      const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t));
      if (validTokens.length === 0) return;

      // 3. Bangun payload pesan
      const messages: ExpoPushMessage[] = validTokens.map((token) => ({
        to: token,
        sound: 'default',
        title: options.title,
        body: options.body,
        data: {
          id: saved.id,
          type: options.type,
          screen: options.screen ?? 'NotificationCenter',
          params: options.params ?? {},
        },
        channelId: options.channelId ?? 'default',
        priority: 'high',
      }));

      // 4. Batching & pengiriman
      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        try {
          const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);
          for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i];
            if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
              const msg = chunk[i];
              const deadToken = typeof msg.to === 'string' ? msg.to : (Array.isArray(msg.to) ? msg.to[0] : null);
              if (deadToken && typeof deadToken === 'string') {
                await prisma.deviceToken.deleteMany({ where: { token: deadToken } }).catch(() => {});
                await prisma.user.updateMany({ where: { expoPushToken: deadToken }, data: { expoPushToken: null } }).catch(() => {});
              }
            }
          }
        } catch (e) {
          console.error('[NotificationService] Push chunk error:', e);
        }
      }
    } catch (err) {
      console.error('[NotificationService] Error dispatching notification:', err);
    }
  }

  static async onNewOrder(saleId: string, invoiceNumber: string, customerName: string, amount: number) {
    await this.send({
      role: 'ADMIN',
      title: '🛒 Pesanan Baru Masuk!',
      body: `${customerName} — Invoice #${invoiceNumber} (Rp ${amount.toLocaleString('id-ID')})`,
      type: 'NEW_ORDER',
      screen: 'History',
      params: { saleId },
      channelId: 'orders',
    });
  }

  static async onWaOrderReceived(waOrderId: string, senderName: string, senderPhone: string) {
    await this.send({
      role: 'ADMIN',
      title: '📱 Pesanan WA Baru!',
      body: `Dari ${senderName} (${senderPhone}). Segera tinjau & konfirmasi.`,
      type: 'NEW_ORDER',
      screen: 'NotificationCenter',
      params: { waOrderId },
      channelId: 'orders',
    });
  }

  static async onDeliveryUpdate(doId: string, doNumber: string, status: string, driverUserId?: string) {
    const statusLabel: Record<string, string> = {
      IN_TRANSIT: '🚛 Barang Sedang Diantar',
      DELIVERED: '✅ Pengiriman Selesai / Terkirim',
      PENDING: '📦 Surat Jalan Baru Siap Muat',
    };
    const title = statusLabel[status] ?? 'Update Pengiriman';

    await this.send({
      role: 'ADMIN',
      title,
      body: `Surat Jalan #${doNumber} status: ${status}`,
      type: 'DELIVERY_UPDATE',
      screen: 'Delivery',
      params: { doId },
      channelId: 'deliveries',
    });

    if (driverUserId) {
      await this.send({
        userId: driverUserId,
        title,
        body: `Tugas #${doNumber}: status diperbarui menjadi ${status}`,
        type: 'DELIVERY_UPDATE',
        screen: 'Delivery',
        params: { doId },
        channelId: 'deliveries',
      });
    }
  }

  static async onPaymentReceived(customerName: string, amount: number) {
    await this.send({
      role: 'ADMIN',
      title: '💰 Pembayaran Piutang Masuk',
      body: `${customerName} membayar cicilan/pelunasan Rp ${amount.toLocaleString('id-ID')}`,
      type: 'PAYMENT_RECEIVED',
      screen: 'Debt',
      channelId: 'finance',
    });
  }
}
