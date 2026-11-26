"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { X, User, Phone, Mail, MapPin, Building2, Tag, Calendar, CheckCircle, XCircle, History, Star, Plus, Minus, Loader2 } from "lucide-react";
import { CustomerType } from "@prisma/client";
import { getSales } from "@/lib/actions/sale.actions";
import { getAllCustomerDebts } from "@/lib/actions/customer-debt.actions";
// DEPENDENSI PKG-A (lihat pkg-c-NOTES.md): adjustCustomerPoints belum ada
// di HEAD ini — disediakan paket PKG-A di src/lib/actions/customer.actions.ts
// dengan kontrak adjustCustomerPoints(customerId: string, delta: number).
import { adjustCustomerPoints } from "@/lib/actions/customer.actions";

interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  type: CustomerType;
  isActive: boolean;
  // Poin ditambahkan PKG-A (Customer.points). Opsional supaya modal tetap
  // jalan sebelum PKG-A: tanpa poin, saldo tampil 0.
  points?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CustomerViewModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
}

// Bentuk minimal yang dipakai modal dari hasil getSales / getAllCustomerDebts
// (keduanya sudah mengembalikan angka, bukan Decimal).
interface HistorySale {
  id: string;
  invoiceNumber: string;
  saleDate: Date | string;
  grandTotal: number;
  status: string;
  paymentMethod: string;
}

interface HistoryDebt {
  id: string;
  debtNumber: string;
  totalDebt: number;
  paidAmount: number;
  remainingDebt: number;
  status: string;
  dueDate: Date | string;
  saleInvoiceNumber: string;
}

