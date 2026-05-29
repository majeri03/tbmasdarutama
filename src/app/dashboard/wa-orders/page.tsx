"use client";

import { useEffect, useState, useCallback, useTransition, Fragment } from "react";
import {
  MessageSquare, CheckCircle, XCircle, Clock, RefreshCw,
  Search, Calendar, Filter, AlertCircle, Bot, ChevronDown,
  ChevronUp, FileText, Eye,
} from "lucide-react";
import { getWaOrders, rejectWaOrder } from "@/lib/actions/wa-order.actions";
import { WaOrderStatus } from "@prisma/client";
import { format } from "date-fns";
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
  PENDING:   { label: "Pending",      color: "bg-amber-100 text-amber-700 border-amber-200",   dot: "bg-amber-500",  icon: Clock },
  CONFIRMED: { label: "Dikonfirmasi", color: "bg-green-100 text-green-700 border-green-200",   dot: "bg-green-500",  icon: CheckCircle },
  REJECTED:  { label: "Ditolak",      color: "bg-red-100 text-red-700 border-red-200",         dot: "bg-red-500",    icon: XCircle },
  PARTIAL:   { label: "Sebagian",     color: "bg-blue-100 text-blue-700 border-blue-200",      dot: "bg-blue-500",   icon: AlertCircle },
} as const;

// Ambil info dari notes BOT
function parseBotInfo(notes?: string | null) {
  if (!notes) return null;
  if (notes.includes("[BOT-YA")) return { type: "YA", label: "Bot: YA", color: "text-green-600" };
  if (notes.includes("[BOT-PENDING")) return { type: "PENDING", label: "Bot: PENDING", color: "text-amber-600" };
  if (notes.includes("[BOT-CONFIRMED")) return { type: "CONFIRMED", label: "Bot: Konfirmasi", color: "text-blue-600" };
  return null;
}

