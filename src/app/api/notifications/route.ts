import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/utils/api";
import prisma from "@/lib/prisma";

export type NotificationItem = {
  id: string;
  type: "NEW_ORDER" | "ORDER_STATUS" | "DELIVERY_UPDATE" | "PAYMENT_RECEIVED" | "DEBT_OVERDUE" | "WA_ORDER";
  title: string;
  message: string;
  time: string;
  timestamp: string;
  isRead: boolean;
  linkRoute: string;
  badgeType: "neutral" | "success" | "warning" | "danger";
  amount?: number;
};

/**
 * GET /api/notifications
 * Mengambil daftar notifikasi terpadu (pesanan baru, update pengiriman,
 * cicilan masuk, piutang jatuh tempo, order WhatsApp) langsung dari database.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter"); // all | order | delivery | payment | debt
    const limit = parseInt(searchParams.get("limit") || "30", 10);

    const now = new Date();

    // Query paralel ke database pusat
    const [sales, deliveries, payments, overdueDebts, waOrders] = await Promise.all([
      // 1. Pesanan / Penjualan terbaru (10 terakhir)
      prisma.sale.findMany({
        take: 12,
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { name: true } },
        },
      }),

      // 2. Surat jalan / Pengiriman terbaru (10 terakhir)
      prisma.deliveryOrder.findMany({
        take: 12,
        orderBy: { updatedAt: "desc" },
        include: {
          customer: { select: { name: true } },
        },
      }),

      // 3. Pembayaran utang masuk (10 terakhir)
      prisma.debtPayment.findMany({
        take: 10,
        orderBy: { paymentDate: "desc" },
        include: {
          customerDebt: {
            include: { customer: { select: { id: true, name: true } } },
          },
          admin: { select: { name: true } },
        },
      }),

      // 4. Utang jatuh tempo aktif
      prisma.customerDebt.findMany({
        where: {
          status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] },
          dueDate: { lt: now },
        },
        take: 8,
        orderBy: { dueDate: "asc" },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
        },
      }),

      // 5. Pesanan WhatsApp masuk
      prisma.waOrder.findMany({
        where: { status: "PENDING" },
        take: 5,
        orderBy: { receivedAt: "desc" },
      }),
    ]);

    const notifications: NotificationItem[] = [];

    // Map Sales
    for (const s of sales) {
      const custName = s.customer?.name || "Pelanggan Umum";
      const grandTotal = Number(s.grandTotal);
      const isCancelled = s.status === "CANCELLED";

      notifications.push({
        id: `sale-${s.id}`,
        type: isCancelled ? "ORDER_STATUS" : "NEW_ORDER",
        title: isCancelled ? "Pesanan Dibatalkan" : "Pesanan Baru Masuk",
        message: `${custName} • ${s.invoiceNumber} (${s.paymentMethod}) • Rp ${grandTotal.toLocaleString("id-ID")}`,
        time: s.createdAt.toISOString(),
        timestamp: s.createdAt.toISOString(),
        isRead: false,
        linkRoute: `/beranda`,
        badgeType: isCancelled ? "danger" : "success",
        amount: grandTotal,
      });
    }

    // Map Deliveries
    for (const d of deliveries) {
      const custName = d.customer?.name || "Pelanggan";
      const statusText =
        d.status === "DELIVERED"
          ? "Terkirim ke Pelanggan"
          : d.status === "IN_TRANSIT"
          ? "Sedang Dalam Perjalanan"
          : d.status === "CANCELLED"
          ? "Pengiriman Dibatalkan"
          : "Surat Jalan Siap Muat";

      const badgeType =
        d.status === "DELIVERED"
          ? "success"
          : d.status === "IN_TRANSIT"
          ? "warning"
          : d.status === "CANCELLED"
          ? "danger"
          : "neutral";

      notifications.push({
        id: `do-${d.id}`,
        type: "DELIVERY_UPDATE",
        title: `Surat Jalan ${d.doNumber}`,
        message: `${custName} • Status: ${statusText} ${d.driver ? `(Sopir: ${d.driver})` : ""}`,
        time: d.updatedAt.toISOString(),
        timestamp: d.updatedAt.toISOString(),
        isRead: false,
        linkRoute: `/kirim/${d.id}`,
        badgeType,
      });
    }

    // Map Payments
    for (const p of payments) {
      const custName = p.customerDebt?.customer?.name || "Pelanggan";
      const custId = p.customerDebt?.customer?.id;
      const amount = Number(p.amount);

      notifications.push({
        id: `pay-${p.id}`,
        type: "PAYMENT_RECEIVED",
        title: "Uang Masuk / Cicilan Utang",
        message: `${custName} membayar Rp ${amount.toLocaleString("id-ID")} via ${p.paymentMethod}`,
        time: p.paymentDate.toISOString(),
        timestamp: p.paymentDate.toISOString(),
        isRead: false,
        linkRoute: custId ? `/utang/${custId}` : `/utang`,
        badgeType: "success",
        amount,
      });
    }

    // Map Overdue Debts
    for (const deb of overdueDebts) {
      const custName = deb.customer?.name || "Pelanggan";
      const remaining = Number(deb.remainingDebt);

      notifications.push({
        id: `debt-overdue-${deb.id}`,
        type: "DEBT_OVERDUE",
        title: "Piutang Jatuh Tempo",
        message: `${custName} memiliki sisa tagihan Rp ${remaining.toLocaleString("id-ID")}`,
        time: deb.dueDate.toISOString(),
        timestamp: deb.createdAt.toISOString(),
        isRead: false,
        linkRoute: `/utang/${deb.customerId}`,
        badgeType: "danger",
        amount: remaining,
      });
    }

    // Map WA Orders
    for (const wa of waOrders) {
      notifications.push({
        id: `wa-${wa.id}`,
        type: "WA_ORDER",
        title: "Pesanan Masuk via WhatsApp",
        message: `Dari ${wa.senderName} (${wa.senderPhone}): ${wa.rawMessage.substring(0, 60)}...`,
        time: wa.receivedAt.toISOString(),
        timestamp: wa.receivedAt.toISOString(),
        isRead: false,
        linkRoute: `/beranda`,
        badgeType: "warning",
      });
    }

    // Urutkan berdasarkan waktu paling baru
    notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Filter jika diminta
    let filtered = notifications;
    if (filter === "order") {
      filtered = notifications.filter((n) => n.type === "NEW_ORDER" || n.type === "ORDER_STATUS" || n.type === "WA_ORDER");
    } else if (filter === "delivery") {
      filtered = notifications.filter((n) => n.type === "DELIVERY_UPDATE");
    } else if (filter === "payment") {
      filtered = notifications.filter((n) => n.type === "PAYMENT_RECEIVED");
    } else if (filter === "debt") {
      filtered = notifications.filter((n) => n.type === "DEBT_OVERDUE");
    }

    const result = filtered.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        notifications: result,
        total: notifications.length,
        unreadCount: notifications.length,
      },
    });
  } catch (error) {
    console.error("[API_NOTIFICATIONS_GET_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil daftar notifikasi" },
      { status: 500 }
    );
  }
}
