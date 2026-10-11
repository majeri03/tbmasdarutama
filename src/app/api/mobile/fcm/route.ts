import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as admin from "firebase-admin";

// ── Inisialisasi Firebase Admin SDK (sekali saja) ─────────
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "{}"
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// ── Helper kirim notifikasi ke token tunggal ─────────────
export async function sendToToken({
  token,
  title,
  body,
  data = {},
}: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      data,
      android: {
        priority: "high",
        notification: {
          channelId: data.channelId ?? "masdar_umum",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
          sound: "default",
        },
      },
    });
  } catch (e) {
    console.error("[FCM] sendToToken error:", e);
  }
}

// ── Helper kirim ke topic (semua admin/semua driver) ──────
export async function sendToTopic({
  topic,
  title,
  body,
  data = {},
}: {
  topic: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  try {
    await admin.messaging().send({
      topic,
      notification: { title, body },
      data,
      android: {
        priority: "high",
        notification: {
          channelId: data.channelId ?? "masdar_umum",
          sound: "default",
        },
      },
    });
  } catch (e) {
    console.error("[FCM] sendToTopic error:", e);
  }
}

// ── Helper kirim ke semua token pengguna berdasar role ────
export async function notifyByRole({
  role,
  title,
  body,
  data = {},
}: {
  role: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  const topic = role === "SUPER_ADMIN" || role === "ADMIN" ? "admin" : "driver";
  await sendToTopic({ topic, title, body, data });
}

// ── Notifikasi Spesifik ───────────────────────────────────
export const Notif = {
  /** Pembayaran utang diterima */
  async paymentReceived(customerId: string, customerName: string, amount: number) {
    await sendToTopic({
      topic: "admin",
      title: "💰 Pembayaran Masuk",
      body: `${customerName} membayar Rp ${amount.toLocaleString("id-ID")}`,
      data: {
        type: "payment_received",
        id: customerId,
        channelId: "masdar_kas",
      },
    });
  },

  /** Update status pengiriman */
  async deliveryUpdate(doId: string, doNumber: string, status: string, driverToken?: string) {
    const statusLabel: Record<string, string> = {
      IN_TRANSIT: "🚛 Barang Sedang Diantar",
      DELIVERED: "✅ Pengiriman Selesai",
      PENDING: "📦 Siap Dimuat",
    };
    const msg = statusLabel[status] ?? "Update Pengiriman";

    // Kirim ke admin
    await sendToTopic({
      topic: "admin",
      title: msg,
      body: `Surat Jalan #${doNumber} — ${status}`,
      data: { type: "delivery_update", id: doId, channelId: "masdar_kirim" },
    });

    // Kirim ke sopir jika ada token
    if (driverToken) {
      await sendToToken({
        token: driverToken,
        title: msg,
        body: `SJ #${doNumber} — status diperbarui`,
        data: { type: "delivery_update", id: doId, channelId: "masdar_kirim" },
      });
    }
  },

  /** Pengingat utang jatuh tempo */
  async debtReminder(customerId: string, customerName: string, remaining: number) {
    await sendToTopic({
      topic: "admin",
      title: "⚠️ Piutang Jatuh Tempo",
      body: `${customerName} — Sisa Rp ${remaining.toLocaleString("id-ID")}`,
      data: { type: "debt_reminder", id: customerId, channelId: "masdar_utang" },
    });
  },

  /** Pesanan baru masuk */
  async newOrder(saleId: string, customerName: string, amount: number) {
    await sendToTopic({
      topic: "admin",
      title: "🧾 Pesanan Baru",
      body: `${customerName} — Rp ${amount.toLocaleString("id-ID")}`,
      data: { type: "new_order", id: saleId, channelId: "masdar_kas" },
    });
  },
};

// ── POST /api/mobile/fcm — Kirim notif manual dari panel ──
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { topic, title, body, data } = await req.json();

  if (!topic || !title || !body) {
    return NextResponse.json({ error: "topic, title, body wajib diisi" }, { status: 400 });
  }

  await sendToTopic({ topic, title, body, data: data ?? {} });
  return NextResponse.json({ success: true });
}
