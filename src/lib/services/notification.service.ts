import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import prisma from '@/lib/prisma';
import { DebtStatus, NotificationType, Prisma, Role } from '@prisma/client';

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
  /** Kunci dedup lintas jalur (push vs polling vs lokal), mis. `sale-<id>`. */
  dedupKey?: string;
}

export class NotificationService {
  static async send(options: SendNotificationOptions): Promise<void> {
    try {
      // PENTEST FIX (22 Nov 2026, L15): notifikasi personal (userId)
      // tidak boleh membawa role — kalau keduanya terisi, baris itu
      // akan terlihat oleh semua pemegang role tersebut (celah laten
      // OR di query notifikasi). Paksa role=null untuk notifikasi personal.
      const effectiveRole = options.userId ? null : (options.role ?? null);
      if (options.userId && options.role) {
        console.warn(
          `[NotificationService] send() dipanggil dengan userId + role sekaligus (type=${options.type}) — role diabaikan, notifikasi dicatat sebagai personal.`,
        );
      }

      // 1. Simpan ke database
      const saved = await prisma.notification.create({
        data: {
          userId: options.userId ?? null,
          role: effectiveRole,
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
        const targetRoles: Role[] = options.role
          ? (options.role === 'ADMIN' ? ['SUPER_ADMIN', 'ADMIN', 'KASIR'] : [options.role, 'SUPER_ADMIN'])
          : ['SUPER_ADMIN', 'ADMIN', 'KASIR'];
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
      if (validTokens.length === 0) {
        // FIX (Nov 2026): sebelumnya diam-diam return di sini, jadi notifikasi
        // tersimpan di DB tapi tidak ada push — dan tidak ada jejak di log.
        // Sekarang dicatat supaya ketahuan kalau token HP belum terdaftar.
        console.warn(
          `[NotificationService] TIDAK ADA TOKEN VALID untuk "${options.title}" (type=${options.type}, role=${options.role ?? '-'}, userId=${options.userId ?? '-'}, total token di DB=${tokens.length}). Push TIDAK dikirim, hanya tersimpan di DB. Cek: APK sudah login & izinkan notifikasi? Token sudah masuk tabel device_tokens?`,
        );
        return;
      }

      // 3. Bangun payload pesan
      const messages: ExpoPushMessage[] = validTokens.map((token) => ({
        to: token,
        sound: 'masdar_utama.mp3',
        title: options.title,
        body: options.body,
        data: {
          id: saved.id,
          type: options.type,
          screen: options.screen ?? 'NotificationCenter',
          params: options.params ?? {},
          ...(options.dedupKey ? { dedupKey: options.dedupKey } : {}),
        },
        channelId: options.channelId ?? 'masdar_channel_v3',
        priority: 'high',
        badge: 1,
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
            } else if (ticket.status === 'error') {
              // FIX (Nov 2026): error push selain DeviceNotRegistered sebelumnya
              // diabaikan begitu saja. Sekarang dicatat, mis. FCM belum
              // dikonfigurasi di Expo / token tidak valid.
              console.error('[NotificationService] Push ticket error:', ticket.details?.error, ticket.message ?? '');
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
    const title = '🛒 Pesanan Baru Masuk!';
    const body = `${customerName} — Invoice #${invoiceNumber} (Rp ${amount.toLocaleString('id-ID')})`;
    // Jaring pengaman: kalau ada pemanggil ganda di masa depan, notif yang sama
    // (judul+isi persis) tidak terkirim 2x dalam 5 menit.
    if (await this.alreadyNotifiedRecently('NEW_ORDER', title, body, 5 / 60)) return;
    await this.send({
      role: 'ADMIN',
      title,
      body,
      type: 'NEW_ORDER',
      screen: 'History',
      // invoiceNumber dibaca TransactionHistoryScreen untuk auto-filter saat diketuk.
      params: { saleId, invoiceNumber },
      channelId: 'masdar_channel_v3',
      dedupKey: `sale-${saleId}`,
    });
  }

  // NOTE (Nov 2026): onWaOrderReceived DIHAPUS bersama endpoint WA order
  // (src/app/api/wa-orders dihapus — pemilik tidak memakai order WA / bot).
  // Satu-satunya pemanggil method ini adalah route WA yang sudah dihapus.

  static async onDeliveryUpdate(doId: string, doNumber: string, status: string) {
    const statusLabel: Record<string, string> = {
      IN_TRANSIT: '🚛 Barang Sedang Diantar',
      DELIVERED: '✅ Pengiriman Selesai / Terkirim',
      PENDING: '📦 Surat Jalan Baru Siap Muat',
      // FIX (22 Nov 2026): label CANCELLED — sebelumnya pembatalan DO jatuh
      // ke judul generik 'Update Pengiriman'.
      CANCELLED: '❌ Pengiriman Dibatalkan',
    };
    const title = statusLabel[status] ?? 'Update Pengiriman';
    const body = `Surat Jalan #${doNumber} status: ${status}`;

    // FIX (22 Nov 2026): dedup backend 5 menit (DO + status yang sama),
    // seperti onNewOrder. Sebelumnya kalau dipanggil 2x, backend menulis
    // 2 baris DB + 2 push dan hanya mengandalkan dedup di APK.
    if (await this.alreadyNotifiedRecently('DELIVERY_UPDATE', title, body, 5 / 60)) return;

    await this.send({
      role: 'ADMIN',
      title,
      body,
      type: 'DELIVERY_UPDATE',
      screen: 'Delivery',
      // doNumber dibaca DeliveryScreen untuk auto-filter saat diketuk.
      params: { doId, doNumber },
      channelId: 'masdar_channel_v3',
      dedupKey: `do-${doId}-${status}`,
    });

    // NOTE (22 Nov 2026): cabang kirim ke sopir (parameter driverUserId)
    // DIHAPUS — tidak ada kaitan sopir↔akun di model data (DeliveryOrder
    // .driver dan FleetVehicle.driverName hanya nama bebas), dan kedua
    // pemanggil memang selalu mengoper undefined, jadi cabang itu mati.
    // Kalau nanti ada akun sopir yang terikat ke DO, hidupkan lagi dengan
    // userId sopir yang benar.
  }

  static async onPaymentReceived(
    name: string,
    amount: number,
    // FIX (22 Nov 2026): pembayaran utang SUPPLIER sebelumnya tidak pernah
    // ternotifikasi. Parameter kind membedakan piutang customer vs utang
    // supplier; default 'customer' supaya pemanggil lama tidak berubah.
    kind: 'customer' | 'supplier' = 'customer',
  ) {
    const isSupplier = kind === 'supplier';
    await this.send({
      role: 'ADMIN',
      title: isSupplier ? '💰 Pembayaran Utang Supplier' : '💰 Pembayaran Piutang Masuk',
      body: isSupplier
        ? `Utang ke ${name} dibayar Rp ${amount.toLocaleString('id-ID')}`
        : `${name} membayar cicilan/pelunasan Rp ${amount.toLocaleString('id-ID')}`,
      type: 'PAYMENT_RECEIVED',
      screen: 'Debt',
      // Nama dibaca DebtScreen untuk auto-filter saat diketuk.
      params: isSupplier ? { supplierName: name } : { customerName: name },
      channelId: 'masdar_channel_v3',
      // Sengaja tanpa dedupKey: dua pembayaran sah yang sama (nama +
      // jumlah sama) dalam waktu berdekatan harus tetap terkirim dua-duanya.
    });
  }

  // ── FIX (Nov 2026): pemicu yang sebelumnya tidak ada sama sekali ──────────
  // onDebtOverdue / onLowStock ada idenya di notify.ts tapi tidak pernah
  // dipanggil dari mana pun, jadi hutang jatuh tempo & stok rendah tidak
  // pernah jadi push. Keduanya didedup 24 jam supaya tidak spam tiap cek.

  private static async alreadyNotifiedRecently(
    type: NotificationType,
    title: string,
    body: string,
    hours = 24,
  ): Promise<boolean> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const existing = await prisma.notification.findFirst({
      where: { type, title, body, createdAt: { gte: since } },
      select: { id: true },
    });
    return !!existing;
  }

  /** Hutang/piutang jatuh tempo. Return false kalau sudah dikirim <24 jam lalu. */
  static async onDebtOverdue(customerName: string, amount: number): Promise<boolean> {
    const title = '⚠️ Piutang Jatuh Tempo';
    const body = `${customerName} — Sisa Rp ${Number(amount).toLocaleString('id-ID')}`;
    if (await this.alreadyNotifiedRecently('DEBT_DUE', title, body)) return false;
    await this.send({
      role: 'ADMIN',
      title,
      body,
      type: 'DEBT_DUE',
      screen: 'Debt',
      params: { customerName },
      channelId: 'masdar_channel_v3',
    });
    return true;
  }

  /** Stok di bawah minimum. Return false kalau sudah dikirim <24 jam lalu. */
  static async onLowStock(productName: string, currentStock: number, minStock: number): Promise<boolean> {
    const title = '📉 Stok Rendah!';
    const body = `${productName} tersisa ${currentStock} (min. ${minStock}). Segera lakukan pembelian.`;
    if (await this.alreadyNotifiedRecently('LOW_STOCK', title, body)) return false;
    await this.send({
      role: 'ADMIN',
      title,
      body,
      type: 'LOW_STOCK',
      screen: 'Products',
      channelId: 'masdar_channel_v3',
    });
    return true;
  }

  /** Cek stok rendah hanya untuk produk yang baru terjual (dipanggil setelah POS). */
  static async checkLowStockForProductIds(productIds: string[]): Promise<number> {
    if (productIds.length === 0) return 0;
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { name: true, currentStock: true, minStock: true },
    });
    let sent = 0;
    for (const p of products) {
      if (p.minStock > 0 && p.currentStock <= p.minStock) {
        if (await this.onLowStock(p.name, p.currentStock, p.minStock)) sent++;
      }
    }
    return sent;
  }

  /**
   * Cek berkala (dipanggil endpoint /api/notifications/check-overdue):
   * semua piutang yang sudah lewat jatuh tempo + semua produk stok rendah.
   * Dipakai cron harian — dedup 24 jam ada di onDebtOverdue / onLowStock.
   */
  static async checkOverdueAndLowStock(): Promise<{ debtSent: number; stockSent: number }> {
    // FIX (22 Nov 2026): proses per halaman sampai habis, bukan cap 50
    // hutang / 200 produk. Hutang ke-51+ sebelumnya tidak pernah
    // ternotifikasi pada run itu. Dedup 24 jam di onDebtOverdue /
    // onLowStock tetap membatasi spam.
    let debtSent = 0;
    const DEBT_PAGE = 50;
    let debtSkip = 0;
    for (;;) {
      const page = await prisma.customerDebt.findMany({
        where: {
          dueDate: { lt: new Date() },
          remainingDebt: { gt: 0 },
          status: { in: [DebtStatus.UNPAID, DebtStatus.PARTIAL, DebtStatus.OVERDUE] },
        },
        include: { customer: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
        take: DEBT_PAGE,
        skip: debtSkip,
      });
      if (page.length === 0) break;
      for (const d of page) {
        if (await this.onDebtOverdue(d.customer?.name ?? 'Pelanggan', Number(d.remainingDebt))) debtSent++;
      }
      debtSkip += page.length;
      if (page.length < DEBT_PAGE) break;
    }

    let stockSent = 0;
    const STOCK_PAGE = 200;
    let stockSkip = 0;
    for (;;) {
      const page = await prisma.product.findMany({
        where: { isActive: true },
        select: { name: true, currentStock: true, minStock: true },
        orderBy: { name: 'asc' },
        take: STOCK_PAGE,
        skip: stockSkip,
      });
      if (page.length === 0) break;
      for (const p of page) {
        if (p.minStock > 0 && p.currentStock <= p.minStock) {
          if (await this.onLowStock(p.name, p.currentStock, p.minStock)) stockSent++;
        }
      }
      stockSkip += page.length;
      if (page.length < STOCK_PAGE) break;
    }
    return { debtSent, stockSent };
  }
}
