/**
 * notify.ts — Unified Server-Side Notification Helper
 *
 * Bertanggung jawab untuk:
 * 1. Menyimpan notifikasi ke database (tabel Notification) agar muncul di pusat notifikasi APK & Web.
 * 2. Mengirim FCM push via Firebase Admin SDK ke semua token terdaftar user/role tertentu.
 * 3. Membersihkan token yang tidak valid dari database secara otomatis.
 *
 * Penggunaan:
 *   import { notify } from "@/lib/utils/notify";
 *   await notify({ title: "Judul", body: "Pesan", role: "ADMIN" });
 *   await notify({ title: "Judul", body: "Pesan", userId: "user-id", screen: "Delivery" });
 */

import prisma from "@/lib/prisma";
import { Role, NotificationType } from "@prisma/client";

// ─── Firebase Admin (lazy init) ─────────────────────────────────────────────
let _messaging: import("firebase-admin/messaging").Messaging | null = null;
let _firebaseReady = false;

function getMessaging() {
  if (_messaging) return _messaging;

  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw || raw === "{}") return null;

    const serviceAccount = JSON.parse(raw);
    if (!serviceAccount.private_key) return null;

    // Fix escaped newlines from env var
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

    // Lazy import to avoid issues in non-server contexts
    const admin = require("firebase-admin") as typeof import("firebase-admin");
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }

    _messaging = admin.messaging();
    _firebaseReady = true;
    return _messaging;
  } catch (e) {
    console.warn("[FCM] Firebase Admin tidak terkonfigurasi:", (e as Error).message);
    return null;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface NotifyOptions {
  title: string;
  body: string;
  /** Kirim ke semua user dengan role ini (misal "ADMIN") */
  role?: string;
  /** Kirim ke user spesifik (misal admin yang membuat transaksi) */
  userId?: string;
  /** Screen tujuan di APK saat notifikasi di-tap (misal "Delivery") */
  screen?: string;
  /** Extra data untuk navigasi */
  params?: Record<string, string>;
  /** Tipe notifikasi untuk sorting/filtering */
  type?: string;
}

// ─── Main notify function ─────────────────────────────────────────────────────
export async function notify(opts: NotifyOptions): Promise<void> {
  const { title, body, role, userId, screen, params, type } = opts;

  if (!title?.trim() || !body?.trim()) return;

  try {
    // 1. Simpan ke database (tabel Notification) ─────────────────────────────
    const validNotificationTypes: NotificationType[] = [
      "NEW_ORDER",
      "ORDER_STATUS",
      "PAYMENT_RECEIVED",
      "DELIVERY_UPDATE",
      "DEBT_DUE",
      "LOW_STOCK",
      "SYSTEM_ALERT",
    ];

    const notifType: NotificationType =
      type && (validNotificationTypes as string[]).includes(type)
        ? (type as NotificationType)
        : NotificationType.SYSTEM_ALERT;

    await prisma.notification.create({
      data: {
        title: title.trim(),
        body: body.trim(),
        type: notifType,
        screen: screen || null,
        params: params ? (params as any) : undefined,
        role: role ? (role as Role) : null,
        userId: userId || null,
      },
    }).catch((e) => {
      console.warn("[NOTIFY] Gagal simpan notifikasi ke DB:", e?.message);
    });

    // 2. Kirim FCM Push ───────────────────────────────────────────────────────
    const messaging = getMessaging();
    if (!messaging || !_firebaseReady) return;

    const fcmData: Record<string, string> = {};
    if (screen) fcmData.screen = screen;
    if (type) fcmData.type = type;
    if (params) fcmData.params = JSON.stringify(params);

    // Siapkan base message
    const buildMessage = (token: string) => ({
      token,
      notification: { title: title.trim(), body: body.trim() },
      data: fcmData,
      android: {
        priority: "high" as const,
        notification: {
          channelId: getChannelId(type),
          sound: "default",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
    });

    // Ambil token perangkat
    const tokenFilter = userId
      ? { userId }
      : role
      ? { user: { role: role as Role } }
      : undefined;

    if (!tokenFilter) return;

    const deviceTokens = await prisma.deviceToken.findMany({
      where: tokenFilter,
      select: { token: true },
    });

    if (deviceTokens.length === 0) return;

    // Kirim ke semua token, dan bersihkan token yang tidak valid
    const staleTokens: string[] = [];

    await Promise.allSettled(
      deviceTokens.map(async ({ token }) => {
        try {
          await messaging!.send(buildMessage(token));
        } catch (e: any) {
          const code = e?.errorInfo?.code ?? e?.code ?? "";
          // Token sudah tidak valid (unregistered / invalid)
          if (
            code.includes("registration-token-not-registered") ||
            code.includes("invalid-argument") ||
            code.includes("invalid-registration-token")
          ) {
            staleTokens.push(token);
          } else {
            console.warn(`[FCM] Gagal kirim ke token: ${code}`);
          }
        }
      })
    );

    // Hapus token tidak valid dari DB
    if (staleTokens.length > 0) {
      await prisma.deviceToken
        .deleteMany({ where: { token: { in: staleTokens } } })
        .catch(() => {});
      console.log(`[FCM] Dihapus ${staleTokens.length} token tidak valid.`);
    }
  } catch (err) {
    console.error("[NOTIFY] Terjadi error:", err);
  }
}

// ─── Shorthand helpers ────────────────────────────────────────────────────────

/** Kirim notifikasi ke semua Admin/Super Admin */
export const notifyAdmin = (opts: Omit<NotifyOptions, "role">) =>
  notify({ ...opts, role: "ADMIN" });

/** Kirim notifikasi ke user spesifik */
export const notifyUser = (userId: string, opts: Omit<NotifyOptions, "userId">) =>
  notify({ ...opts, userId });

// ─── Predefined event helpers ─────────────────────────────────────────────────

export const NotifEvent = {
  /** Surat jalan baru dibuat */
  doCreated: (doNumber: string, customerName: string) =>
    notifyAdmin({
      title: "📦 Surat Jalan Baru",
      body: `DO #${doNumber} untuk ${customerName} telah dibuat.`,
      screen: "Delivery",
      type: "delivery",
    }),

  /** Status pengiriman diperbarui */
  doStatusChanged: (
    doNumber: string,
    status: string,
    createdById?: string
  ) => {
    const labelMap: Record<string, string> = {
      IN_TRANSIT: "🚛 Sedang Diantar",
      DELIVERED: "✅ Terkirim",
      CANCELLED: "❌ Dibatalkan",
      PENDING: "📦 Menunggu",
    };
    const label = labelMap[status] ?? status;
    const p = notify({
      title: label,
      body: `Surat Jalan #${doNumber} — ${label}`,
      role: "ADMIN",
      screen: "Delivery",
      type: "delivery",
    });
    // Juga beritahu pembuat DO jika berbeda dari admin
    const p2 = createdById
      ? notify({
          title: label,
          body: `Status SJ #${doNumber} berubah: ${label}`,
          userId: createdById,
          screen: "Delivery",
          type: "delivery",
        })
      : Promise.resolve();
    return Promise.all([p, p2]);
  },

  /** Penjualan baru dari POS */
  newSale: (invoiceNumber: string, cashierName: string, grandTotal: number) =>
    notifyAdmin({
      title: "🧾 Penjualan Baru",
      body: `${cashierName} — INV ${invoiceNumber} — Rp ${grandTotal.toLocaleString("id-ID")}`,
      screen: "History",
      type: "orders",
    }),

  /** Hutang/piutang jatuh tempo */
  debtOverdue: (customerName: string, amount: number) =>
    notifyAdmin({
      title: "⚠️ Piutang Jatuh Tempo",
      body: `${customerName} — Rp ${amount.toLocaleString("id-ID")}`,
      screen: "Debt",
      type: "finance",
    }),

  /** Pembayaran cicilan diterima */
  paymentReceived: (customerName: string, amount: number) =>
    notifyAdmin({
      title: "💰 Pembayaran Diterima",
      body: `${customerName} membayar Rp ${amount.toLocaleString("id-ID")}`,
      screen: "Debt",
      type: "finance",
    }),

  /** Purchase order baru */
  newPurchase: (poNumber: string, supplierName: string) =>
    notifyAdmin({
      title: "🛒 Purchase Order Baru",
      body: `PO #${poNumber} dari ${supplierName}`,
      screen: "Purchase",
      type: "orders",
    }),
};

// ─── Private helpers ─────────────────────────────────────────────────────────
function getChannelId(type?: string): string {
  const map: Record<string, string> = {
    delivery: "deliveries",
    deliveries: "deliveries",
    orders: "orders",
    finance: "finance",
  };
  return (type && map[type]) || "default";
}
