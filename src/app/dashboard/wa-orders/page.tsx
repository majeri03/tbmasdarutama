"use client";

import { useEffect, useState, useCallback } from "react";
import {
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Phone,
  User,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { getWaOrders, rejectWaOrder } from "@/lib/actions/wa-order.actions";
import { WaOrderStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import ConfirmWaOrderModal from "./_components/ConfirmWaOrderModal";

type WaOrder = {
  id: string;
  rawMessage: string;
  senderPhone: string;
  senderName: string;
  groupName?: string | null;
  parsedItems?: unknown;
  customerName?: string | null;
  notes?: string | null;
  status: WaOrderStatus;
  rejectedReason?: string | null;
  deliveryOrderId?: string | null;
  saleId?: string | null;
  receivedAt: Date;
  confirmedAt?: Date | null;
  confirmedBy?: { id: string; name: string } | null;
};

const STATUS_CONFIG = {
  PENDING: { label: "Menunggu", color: "bg-amber-100 text-amber-700", icon: Clock },
  CONFIRMED: { label: "Dikonfirmasi", color: "bg-green-100 text-green-700", icon: CheckCircle },
  REJECTED: { label: "Ditolak", color: "bg-red-100 text-red-700", icon: XCircle },
  PARTIAL: { label: "Sebagian", color: "bg-blue-100 text-blue-700", icon: AlertCircle },
} as const;

export default function WaOrdersPage() {
  const [orders, setOrders] = useState<WaOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<WaOrderStatus | "ALL">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmingOrder, setConfirmingOrder] = useState<WaOrder | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const res = await getWaOrders(filterStatus === "ALL" ? undefined : filterStatus);
    if (res.success && res.data) {
      setOrders(res.data as WaOrder[]);
    }
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleReject = async (id: string) => {
    const reason = prompt("Alasan penolakan (opsional):");
    setRejectingId(id);
    const res = await rejectWaOrder(id, reason || undefined);
    if (res.success) {
      fetchOrders();
    } else {
      alert(res.error || "Gagal menolak orderan");
    }
    setRejectingId(null);
  };

  const pendingCount = orders.filter((o) => o.status === "PENDING").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <MessageSquare className="text-green-500" />
            Inbox Orderan WhatsApp
            {pendingCount > 0 && (
              <span className="bg-green-500 text-white text-sm font-bold px-2 py-0.5 rounded-full">
                {pendingCount} baru
              </span>
            )}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Orderan yang masuk dari grup WhatsApp — konfirmasi untuk membuat Surat Jalan otomatis
          </p>
        </div>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["ALL", "PENDING", "CONFIRMED", "REJECTED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
              filterStatus === s
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            {s === "ALL" ? "Semua" : STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-5 animate-pulse border border-gray-100">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <MessageSquare className="mx-auto w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Belum ada orderan masuk</p>
          <p className="text-gray-400 text-sm mt-1">Orderan dari grup WA akan muncul di sini secara otomatis</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const cfg = STATUS_CONFIG[order.status];
            const Icon = cfg.icon;
            const isExpanded = expandedId === order.id;

            return (
              <div
                key={order.id}
                className={`bg-white rounded-xl border transition-all shadow-sm hover:shadow-md ${
                  order.status === "PENDING" ? "border-amber-200" : "border-gray-100"
                }`}
              >
                {/* Card Header */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* WA Avatar */}
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-green-600 font-bold text-sm">
                          {order.senderName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800">{order.senderName}</span>
                          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {order.senderPhone}
                          </span>
                          {order.groupName && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {order.groupName}
                            </span>
                          )}
                          <span>
                            {formatDistanceToNow(new Date(order.receivedAt), { addSuffix: true, locale: idLocale })}
                          </span>
                        </div>
                        {/* Pesan ringkas */}
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                          &ldquo;{order.rawMessage}&rdquo;
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {order.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => setConfirmingOrder(order)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-all"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Konfirmasi
                          </button>
                          <button
                            onClick={() => handleReject(order.id)}
                            disabled={rejectingId === order.id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg transition-all border border-red-100"
                          >
                            <XCircle className="w-4 h-4" />
                            Tolak
                          </button>
                        </>
                      )}
                      {order.status === "CONFIRMED" && order.deliveryOrderId && (
                        <a
                          href={`/dashboard/delivery-orders/${order.deliveryOrderId}`}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium rounded-lg transition-all border border-blue-100"
                        >
                          <FileText className="w-4 h-4" />
                          Lihat SJ
                        </a>
                      )}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : order.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {order.customerName && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <User className="w-4 h-4 text-gray-400" />
                            <span>Customer terdeteksi: <strong>{order.customerName}</strong></span>
                          </div>
                        )}
                        {order.confirmedBy && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span>Dikonfirmasi oleh: <strong>{order.confirmedBy.name}</strong></span>
                          </div>
                        )}
                      </div>
                      {order.rejectedReason && (
                        <div className="bg-red-50 rounded-lg px-3 py-2 text-sm text-red-600">
                          <strong>Alasan ditolak:</strong> {order.rejectedReason}
                        </div>
                      )}
                      <div className="bg-gray-50 rounded-lg px-3 py-3 text-sm text-gray-600">
                        <p className="font-medium text-gray-700 mb-1">Pesan lengkap:</p>
                        <p className="whitespace-pre-wrap">{order.rawMessage}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Modal */}
      {confirmingOrder && (
        <ConfirmWaOrderModal
          order={confirmingOrder}
          onClose={() => setConfirmingOrder(null)}
          onSuccess={() => {
            setConfirmingOrder(null);
            fetchOrders();
          }}
        />
      )}
    </div>
  );
}
