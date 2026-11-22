import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/utils/api";
import * as admin from "firebase-admin";

let firebaseReady = false;
try {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw && raw !== "{}") {
    const serviceAccount = JSON.parse(raw);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    firebaseReady = true;
  }
} catch (e) {
  console.warn("[FCM] Firebase Admin SDK tidak dikonfigurasi — notifikasi push dinonaktifkan:", e);
}

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
  if (!firebaseReady) return;
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
  if (!firebaseReady) return;
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

export async function POST(req: NextRequest) {
  const session = await getAuthenticatedUser();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SECURITY FIX (Nov 2026, H3): sebelumnya pengguna login mana pun bisa
  // mengirim push ke topik bebas ("admin", "driver", ...) dengan isi bebas —
  // kasir bisa mengirim pengumuman palsu ke semua admin/driver.
  // Sekarang hanya ADMIN/SUPER_ADMIN dan hanya ke topik yang dikenal.
  const role = (session.user as { role?: string }).role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: hanya admin yang bisa mengirim push manual" }, { status: 403 });
  }

  const { topic, title, body, data, channelId, type } = await req.json();

  if (!topic || !title || !body) {
    return NextResponse.json({ error: "topic, title, body wajib diisi" }, { status: 400 });
  }

  const ALLOWED_TOPICS = ["admin", "driver"];
  if (!ALLOWED_TOPICS.includes(topic)) {
    return NextResponse.json({ error: "topic tidak diizinkan" }, { status: 400 });
  }

  // PENTEST FIX (22 Nov 2026, L18): batasi panjang + data hanya
  // string→string + larang channelId/type dari klien. channelId dipakai
  // sendToTopic untuk memilih channel notifikasi Android dan type untuk
  // routing di APK — keduanya urusan server (helper Notif), bukan klien.
  if (typeof title !== "string" || title.length > 100) {
    return NextResponse.json({ error: "title maksimal 100 karakter" }, { status: 400 });
  }
  if (typeof body !== "string" || body.length > 500) {
    return NextResponse.json({ error: "body maksimal 500 karakter" }, { status: 400 });
  }
  if (typeof channelId !== "undefined" || typeof type !== "undefined") {
    return NextResponse.json({ error: "Field channelId/type tidak diizinkan" }, { status: 400 });
  }
  const safeData: Record<string, string> = {};
  if (typeof data !== "undefined") {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return NextResponse.json({ error: "data harus berupa object string→string" }, { status: 400 });
    }
    const entries = Object.entries(data);
    if (entries.length > 20) {
      return NextResponse.json({ error: "data maksimal 20 entri" }, { status: 400 });
    }
    for (const [k, v] of entries) {
      if (k === "channelId" || k === "type") {
        return NextResponse.json({ error: "Kunci channelId/type tidak diizinkan di data" }, { status: 400 });
      }
      if (typeof v !== "string" || v.length > 500) {
        return NextResponse.json({ error: "Nilai data harus string dan maksimal 500 karakter" }, { status: 400 });
      }
      safeData[k] = v;
    }
  }

  await sendToTopic({ topic, title, body, data: safeData });
  return NextResponse.json({ success: true });
}