export function CustomerViewModal({
  customer,
  isOpen,
  onClose,
}: CustomerViewModalProps) {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const isUmum = customer?.type === CustomerType.UMUM;

  const [sales, setSales] = useState<HistorySale[]>([]);
  const [debts, setDebts] = useState<HistoryDebt[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [points, setPoints] = useState(0);
  const [pointsInput, setPointsInput] = useState("");
  const [adjustingPoints, setAdjustingPoints] = useState(false);
  const [pointsMessage, setPointsMessage] = useState("");

  const customerId = customer?.id;

  // Saldo poin mengikuti customer yang dibuka (reset tiap ganti customer).
  useEffect(() => {
    setPoints(customer?.points ?? 0);
    setPointsInput("");
    setPointsMessage("");
  }, [customerId, customer?.points]);

  const loadHistory = useCallback(async () => {
    if (!customerId) return;
    setLoadingHistory(true);
    setHistoryError("");
    try {
      const [salesResult, debtsResult] = await Promise.all([
        getSales({ customerId, page: 1, limit: 20 }),
        getAllCustomerDebts({ customerId, page: 1, limit: 20 }),
      ]);
      if (salesResult.success && salesResult.data) {
        setSales(
          salesResult.data.map((sale) => ({
            id: sale.id,
            invoiceNumber: sale.invoiceNumber,
            saleDate: sale.saleDate,
            grandTotal: Number(sale.grandTotal),
            status: sale.status,
            paymentMethod: sale.paymentMethod,
          }))
        );
      } else {
        setSales([]);
      }
      if (debtsResult.success && debtsResult.data) {
        setDebts(
          debtsResult.data.map((debt) => ({
            id: debt.id,
            debtNumber: debt.debtNumber,
            totalDebt: Number(debt.totalDebt),
            paidAmount: Number(debt.paidAmount),
            remainingDebt: Number(debt.remainingDebt),
            status: debt.status,
            dueDate: debt.dueDate,
            saleInvoiceNumber: debt.sale?.invoiceNumber || "-",
          }))
        );
      } else {
        setDebts([]);
      }
    } catch {
      setHistoryError("Gagal memuat riwayat transaksi");
      setSales([]);
      setDebts([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (isOpen && customerId) {
      loadHistory();
    }
  }, [isOpen, customerId, loadHistory]);

  const handleAdjustPoints = async (sign: 1 | -1) => {
    if (!customerId) return;
    const amount = parseInt(pointsInput, 10);
    if (!amount || amount <= 0) {
      setPointsMessage("Masukkan jumlah poin lebih dari 0");
      return;
    }
    setAdjustingPoints(true);
    setPointsMessage("");
    try {
      const delta = sign * amount;
      const prevPoints = points;
      const result = await adjustCustomerPoints(customerId, delta);
      if (result.success) {
        // Kontrak PKG-A: data berisi customer ter-update (termasuk points).
        // Kalau bentuknya berbeda, pakai hitungan optimistis sebagai fallback.
        const data = result.data as unknown as { points?: number } | null;
        const nextPoints =
          typeof data?.points === "number"
            ? data.points
            : Math.max(0, points + delta);
        const actualDelta = nextPoints - prevPoints;
        setPoints(nextPoints);
        setPointsInput("");
        // WS-F item 5 — dulu pesan selalu memakai jumlah yang DIMINTA
        // ("100 poin dikurangi") padahal server menahan saldo di 0, jadi
        // kalau saldo hanya 27 yang benar-benar berkurang cuma 27. Sekarang
        // pesan memakai selisih saldo yang sebenarnya terjadi.
        if (actualDelta > 0) {
          setPointsMessage(`${actualDelta} poin ditambahkan`);
        } else if (actualDelta < 0) {
          const requested = Math.abs(delta);
          setPointsMessage(
            requested > -actualDelta
              ? `${-actualDelta} poin dikurangi (saldo hanya ${prevPoints}, jadi hanya ${-actualDelta} yang bisa dikurangi)`
              : `${-actualDelta} poin dikurangi`
          );
        } else {
          setPointsMessage("Poin tidak berubah (saldo sudah 0)");
        }
      } else {
        setPointsMessage(result.error || "Gagal mengubah poin");
      }
    } catch {
      setPointsMessage("Gagal mengubah poin");
    } finally {
      setAdjustingPoints(false);
    }
  };

  if (!isOpen || !customer) return null;

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const formatShortDate = (date: Date | string) => {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const formatCurrency = (value: number) => {
    return `Rp ${value.toLocaleString("id-ID")}`;
  };

  const getCustomerTypeLabel = (type: CustomerType) => {
    const types = {
      [CustomerType.UMUM]: { label: "Umum", color: "stone" },
      [CustomerType.REGULER]: { label: "Reguler", color: "red" },
      [CustomerType.GROSIR]: { label: "Grosir", color: "green" },
      [CustomerType.PROYEK]: { label: "Proyek", color: "stone" },
    };
    return types[type];
  };

  const typeInfo = getCustomerTypeLabel(customer.type);

  // WS-F item 92 — penjualan CANCELLED dikeluarkan dari Total Belanja
  // (aturan bersama: hanya CANCELLED yang dikeluarkan; RETURN tetap
  // dihitung). Riwayat di tabel bawah tetap menampilkan semua penjualan
  // termasuk yang dibatalkan; yang dikoreksi hanya totalnya. Contoh:
  // TEST-Pelanggan Rp257.500 termasuk penjualan yang dibatalkan (salah
  // satunya Rp2.550) -> total yang benar Rp250.700. "Transaksi" tetap
  // menghitung baris riwayat yang ditampilkan (maks. 20).
  const totalBelanja = sales.reduce(
    (sum, sale) => (sale.status === "CANCELLED" ? sum : sum + sale.grandTotal),
    0
  );
  const totalSisaUtang = debts.reduce((sum, debt) => sum + debt.remainingDebt, 0);

  const saleStatusStyle: Record<string, string> = {
    COMPLETED: "bg-green-50 text-green-700 border-green-200",
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    CANCELLED: "bg-red-50 text-red-700 border-red-200",
    RETURN: "bg-stone-50 text-stone-700 border-stone-200",
  };

  const debtStatusStyle: Record<string, string> = {
    PAID: "bg-green-50 text-green-700 border-green-200",
    PARTIAL: "bg-amber-50 text-amber-700 border-amber-200",
    UNPAID: "bg-red-50 text-red-700 border-red-200",
    OVERDUE: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-stone-200 p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-900 flex items-center justify-center shadow-lg shadow-red-900/20">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-stone-900">
                Detail Customer
              </h2>
              <p className="text-sm text-stone-600 mt-1">{customer.code}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700 transition-colors"
          >
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status & Type Badge */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status Badge */}
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-xl ${ customer.isActive ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200" }`}
            >
              {customer.isActive ? (
                <CheckCircle className="w-5 h-5 text-green-700" />
              ) : (
                <XCircle className="w-5 h-5 text-red-800" />
              )}
              <span
                className={`text-sm font-semibold ${ customer.isActive ? "text-green-700" : "text-red-700" }`}
              >
                {customer.isActive ? "Aktif" : "Nonaktif"}
              </span>
            </div>

            {/* Type Badge */}
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-${typeInfo.color}-50 border border-${typeInfo.color}-200`}
            >
              <Tag className={`w-5 h-5 text-${typeInfo.color}-600`} />
              <span className={`text-sm font-semibold text-${typeInfo.color}-700`}>
                {typeInfo.label}
              </span>
            </div>
          </div>

          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-red-900" />
              Informasi Dasar
            </h3>
            <div className="glass-card p-4 space-y-3">
              <div className="flex justify-between py-2 border-b border-stone-100">
                <span className="text-sm text-stone-600">Nama Customer:</span>
                <span className="text-sm font-semibold text-stone-900">
                  {customer.name}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-stone-100">
                <span className="text-sm text-stone-600">Kode Customer:</span>
                <span className="text-sm font-mono font-semibold text-red-900">
                  {customer.code}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-stone-100">
                <span className="text-sm text-stone-600">Tipe Customer:</span>
                <span className={`text-sm font-semibold text-${typeInfo.color}-600`}>
                  {typeInfo.label}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-stone-600">Status:</span>
                <span
                  className={`text-sm font-semibold ${ customer.isActive ? "text-green-700" : "text-red-800" }`}
                >
                  {customer.isActive ? "Aktif" : "Nonaktif"}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <Phone className="w-5 h-5 text-red-900" />
              Informasi Kontak
            </h3>
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center gap-3 py-2 border-b border-stone-100">
                <Phone className="w-4 h-4 text-stone-400" />
                <div className="flex-1 flex justify-between">
                  <span className="text-sm text-stone-600">Telepon:</span>
                  <span className="text-sm font-semibold text-stone-900">
                    {customer.phone || "-"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 py-2">
                <Mail className="w-4 h-4 text-stone-400" />
                <div className="flex-1 flex justify-between">
                  <span className="text-sm text-stone-600">Email:</span>
                  <span className="text-sm font-semibold text-stone-900">
                    {customer.email || "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div>
            <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-red-900" />
              Alamat
            </h3>
            <div className="glass-card p-4 space-y-3">
              <div className="py-2 border-b border-stone-100">
                <span className="text-sm text-stone-600 block mb-1">
                  Alamat Lengkap:
                </span>
                <span className="text-sm text-stone-900">
                  {customer.address || "-"}
                </span>
              </div>
              <div className="flex items-center gap-3 py-2 border-b border-stone-100">
                <Building2 className="w-4 h-4 text-stone-400" />
                <div className="flex-1 flex justify-between">
                  <span className="text-sm text-stone-600">Kota:</span>
                  <span className="text-sm font-semibold text-stone-900">
                    {customer.city || "-"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 py-2">
                <Building2 className="w-4 h-4 text-stone-400" />
                <div className="flex-1 flex justify-between">
                  <span className="text-sm text-stone-600">Provinsi:</span>
                  <span className="text-sm font-semibold text-stone-900">
                    {customer.province || "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div>
            <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-red-900" />
              Informasi Waktu
            </h3>
            <div className="glass-card p-4 space-y-3">
              <div className="flex justify-between py-2 border-b border-stone-100">
                <span className="text-sm text-stone-600">Dibuat pada:</span>
                <span className="text-sm text-stone-900">
                  {formatDate(customer.createdAt)}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-stone-600">
                  Terakhir diperbarui:
                </span>
                <span className="text-sm text-stone-900">
                  {formatDate(customer.updatedAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Poin Customer */}
          <div>
            <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-red-900" />
              Poin Customer
            </h3>
            <div className="glass-card p-4 space-y-3">
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-stone-600">Saldo poin:</span>
                <span className="text-lg font-bold text-amber-600">
                  {points.toLocaleString("id-ID")} poin
                </span>
              </div>
              {isUmum ? (
                <p className="text-xs text-stone-500 border-t border-stone-100 pt-3">
                  Customer Umum tidak mendapatkan poin.
                </p>
              ) : isSuperAdmin ? (
                <div className="border-t border-stone-100 pt-3">
                  <p className="text-xs text-stone-500 mb-2">
                    Atur poin (hanya SUPER_ADMIN):
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={pointsInput}
                      onChange={(e) => setPointsInput(e.target.value)}
                      placeholder="Jumlah poin"
                      className="w-32 px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-900"
                    />
                    <button
                      onClick={() => handleAdjustPoints(1)}
                      disabled={adjustingPoints}
                      className="px-3 py-2 bg-green-700 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Tambah
                    </button>
                    <button
                      onClick={() => handleAdjustPoints(-1)}
                      disabled={adjustingPoints}
                      className="px-3 py-2 bg-red-900 text-white text-sm font-semibold rounded-xl hover:bg-red-800 disabled:opacity-50 flex items-center gap-1"
                    >
                      <Minus className="w-4 h-4" />
                      Kurangi
                    </button>
                    {adjustingPoints && (
                      <Loader2 className="w-4 h-4 animate-spin text-red-900" />
                    )}
                  </div>
                  {pointsMessage && (
                    <p className="text-xs text-stone-600 mt-2">{pointsMessage}</p>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Transaction History */}
          <div>
            <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-red-900" />
              Riwayat Transaksi
            </h3>
            {loadingHistory ? (
              <div className="glass-card p-8 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-red-900" />
                <span className="text-sm text-stone-600">Memuat riwayat...</span>
              </div>
            ) : historyError ? (
              <div className="glass-card p-8 text-center">
                <p className="text-sm text-red-800">{historyError}</p>
                <button
                  onClick={() => loadHistory()}
                  className="mt-3 px-4 py-2 bg-red-900 text-white text-sm font-semibold rounded-xl hover:bg-red-800"
                >
                  Coba Lagi
                </button>
              </div>
            ) : sales.length === 0 && debts.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-8 h-8 text-stone-400" />
                </div>
                <p className="text-sm text-stone-600">
                  Belum ada transaksi untuk customer ini
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Ringkasan */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="glass-card p-3 text-center">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Transaksi</p>
                    <p className="text-lg font-bold text-stone-900">{sales.length}</p>
                  </div>
                  <div className="glass-card p-3 text-center">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Total Belanja</p>
                    <p className="text-sm font-bold text-stone-900 mt-1">
                      {formatCurrency(totalBelanja)}
                    </p>
                  </div>
                  <div className="glass-card p-3 text-center">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Sisa Utang</p>
                    <p className="text-sm font-bold text-red-800 mt-1">
                      {formatCurrency(totalSisaUtang)}
                    </p>
                  </div>
                </div>

                {/* Daftar penjualan */}
                {sales.length > 0 && (
                  <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-stone-100 text-left text-stone-500">
                            <th className="px-4 py-3 font-medium">Tanggal</th>
                            <th className="px-4 py-3 font-medium">Invoice</th>
                            <th className="px-4 py-3 font-medium">Pembayaran</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sales.map((sale) => (
                            <tr key={sale.id} className="border-b border-stone-100 last:border-0">
                              <td className="px-4 py-3 text-stone-900 whitespace-nowrap">
                                {formatShortDate(sale.saleDate)}
                              </td>
                              <td className="px-4 py-3 font-mono font-semibold text-red-900">
                                {sale.invoiceNumber}
                              </td>
                              <td className="px-4 py-3 text-stone-900">{sale.paymentMethod}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-0.5 rounded border text-xs font-medium ${saleStatusStyle[sale.status] || "bg-stone-50 text-stone-700 border-stone-200"}`}
                                >
                                  {sale.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-stone-900">
                                {formatCurrency(sale.grandTotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Daftar utang */}
                {debts.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-stone-900 mb-2">
                      Utang Customer
                    </h4>
                    <div className="glass-card overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-stone-100 text-left text-stone-500">
                              <th className="px-4 py-3 font-medium">No. Utang</th>
                              <th className="px-4 py-3 font-medium">Invoice</th>
                              <th className="px-4 py-3 font-medium">Jatuh Tempo</th>
                              <th className="px-4 py-3 font-medium">Status</th>
                              <th className="px-4 py-3 font-medium text-right">Sisa Utang</th>
                            </tr>
                          </thead>
                          <tbody>
                            {debts.map((debt) => (
                              <tr key={debt.id} className="border-b border-stone-100 last:border-0">
                                <td className="px-4 py-3 font-mono font-semibold text-red-900">
                                  {debt.debtNumber}
                                </td>
                                <td className="px-4 py-3 font-mono text-stone-900">
                                  {debt.saleInvoiceNumber}
                                </td>
                                <td className="px-4 py-3 text-stone-900 whitespace-nowrap">
                                  {formatShortDate(debt.dueDate)}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`px-2 py-0.5 rounded border text-xs font-medium ${debtStatusStyle[debt.status] || "bg-stone-50 text-stone-700 border-stone-200"}`}
                                  >
                                    {debt.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-red-800">
                                  {formatCurrency(debt.remainingDebt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-stone-50/90 backdrop-blur-sm border-t border-stone-200 p-6">
          <button onClick={onClose} className="w-full btn-secondary">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
