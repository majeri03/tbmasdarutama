// Pusat Notifikasi web — daftar dari GET /api/notifications (model yang
// sama dipakai APK). Filter per kategori, tandai dibaca, hapus yang dibaca,
// dan ketuk item untuk lompat ke halaman terkait dengan filter terisi
// (penjualan: ?search=nomor invoice, pengiriman: ?search=nomor DO).

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Trash2,
  ShoppingCart,
  Truck,
  Wallet,
  Package,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

type NotifType =
  | "NEW_ORDER"
  | "ORDER_STATUS"
  | "PAYMENT_RECEIVED"
  | "DELIVERY_UPDATE"
  | "DEBT_DUE"
  | "LOW_STOCK"
  | "SYSTEM_ALERT";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: NotifType;
  screen?: string | null;
  params?: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_META: Record<NotifType, { label: string; icon: typeof Bell; color: string }> = {
  NEW_ORDER: { label: "Pesanan Baru", icon: ShoppingCart, color: "bg-green-100 text-green-700" },
  ORDER_STATUS: { label: "Status Pesanan", icon: ShoppingCart, color: "bg-green-100 text-green-700" },
  PAYMENT_RECEIVED: { label: "Pembayaran", icon: Wallet, color: "bg-blue-100 text-blue-700" },
  DELIVERY_UPDATE: { label: "Pengiriman", icon: Truck, color: "bg-purple-100 text-purple-700" },
  DEBT_DUE: { label: "Jatuh Tempo", icon: Wallet, color: "bg-orange-100 text-orange-700" },
  LOW_STOCK: { label: "Stok Menipis", icon: Package, color: "bg-amber-100 text-amber-700" },
  SYSTEM_ALERT: { label: "Sistem", icon: AlertTriangle, color: "bg-gray-100 text-gray-700" },
};

type FilterKey = "ALL" | "UNREAD" | "ORDER" | "DELIVERY" | "FINANCE" | "STOCK" | "SYSTEM";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "ALL", label: "Semua" },
  { key: "UNREAD", label: "Belum dibaca" },
  { key: "ORDER", label: "Pesanan" },
  { key: "DELIVERY", label: "Pengiriman" },
  { key: "FINANCE", label: "Keuangan" },
  { key: "STOCK", label: "Stok" },
  { key: "SYSTEM", label: "Sistem" },
];

function matchesFilter(item: NotificationItem, filter: FilterKey): boolean {
  switch (filter) {
    case "ALL":
      return true;
    case "UNREAD":
      return !item.isRead;
    case "ORDER":
      return item.type === "NEW_ORDER" || item.type === "ORDER_STATUS";
    case "DELIVERY":
      return item.type === "DELIVERY_UPDATE";
    case "FINANCE":
      return item.type === "PAYMENT_RECEIVED" || item.type === "DEBT_DUE";
    case "STOCK":
      return item.type === "LOW_STOCK";
    case "SYSTEM":
      return item.type === "SYSTEM_ALERT";
    default:
      return true;
  }
}

/** Tujuan navigasi saat item diketuk — mengikuti screen + params dari server. */
function targetUrl(item: NotificationItem): string | null {
  const params = (item.params || {}) as Record<string, unknown>;
  const screen = String(item.screen || "");
  if (screen === "Delivery" && params.doNumber) {
    return `/dashboard/delivery-orders?search=${encodeURIComponent(String(params.doNumber))}`;
  }
  if (screen === "Delivery") return "/dashboard/delivery-orders";
  if ((screen === "History" || item.type === "NEW_ORDER" || item.type === "ORDER_STATUS") && params.invoiceNumber) {
    return `/dashboard/sales?search=${encodeURIComponent(String(params.invoiceNumber))}`;
  }
  if (screen === "History" || screen === "POS") return "/dashboard/sales";
  if (screen === "Debt") return "/dashboard/customer-debts";
  if (screen === "Purchase") return "/dashboard/purchases";
  if (screen === "Products") return "/dashboard/products";
  return null;
}

const PAGE_LIMIT = 20;

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/notifications?page=${pageNum}&limit=${PAGE_LIMIT}`);
      const json = await res.json();
      if (json.success) {
        setItems(json.data?.items || []);
        setTotalPages(json.data?.pagination?.totalPages || 1);
        setUnreadCount(json.data?.unreadCount ?? 0);
      } else {
        setError(json.message || "Gagal memuat notifikasi");
      }
    } catch {
      setError("Gagal memuat notifikasi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications(page);
  }, [page, loadNotifications]);

  const markRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // diam — tandai baca gagal tidak menghalangi navigasi
    }
  };

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readAll: true }),
      });
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      setError("Gagal menandai semua dibaca");
    }
  };

  const clearRead = async () => {
    if (!confirm("Hapus semua notifikasi yang sudah dibaca?")) return;
    try {
      const res = await fetch("/api/notifications?clearRead=true", { method: "DELETE" });
      const json = await res.json();
      if (json.success) loadNotifications(1);
      else setError(json.message || "Gagal menghapus notifikasi");
    } catch {
      setError("Gagal menghapus notifikasi");
    }
  };

  const handleTap = (item: NotificationItem) => {
    if (!item.isRead) void markRead(item.id);
    const url = targetUrl(item);
    if (url) router.push(url);
  };

  const visible = items.filter((i) => matchesFilter(i, filter));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifikasi</h1>
          <p className="page-subtitle">
            {unreadCount > 0 ? `${unreadCount} belum dibaca` : "Semua sudah dibaca"}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={markAllRead} className="btn-secondary">
            <CheckCheck className="w-4 h-4" />
            Tandai Semua Dibaca
          </button>
          <button onClick={clearRead} className="btn-secondary">
            <Trash2 className="w-4 h-4" />
            Hapus yang Dibaca
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      <div className="glass-card divide-y divide-gray-100">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Tidak ada notifikasi untuk filter ini</p>
          </div>
        ) : (
          visible.map((item) => {
            const meta = TYPE_META[item.type] || TYPE_META.SYSTEM_ALERT;
            const Icon = meta.icon;
            const url = targetUrl(item);
            return (
              <button
                key={item.id}
                onClick={() => handleTap(item)}
                className={`w-full text-left p-4 flex gap-3 hover:bg-gray-50 transition-colors ${
                  !item.isRead ? "bg-blue-50/50" : ""
                }`}
              >
                <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${meta.color}`}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className={`font-semibold text-sm ${!item.isRead ? "text-gray-900" : "text-gray-700"}`}>
                      {item.title}
                    </span>
                    {!item.isRead && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
                  </span>
                  <span className="block text-sm text-gray-600 mt-0.5 break-words">{item.body}</span>
                  <span className="block text-xs text-gray-400 mt-1">
                    {format(new Date(item.createdAt), "dd MMM yyyy, HH:mm", { locale: localeId })}
                    {url ? " • Ketuk untuk melihat" : ""}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Halaman {page} dari {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary btn-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary btn-sm"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