export default function WaOrdersPage() {
  const [orders, setOrders] = useState<WaOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [filterStatus, setFilterStatus] = useState<WaOrderStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // UI State
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmingOrder, setConfirmingOrder] = useState<WaOrder | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const res = await getWaOrders(
      filterStatus === "ALL" ? undefined : filterStatus,
      { search: search || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }
    );
    if (res.success && res.data) setOrders(res.data as WaOrder[]);
    setLoading(false);
  }, [filterStatus, search, dateFrom, dateTo]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleReject = async (id: string) => {
    const reason = prompt("Alasan penolakan (opsional):");
    setRejectingId(id);
    const res = await rejectWaOrder(id, reason || undefined);
    if (res.success) fetchOrders();
    else alert(res.error || "Gagal menolak orderan");
    setRejectingId(null);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => { fetchOrders(); });
  };

  const resetFilters = () => {
    setSearch(""); setDateFrom(""); setDateTo("");
    setFilterStatus("ALL");
  };

  const pendingCount = orders.filter(o => o.status === "PENDING").length;
  const isFiltered = search || dateFrom || dateTo || filterStatus !== "ALL";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <MessageSquare className="text-green-500 w-5 h-5" />
            Orderan WhatsApp
            {pendingCount > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount} pending
              </span>
            )}
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">
            {orders.length} orderan ditemukan
            {isFiltered && <span className="text-blue-500 ml-1">· filter aktif</span>}
          </p>
        </div>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filter Bar */}
      <form onSubmit={handleSearch} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
        <div className="flex flex-wrap gap-2 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-gray-500 mb-1 block">Cari</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Nama, HP, pesan..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
              />
            </div>
          </div>

          {/* Date From */}
          <div className="w-36">
            <label className="text-xs text-gray-500 mb-1 block">Dari Tanggal</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
              />
            </div>
          </div>

          {/* Date To */}
          <div className="w-36">
            <label className="text-xs text-gray-500 mb-1 block">Sampai Tanggal</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-32">
            <label className="text-xs text-gray-500 mb-1 block">Status</label>
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as WaOrderStatus | "ALL")}
                className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-green-400 bg-white"
              >
                <option value="ALL">Semua</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Dikonfirmasi</option>
                <option value="REJECTED">Ditolak</option>
              </select>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 items-end pb-0.5">
            <button
              type="submit"
              className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-all"
            >
              Cari
            </button>
            {isFiltered && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs transition-all"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-8 text-center text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p className="text-sm">Memuat data...</p>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <MessageSquare className="mx-auto w-10 h-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium text-sm">Belum ada orderan</p>
          <p className="text-gray-400 text-xs mt-1">
            {isFiltered ? "Coba ubah filter pencarian" : "Orderan WA akan muncul di sini"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap">Waktu</th>
                <th className="text-left px-3 py-2.5 text-gray-500 font-semibold">Pengirim / Customer</th>
                <th className="text-left px-3 py-2.5 text-gray-500 font-semibold">Pesanan</th>
                <th className="text-left px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap">Sumber</th>
                <th className="text-left px-3 py-2.5 text-gray-500 font-semibold">Status</th>
                <th className="text-left px-3 py-2.5 text-gray-500 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map(order => {
                const cfg = STATUS_CONFIG[order.status];
                const Icon = cfg.icon;
                const botInfo = parseBotInfo(order.notes);
                const isExpanded = expandedId === order.id;
                const parsedItems = Array.isArray(order.parsedItems) ? order.parsedItems as Array<{productName?: string; quantity?: number; unit?: string}> : [];

                return (
                  <Fragment key={order.id}>
                    <tr
                      className={`hover:bg-gray-50 transition-colors ${order.status === "PENDING" ? "bg-amber-50/30" : ""}`}
                    >
                      {/* Waktu */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="font-medium text-gray-700">
                          {format(new Date(order.receivedAt), "dd/MM", { locale: idLocale })}
                        </div>
                        <div className="text-gray-400">
                          {format(new Date(order.receivedAt), "HH:mm")}
                        </div>
                      </td>

                      {/* Pengirim & Customer */}
                      <td className="px-3 py-2.5 max-w-[140px]">
                        <div className="font-semibold text-gray-800 truncate">{order.senderName}</div>
                        {order.customerName && order.customerName !== order.senderName && (
                          <div className="text-green-600 truncate">→ {order.customerName}</div>
                        )}
                        <div className="text-gray-400">{order.senderPhone}</div>
                      </td>

                      {/* Pesanan ringkas */}
                      <td className="px-3 py-2.5 max-w-[200px]">
                        {parsedItems.length > 0 ? (
                          <div>
                            <span className="text-gray-700">
                              {parsedItems.slice(0, 2).map((it, i) => (
                                <span key={i}>
                                  {i > 0 && ", "}
                                  {it.quantity} {it.unit} {it.productName}
                                </span>
                              ))}
                              {parsedItems.length > 2 && (
                                <span className="text-gray-400"> +{parsedItems.length - 2} lagi</span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-500 line-clamp-2">{order.rawMessage?.substring(0, 60)}…</span>
                        )}
                      </td>

                      {/* Sumber */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {order.groupName === "WA Bot AI" || botInfo ? (
                          <span className="flex items-center gap-1 text-purple-600">
                            <Bot className="w-3 h-3" />
                            {botInfo?.label || "Bot"}
                          </span>
                        ) : (
                          <span className="text-gray-400">{order.groupName || "Manual"}</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                        {order.confirmedBy && (
                          <div className="text-gray-400 mt-0.5">oleh {order.confirmedBy.name}</div>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 flex-nowrap">
                          {order.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => setConfirmingOrder(order)}
                                className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-medium transition-all whitespace-nowrap"
                              >
                                ✓ Konfirmasi
                              </button>
                              <button
                                onClick={() => handleReject(order.id)}
                                disabled={rejectingId === order.id}
                                className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-xs transition-all border border-red-100 whitespace-nowrap"
                              >
                                ✗ Tolak
                              </button>
                            </>
                          )}
                          {order.status === "CONFIRMED" && order.saleId && (
                            <a
                              href={`/dashboard/sales/${order.saleId}`}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-xs border border-blue-100 whitespace-nowrap flex items-center gap-1"
                            >
                              <FileText className="w-3 h-3" />
                              Invoice
                            </a>
                          )}
                          {order.status === "CONFIRMED" && order.deliveryOrderId && (
                            <a
                              href={`/dashboard/delivery-orders/${order.deliveryOrderId}`}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded text-xs border border-indigo-100 whitespace-nowrap"
                            >
                              SJ
                            </a>
                          )}
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : order.id)}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all"
                            title="Detail"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Detail Row */}
                    {isExpanded && (
                      <tr key={`${order.id}-detail`} className="bg-gray-50">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            {/* Pesan asli */}
                            <div>
                              <p className="font-semibold text-gray-600 mb-1 flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" /> Pesan Asli:
                              </p>
                              <div className="bg-white border border-gray-200 rounded-lg p-2.5 text-gray-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                {order.rawMessage}
                              </div>
                            </div>

                            {/* Info & Items */}
                            <div className="space-y-2">
                              {parsedItems.length > 0 && (
                                <div>
                                  <p className="font-semibold text-gray-600 mb-1">Item Barang ({parsedItems.length}):</p>
                                  <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                                    {parsedItems.map((item, i) => (
                                      <div key={i} className="px-2.5 py-1.5 flex items-center justify-between">
                                        <span className="text-gray-700">{item.productName || "?"}</span>
                                        <span className="text-gray-500 ml-2 whitespace-nowrap">{item.quantity} {item.unit}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {order.notes && (
                                <div>
                                  <p className="font-semibold text-gray-600 mb-1">Catatan:</p>
                                  <p className="text-gray-500 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 line-clamp-3">
                                    {order.notes}
                                  </p>
                                </div>
                              )}

                              {order.rejectedReason && (
                                <div className="bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 text-red-600">
                                  <strong>Alasan ditolak:</strong> {order.rejectedReason}
                                </div>
                              )}

                              {order.confirmedAt && (
                                <p className="text-gray-400">
                                  Dikonfirmasi: {format(new Date(order.confirmedAt), "dd MMM yyyy HH:mm", { locale: idLocale })}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmingOrder && (
        <ConfirmWaOrderModal
          order={confirmingOrder}
          onClose={() => setConfirmingOrder(null)}
          onSuccess={() => { setConfirmingOrder(null); fetchOrders(); }}
        />
      )}
    </div>
  );
}
