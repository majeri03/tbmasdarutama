import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import prisma from '@/lib/prisma';
import { DebtStatus, NotificationType, Prisma, Role } from '@prisma/client';
import { sendEmail, generateDebtDueEmail, type DebtDueEmailRow } from '@/lib/utils/email';

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
  // WS-2 (25 Nov 2026): params WAJIB membawa productId — sebelumnya tidak
  // ada params sama sekali, jadi ketukan notifikasi stok rendah di APK hanya
  // membuka daftar produk umum (pengguna harus mencari sendiri produknya).
  // Sekarang APK membuka modal detail produk itu langsung.
  static async onLowStock(productId: string, productName: string, currentStock: number, minStock: number): Promise<boolean> {
    const title = '📉 Stok Rendah!';
    const body = `${productName} tersisa ${currentStock} (min. ${minStock}). Segera lakukan pembelian.`;
    if (await this.alreadyNotifiedRecently('LOW_STOCK', title, body)) return false;
    await this.send({
      role: 'ADMIN',
      title,
      body,
      type: 'LOW_STOCK',
      screen: 'Products',
      params: { productId, productName },
      channelId: 'masdar_channel_v3',
    });
    return true;
  }

  /** Cek stok rendah hanya untuk produk yang baru terjual (dipanggil setelah POS). */
  static async checkLowStockForProductIds(productIds: string[]): Promise<number> {
    if (productIds.length === 0) return 0;
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, currentStock: true, minStock: true },
    });
    let sent = 0;
    for (const p of products) {
      if (p.minStock > 0 && p.currentStock <= p.minStock) {
        if (await this.onLowStock(p.id, p.name, p.currentStock, p.minStock)) sent++;
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
        select: { id: true, name: true, currentStock: true, minStock: true },
        orderBy: { name: 'asc' },
        take: STOCK_PAGE,
        skip: stockSkip,
      });
      if (page.length === 0) break;
      for (const p of page) {
        if (p.minStock > 0 && p.currentStock <= p.minStock) {
          if (await this.onLowStock(p.id, p.name, p.currentStock, p.minStock)) stockSent++;
        }
      }
      stockSkip += page.length;
      if (page.length < STOCK_PAGE) break;
    }
    return { debtSent, stockSent };
  }

  // ── PKG-H (23 Nov 2026): email ringkasan utang jatuh tempo ─────────────
  // Dipanggil endpoint /api/notifications/check-overdue (cron harian
  // 08:00 WITA) setelah push. Satu email ringkasan per hari ke semua
  // penerima aktif — BUKAN satu email per utang.
  //
  // Jadwal pengingat (keputusan pemilik 23 Nov 2026): satu utang
  // mengingatkan 3x — tepat 3 hari, 1 minggu (7 hari), dan 1 bulan
  // (30 hari) SETELAH jatuh tempo. Jadwal ini bisa diubah SUPER_ADMIN
  // di Pengaturan → Notifikasi Utang (disimpan di StoreSetting
  // debtReminderDays, dipisah koma). Email HANYA dikirim pada hari
  // ketika ada utang yang tepat mencapai salah satu tonggak itu;
  // isinya ringkasan SEMUA utang yang sedang jatuh tempo + yang akan
  // jatuh tempo dalam N hari (debtEmailDaysBefore).
  // Dedup: tabel debt_email_logs — kalau hari ini (WITA) sudah ada
  // baris log, lewati. Kalau tidak ada utang yang mencapai tonggak,
  // tidak ada email sama sekali (inbox tidak di-spam).
  // UTANG SUPPLIER ikut diperiksa di sini — sebelumnya tidak pernah
  // ternotifikasi (celah yang ditemukan saat desain).

  // FIX (25 Nov 2026, koordinator — temuan ws-j2): WITA = UTC+8, bukan
  // +7 (itu WIB). Offset +7 membuat batas hari jatuh 23:00 WITA.
  /** Nomor hari kalender (WITA) dari sebuah DateTime. */
  private static witaDayNumber(d: Date): number {
    const w = new Date(d.getTime() + 8 * 60 * 60 * 1000);
    return Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()) / 86400000;
  }

  /** Awal hari ini (WITA) sebagai Date UTC — batas dedup harian. */
  private static witaTodayStart(): Date {
    const nowWita = new Date(Date.now() + 8 * 60 * 60 * 1000);
    return new Date(Date.UTC(nowWita.getUTCFullYear(), nowWita.getUTCMonth(), nowWita.getUTCDate()));
  }

  /** Uraikan "3,7,30" jadi [3, 7, 30]. Rusak/kosong -> default [3, 7, 30]. */
  static parseReminderDays(value?: string | null): number[] {
    const fallback = [3, 7, 30];
    if (!value) return fallback;
    const days = value
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 365);
    const unique = [...new Set(days)].sort((a, b) => a - b);
    return unique.length > 0 ? unique : fallback;
  }

  /** Alamat dasar web dari env (PKG-J: domain baru tbmasdarutama.vercel.app). */
  private static appBaseUrl(): string {
    const raw = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    // Fallback domain BARU — JANGAN hardcode domain lama (masdarutama.tech).
    // NEXT_PUBLIC_APP_URL di Vercel wajib diganti ke domain baru + redeploy.
    return raw || "https://tbmasdarutama.vercel.app";
  }

  /**
   * Deep link aplikasi (skema tbmasdarutama://) untuk tombol "Buka di Aplikasi"
   * di email. Ini BUKAN URL web — skemanya tetap dan tidak memakai domain,
   * jadi tidak terpengaruh migrasi domain (PKG-J).
   */
  private static appDebtLink(kind: "customer" | "supplier"): string {
    return `tbmasdarutama://utang?jenis=${kind}`;
  }

  /** Ambil + kelompokkan semua utang terbuka (piutang + supplier). */
  static async getDebtDueSummary(): Promise<{
    settings: { debtEmailEnabled: boolean; reminderDays: number[]; daysBefore: number };
    customerOverdue: DebtDueEmailRow[];
    customerDueSoon: DebtDueEmailRow[];
    supplierOverdue: DebtDueEmailRow[];
    supplierDueSoon: DebtDueEmailRow[];
    triggeredCount: number;
    totalCustomerOverdue: number;
    totalSupplierOverdue: number;
  }> {
    const setting = await prisma.storeSetting.findFirst();
    const reminderDays = this.parseReminderDays(setting?.debtReminderDays);
    const daysBefore = setting?.debtEmailDaysBefore ?? 3;
    const enabled = setting?.debtEmailEnabled ?? true;
    const todayNum = this.witaDayNumber(new Date());

    const toRow = (name: string, ref: string, dueDate: Date, remaining: number): DebtDueEmailRow => ({
      name,
      ref,
      dueDateLabel: dueDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
      remaining,
      daysOverdue: todayNum - this.witaDayNumber(dueDate),
    });

    const customerOverdue: DebtDueEmailRow[] = [];
    const customerDueSoon: DebtDueEmailRow[] = [];
    const PAGE = 50;
    let skip = 0;
    for (;;) {
      const page = await prisma.customerDebt.findMany({
        where: { remainingDebt: { gt: 0 }, status: { in: [DebtStatus.UNPAID, DebtStatus.PARTIAL, DebtStatus.OVERDUE] } },
        include: { customer: { select: { name: true } }, sale: { select: { invoiceNumber: true } } },
        orderBy: { dueDate: "asc" },
        take: PAGE,
        skip,
      });
      if (page.length === 0) break;
      for (const d of page) {
        const row = toRow(d.customer?.name ?? "Pelanggan", d.sale?.invoiceNumber ?? d.debtNumber, d.dueDate, Number(d.remainingDebt));
        if (row.daysOverdue >= 0) customerOverdue.push(row);
        else if (-row.daysOverdue <= daysBefore) customerDueSoon.push(row);
      }
      skip += page.length;
      if (page.length < PAGE) break;
    }

    const supplierOverdue: DebtDueEmailRow[] = [];
    const supplierDueSoon: DebtDueEmailRow[] = [];
    skip = 0;
    for (;;) {
      const page = await prisma.supplierDebt.findMany({
        where: { remainingDebt: { gt: 0 }, status: { in: [DebtStatus.UNPAID, DebtStatus.PARTIAL, DebtStatus.OVERDUE] } },
        include: { supplier: { select: { name: true } }, purchase: { select: { poNumber: true } } },
        orderBy: { dueDate: "asc" },
        take: PAGE,
        skip,
      });
      if (page.length === 0) break;
      for (const d of page) {
        const row = toRow(d.supplier?.name ?? "Supplier", d.purchase?.poNumber ?? d.debtNumber, d.dueDate, Number(d.remainingDebt));
        if (row.daysOverdue >= 0) supplierOverdue.push(row);
        else if (-row.daysOverdue <= daysBefore) supplierDueSoon.push(row);
      }
      skip += page.length;
      if (page.length < PAGE) break;
    }

    const triggeredCount =
      [...customerOverdue, ...supplierOverdue].filter((r) => reminderDays.includes(r.daysOverdue)).length;

    return {
      settings: { debtEmailEnabled: enabled, reminderDays, daysBefore },
      customerOverdue,
      customerDueSoon,
      supplierOverdue,
      supplierDueSoon,
      triggeredCount,
      totalCustomerOverdue: customerOverdue.reduce((s, r) => s + r.remaining, 0),
      totalSupplierOverdue: supplierOverdue.reduce((s, r) => s + r.remaining, 0),
    };
  }

  /**
   * Kirim email ringkasan utang (cron harian). Return menjelaskan kenapa
   * tidak terkirim kalau sent=false — dipakai endpoint untuk log/respons.
   * Satu email per penerima (alamat penerima lain tidak saling terlihat).
   */
  static async sendDebtDueEmails(): Promise<{
    sent: boolean;
    reason: string;
    recipientCount: number;
    customerOverdue: number;
    customerDueSoon: number;
    supplierOverdue: number;
    supplierDueSoon: number;
    totalCustomerOverdue: number;
    totalSupplierOverdue: number;
    triggeredCount: number;
  }> {
    const empty = (reason: string) => ({
      sent: false,
      reason,
      recipientCount: 0,
      customerOverdue: 0,
      customerDueSoon: 0,
      supplierOverdue: 0,
      supplierDueSoon: 0,
      totalCustomerOverdue: 0,
      totalSupplierOverdue: 0,
      triggeredCount: 0,
    });
    try {
      const summary = await this.getDebtDueSummary();
      if (!summary.settings.debtEmailEnabled) return empty("disabled");
      if (summary.triggeredCount === 0) return empty("no-milestone");
      // Dedup harian (WITA): sudah terkirim hari ini -> lewati.
      const todayStart = this.witaTodayStart();
      const alreadySent = await prisma.debtEmailLog.findFirst({
        where: { sentAt: { gte: todayStart } },
        select: { id: true },
      });
      if (alreadySent) return empty("already-sent-today");

      const recipients = await prisma.debtNotificationRecipient.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: { email: true },
      });
      if (recipients.length === 0) return empty("no-recipients");

      const baseUrl = this.appBaseUrl();
      const dateLabel = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      const html = generateDebtDueEmail({
        dateLabel,
        customerOverdue: summary.customerOverdue,
        customerDueSoon: summary.customerDueSoon,
        supplierOverdue: summary.supplierOverdue,
        supplierDueSoon: summary.supplierDueSoon,
        totalCustomerOverdue: summary.totalCustomerOverdue,
        totalSupplierOverdue: summary.totalSupplierOverdue,
        customerDebtsUrl: `${baseUrl}/dashboard/customer-debts`,
        supplierDebtsUrl: `${baseUrl}/dashboard/supplier-debts`,
        customerDebtsAppUrl: this.appDebtLink("customer"),
        supplierDebtsAppUrl: this.appDebtLink("supplier"),
      });

      let sentCount = 0;
      for (const r of recipients) {
        const res = await sendEmail({
          to: r.email,
          subject: `Ringkasan Utang Jatuh Tempo — ${dateLabel} — TB Masdar Utama`,
          html,
        });
        if (res.success) sentCount++;
        else console.error("[DEBT_EMAIL_FAILED]", r.email, res.error);
      }
      if (sentCount === 0) return empty("send-failed");

      await prisma.debtEmailLog.create({
        data: {
          customerOverdue: summary.customerOverdue.length,
          customerDueSoon: summary.customerDueSoon.length,
          supplierOverdue: summary.supplierOverdue.length,
          supplierDueSoon: summary.supplierDueSoon.length,
          recipientCount: sentCount,
          totalCustomer: summary.totalCustomerOverdue,
          totalSupplier: summary.totalSupplierOverdue,
        },
      });

      return {
        sent: true,
        reason: "ok",
        recipientCount: sentCount,
        customerOverdue: summary.customerOverdue.length,
        customerDueSoon: summary.customerDueSoon.length,
        supplierOverdue: summary.supplierOverdue.length,
        supplierDueSoon: summary.supplierDueSoon.length,
        totalCustomerOverdue: summary.totalCustomerOverdue,
        totalSupplierOverdue: summary.totalSupplierOverdue,
        triggeredCount: summary.triggeredCount,
      };
    } catch (error) {
      console.error("[DEBT_EMAIL_ERROR]", error);
      return empty("error");
    }
  }

  /**
   * Kirim email TES dari tab Pengaturan — ke semua penerima aktif (kalau
   * belum ada penerima, ke email SUPER_ADMIN yang menekan tombol).
   * Isi: ringkasan nyata saat ini; kalau kosong, satu baris contoh supaya
   * formatnya bisa dicek. TIDAK menulis DebtEmailLog (tes tidak boleh
   * memengaruhi dedup harian).
   */
  static async sendTestDebtEmail(adminEmail?: string): Promise<{ sent: boolean; recipientCount: number; error?: string }> {
    try {
      const summary = await this.getDebtDueSummary();
      const recipients = await prisma.debtNotificationRecipient.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: { email: true },
      });
      const targets = recipients.map((r) => r.email);
      if (targets.length === 0 && adminEmail) targets.push(adminEmail);
      if (targets.length === 0) {
        return { sent: false, recipientCount: 0, error: "Belum ada penerima aktif. Tambahkan dulu email penerima, atau pastikan email akun Anda terisi." };
      }
      const baseUrl = this.appBaseUrl();
      const dateLabel = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      const sampleRow = (name: string, ref: string): DebtDueEmailRow => ({
        name,
        ref,
        dueDateLabel: dateLabel,
        remaining: 1500000,
        daysOverdue: 3,
      });
      const hasData =
        summary.customerOverdue.length + summary.customerDueSoon.length + summary.supplierOverdue.length + summary.supplierDueSoon.length > 0;
      const html = generateDebtDueEmail({
        isTest: true,
        dateLabel,
        customerOverdue: hasData ? summary.customerOverdue : [sampleRow("CONTOH — Toko Maju Jaya", "INV/CONTOH-0001")],
        customerDueSoon: summary.customerDueSoon,
        supplierOverdue: hasData ? summary.supplierOverdue : [sampleRow("CONTOH — PT Semen Jaya", "PO/CONTOH-0001")],
        supplierDueSoon: summary.supplierDueSoon,
        totalCustomerOverdue: hasData ? summary.totalCustomerOverdue : 1500000,
        totalSupplierOverdue: hasData ? summary.totalSupplierOverdue : 1500000,
        customerDebtsUrl: `${baseUrl}/dashboard/customer-debts`,
        supplierDebtsUrl: `${baseUrl}/dashboard/supplier-debts`,
        customerDebtsAppUrl: this.appDebtLink("customer"),
        supplierDebtsAppUrl: this.appDebtLink("supplier"),
      });
      let sentCount = 0;
      for (const to of targets) {
        const res = await sendEmail({ to, subject: `[TES] Ringkasan Utang Jatuh Tempo — TB Masdar Utama`, html });
        if (res.success) sentCount++;
        else console.error("[DEBT_TEST_EMAIL_FAILED]", to, res.error);
      }
      if (sentCount === 0) {
        return { sent: false, recipientCount: 0, error: "Gagal mengirim email tes. Cek pengaturan SMTP (EMAIL_USER / EMAIL_PASSWORD) di Vercel dan log server." };
      }
      return { sent: true, recipientCount: sentCount };
    } catch (error) {
      console.error("[DEBT_TEST_EMAIL_ERROR]", error);
      return { sent: false, recipientCount: 0, error: "Gagal mengirim email tes." };
    }
  }
}
