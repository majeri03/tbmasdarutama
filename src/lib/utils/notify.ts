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

    // 2. Kirim Push Notification (FCM / Expo Push) ───────────────────────────
    const fcmData: Record<string, string> = {};
    if (screen) fcmData.screen = screen;
    if (type) fcmData.type = type;
    if (params) fcmData.params = typeof params === "string" ? params : JSON.stringify(params);

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

    const messaging = getMessaging();
    const staleTokens: string[] = [];
    const channelId = getChannelId(type);

    await Promise.allSettled(
      deviceTokens.map(async ({ token }) => {
        const isExpoToken = token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");

        if (isExpoToken) {
          // Kirim via Expo Push API
          try {
            const res = await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: token,
                title: title.trim(),
                body: body.trim(),
                data: fcmData,
                sound: "masdar_utama.mp3",
                channelId: channelId,
                priority: "high",
              }),
            });

            const data = await res.json().catch(() => ({}));
            if (data?.data?.status === "error") {
              const errDetail = data?.data?.details?.error;
              if (errDetail === "DeviceNotRegistered") {
                staleTokens.push(token);
              }
              console.warn(`[PushNotif:Expo] Error untuk token ${token.slice(0, 25)}...: ${data?.data?.message}`);
            }
          } catch (e: any) {
            console.warn("[PushNotif:Expo] Gagal panggil Expo Push:", e?.message);
          }
        } else if (messaging && _firebaseReady) {
          // Kirim via Firebase Admin SDK HTTP v1
          try {
            await messaging.send({
              token,
              notification: {
                title: title.trim(),
                body: body.trim(),
              },
              data: fcmData,
              android: {
                priority: "high",
                notification: {
                  channelId: channelId,
                  sound: "masdar_utama.mp3",
                  clickAction: "FLUTTER_NOTIFICATION_CLICK",
                  defaultVibrateTimings: true,
                },
              },
            });
          } catch (e: any) {
            const code = e?.errorInfo?.code ?? e?.code ?? "";
            if (
              code.includes("registration-token-not-registered") ||
              code.includes("invalid-argument") ||
              code.includes("invalid-registration-token")
            ) {
              staleTokens.push(token);
            } else {
              console.warn(`[PushNotif:FCM] Gagal kirim ke token ${token.slice(0, 15)}...: ${code}`);
            }
          }
        }
      })
    );

    // Hapus token tidak valid dari DB secara otomatis
    if (staleTokens.length > 0) {
      await prisma.deviceToken
        .deleteMany({ where: { token: { in: staleTokens } } })
        .catch(() => {});
      console.log(`[PushNotif] Dihapus ${staleTokens.length} token tidak valid.`);
    }
  } catch (err) {
    console.error("[NOTIFY] Terjadi error:", err);
  }
}


/** Kirim notifikasi ke semua Admin/Super Admin */
export const notifyAdmin = (opts: Omit<NotifyOptions, "role">) =>
  notify({ ...opts, role: "ADMIN" });

/** Kirim notifikasi ke user spesifik */
export const notifyUser = (userId: string, opts: Omit<NotifyOptions, "userId">) =>
  notify({ ...opts, userId });


export const NotifEvent = {
  /** Surat jalan baru dibuat */
  doCreated: (doNumber: string, customerName: string) =>
    notifyAdmin({
      title: "📦 Surat Jalan Baru",
      body: `DO #${doNumber} untuk ${customerName} telah dibuat.`,
      screen: "Delivery",
      params: { search: doNumber, doNumber },
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
      params: { search: doNumber, doNumber },
      type: "delivery",
    });
    // Juga beritahu pembuat DO jika berbeda dari admin
    const p2 = createdById
      ? notify({
          title: label,
          body: `Status SJ #${doNumber} berubah: ${label}`,
          userId: createdById,
          screen: "Delivery",
          params: { search: doNumber, doNumber },
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
      params: { search: invoiceNumber, invoiceNumber },
      type: "orders",
    }),

  /** Hutang/piutang jatuh tempo */
  debtOverdue: (customerName: string, amount: number) =>
    notifyAdmin({
      title: "⚠️ Piutang Jatuh Tempo",
      body: `${customerName} — Rp ${amount.toLocaleString("id-ID")}`,
      screen: "Debt",
      params: { search: customerName, customerName },
      type: "finance",
    }),

  /** Pembayaran cicilan diterima */
  paymentReceived: (customerName: string, amount: number) =>
    notifyAdmin({
      title: "💰 Pembayaran Diterima",
      body: `${customerName} membayar Rp ${amount.toLocaleString("id-ID")}`,
      screen: "Debt",
      params: { search: customerName, customerName },
      type: "finance",
    }),

  /** Purchase order baru */
  newPurchase: (poNumber: string, supplierName: string) =>
    notifyAdmin({
      title: "🛒 Purchase Order Baru",
      body: `PO #${poNumber} dari ${supplierName}`,
      screen: "Purchase",
      params: { search: poNumber, poNumber },
      type: "orders",
    }),
};

function getChannelId(type?: string): string {
  const map: Record<string, string> = {
    delivery: "deliveries",
    deliveries: "deliveries",
    orders: "orders",
    finance: "finance",
  };
  return (type && map[type]) || "masdar_channel_v2";
}
