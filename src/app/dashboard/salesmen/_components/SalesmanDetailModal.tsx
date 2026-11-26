"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { X, User, History, Loader2, CheckCircle, XCircle } from "lucide-react";
import {
  getSalesmanDetail,
  updateSaleFeeOverride,
  type SalesmanDetail,
} from "@/lib/actions/salesman.actions";

// Detail salesman (24 Nov 2026): modal mengikuti pola CustomerViewModal /
// SaleViewModal — BUKAN halaman /dashboard/salesmen/[id] sendiri, karena
// daftar transaksi per salesman umumnya pendek (sama seperti riwayat
// customer yang dibatasi 20 baris di CustomerViewModal) dan tidak butuh
// route + PageGuard baru. Kalau suatu hari satu salesman punya ratusan
// transaksi sampai modal terasa berat, baru pindah ke halaman sendiri
// dengan paginasi di getSalesmanDetail.
// Isi: semua penjualan salesman (no. invoice, tanggal, customer, grand
// total) + persen fee + jumlah fee per baris, dan di atas: TOTAL penjualan
// + TOTAL fee — semuanya dihitung di SERVER (getSalesmanDetail).
// Fee TIDAK PERNAH dicetak di invoice/struk/surat jalan (internal saja).

const btnAccentSm =
  "inline-flex items-center gap-1 rounded-xl bg-[#7F1D1D] px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#991B1B] disabled:opacity-50";

interface SalesmanDetailModalProps {
  salesman: { id: string; name: string; phone: string | null; isActive: boolean } | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SalesmanDetailModal({ salesman, isOpen, onClose }: SalesmanDetailModalProps) {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  const [detail, setDetail] = useState<SalesmanDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savingSaleId, setSavingSaleId] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState("");
  // Draft override per baris: enabled "global" | "on" | "off", percent "" = ikut global.
  const [drafts, setDrafts] = useState<
    Record<string, { enabled: string; percent: string }>
  >({});

  const salesmanId = salesman?.id;

  const loadDetail = useCallback(async () => {
    if (!salesmanId) return;
    setLoading(true);
    setError("");
    setRowMessage("");
    try {
      const result = await getSalesmanDetail(salesmanId);
      if (result.success && result.data) {
        setDetail(result.data);
        const nextDrafts: Record<string, { enabled: string; percent: string }> = {};
        for (const row of result.data.sales) {
          nextDrafts[row.id] = {
            enabled:
              row.feeEnabledOverride === null
                ? "global"
                : row.feeEnabledOverride
                  ? "on"
                  : "off",
            percent:
              row.feePercentOverride === null ? "" : String(row.feePercentOverride),
          };
        }
        setDrafts(nextDrafts);
      } else {
        setDetail(null);
        setError(result.error || "Gagal memuat detail salesman");
      }
    } catch {
      setDetail(null);
      setError("Gagal memuat detail salesman");
    } finally {
      setLoading(false);
    }
  }, [salesmanId]);

  useEffect(() => {
    if (isOpen && salesmanId) {
      loadDetail();
    }
  }, [isOpen, salesmanId, loadDetail]);

  if (!isOpen || !salesman) return null;

  const formatCurrency = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

  const formatShortDate = (date: Date | string) =>
    new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));

  const handleOverrideChange = async (
    saleId: string,
    field: "enabled" | "percent",
    value: string
  ) => {
    const draft = {
      ...(drafts[saleId] || { enabled: "global", percent: "" }),
      [field]: value,
    };
    setDrafts((prev) => ({ ...prev, [saleId]: draft }));

    // Select "fee invoice ini" langsung tersimpan; persen disimpan lewat tombol ✓.
    if (field !== "enabled") return;
    setSavingSaleId(saleId);
    setRowMessage("");
    try {
      const result = await updateSaleFeeOverride(saleId, {
        enabled: value === "global" ? null : value === "on",
      });
      if (result.success) {
        setRowMessage(result.message || "Pengaturan fee invoice disimpan.");
        await loadDetail();
      } else {
        setRowMessage(result.error || "Gagal menyimpan pengaturan fee invoice.");
        await loadDetail();
      }
    } catch {
      setRowMessage("Gagal menyimpan pengaturan fee invoice.");
    } finally {
      setSavingSaleId(null);
    }
  };

  const handlePercentSave = async (saleId: string) => {
    const draft = drafts[saleId] || { enabled: "global", percent: "" };
    const raw = draft.percent.trim();
    if (raw === "") {
      // Kosong = ikut persen global.
      setSavingSaleId(saleId);
      try {
        const result = await updateSaleFeeOverride(saleId, { percent: null });
        setRowMessage(
          result.success
            ? result.message || "Persen fee invoice kembali ikut global."
            : result.error || "Gagal menyimpan persen fee invoice."
        );
        await loadDetail();
      } catch {
        setRowMessage("Gagal menyimpan persen fee invoice.");
      } finally {
        setSavingSaleId(null);
      }
      return;
    }
    const percent = Number(raw);
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
      setRowMessage("Persen fee harus bilangan bulat 0–100.");
      return;
    }
    setSavingSaleId(saleId);
    setRowMessage("");
    try {
      const result = await updateSaleFeeOverride(saleId, { percent });
      setRowMessage(
        result.success
          ? result.message || "Persen fee invoice disimpan."
          : result.error || "Gagal menyimpan persen fee invoice."
      );
      await loadDetail();
    } catch {
      setRowMessage("Gagal menyimpan persen fee invoice.");
    } finally {
      setSavingSaleId(null);
    }
  };

  const feeSetting = detail?.feeSetting;
  const saleStatusStyle: Record<string, string> = {
    COMPLETED: "bg-green-50 text-green-700 border-green-200",
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    CANCELLED: "bg-red-50 text-red-700 border-red-200",
    RETURN: "bg-stone-50 text-stone-700 border-stone-200",
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-stone-200 p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#7F1D1D] flex items-center justify-center shadow-lg shadow-red-900/20">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-stone-900">Detail Salesman</h2>
              <p className="text-sm text-stone-600 mt-1">
                {salesman.name}
                {salesman.phone ? ` • ${salesman.phone}` : ""}
              </p>
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
          <div className="flex items-center gap-3 flex-wrap">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-xl ${ salesman.isActive ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200" }`}
            >
              {salesman.isActive ? (
                <CheckCircle className="w-5 h-5 text-green-700" />
              ) : (
                <XCircle className="w-5 h-5 text-red-800" />
              )}
              <span
                className={`text-sm font-semibold ${ salesman.isActive ? "text-green-700" : "text-red-700" }`}
              >
                {salesman.isActive ? "Aktif" : "Nonaktif"}
              </span>
            </div>
            {feeSetting && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7F1D1D]/5 border border-[#7F1D1D]/20">
                <span className="text-sm font-semibold text-[#7F1D1D]">
                  Fee global: {feeSetting.enabled ? `AKTIF ${feeSetting.percent}%` : "NONAKTIF (fee Rp0)"}
                </span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="glass-card p-8 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#7F1D1D]" />
              <span className="text-sm text-stone-600">Memuat detail…</span>
            </div>
          ) : error ? (
            <div className="glass-card p-8 text-center">
              <p className="text-sm text-red-800">{error}</p>
              <button
                onClick={loadDetail}
                className="mt-3 px-4 py-2 bg-[#7F1D1D] text-white text-sm font-semibold rounded-xl hover:bg-[#991B1B]"
              >
                Coba Lagi
              </button>
            </div>
          ) : detail ? (
            <>
              {/* Ringkasan total — dihitung server */}
              <div className="grid grid-cols-3 gap-3">
                <div className="glass-card p-3 text-center">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Transaksi</p>
                  <p className="text-lg font-bold text-stone-900">{detail.salesCount}</p>
                </div>
                <div className="glass-card p-3 text-center">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Total Penjualan</p>
                  <p className="text-sm font-bold text-stone-900 mt-1">
                    {formatCurrency(detail.totalSales)}
                  </p>
                </div>
                <div className="glass-card p-3 text-center">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Total Fee</p>
                  <p className="text-sm font-bold text-[#7F1D1D] mt-1">
                    {formatCurrency(detail.totalFee)}
                  </p>
                </div>
              </div>

              {!feeSetting?.enabled && (
                <p className="text-xs text-stone-500">
                  Fee global sedang NONAKTIF, jadi fee semua invoice Rp0 (aturan utama:
                  fee global mati = tidak ada fee di invoice mana pun).
                </p>
              )}

              {/* Daftar penjualan */}
              <div>
                <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                  <History className="w-5 h-5 text-[#7F1D1D]" />
                  Riwayat Transaksi
                </h3>
                {detail.sales.length === 0 ? (
                  <div className="glass-card p-8 text-center">
                    <p className="text-sm text-stone-600">
                      Belum ada transaksi untuk salesman ini
                    </p>
                  </div>
                ) : (
                  <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-stone-100 text-left text-stone-500">
                            <th className="px-4 py-3 font-medium">Invoice</th>
                            <th className="px-4 py-3 font-medium">Tanggal</th>
                            <th className="px-4 py-3 font-medium">Customer</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium text-right">Grand Total</th>
                            <th className="px-4 py-3 font-medium text-right">Fee %</th>
                            <th className="px-4 py-3 font-medium text-right">Fee</th>
                            {isSuperAdmin && (
                              <th className="px-4 py-3 font-medium text-right">
                                Atur Fee Invoice
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {detail.sales.map((row) => {
                            const draft = drafts[row.id] || {
                              enabled: "global",
                              percent: "",
                            };
                            return (
                              <tr
                                key={row.id}
                                className="border-b border-stone-100 last:border-0"
                              >
                                <td className="px-4 py-3 font-mono font-semibold text-[#7F1D1D] whitespace-nowrap">
                                  {row.invoiceNumber}
                                </td>
                                <td className="px-4 py-3 text-stone-900 whitespace-nowrap">
                                  {formatShortDate(row.saleDate)}
                                </td>
                                <td className="px-4 py-3 text-stone-900">{row.customerName}</td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`px-2 py-0.5 rounded border text-xs font-medium ${saleStatusStyle[row.status] || "bg-stone-50 text-stone-700 border-stone-200"}`}
                                  >
                                    {row.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-stone-900 whitespace-nowrap">
                                  {formatCurrency(row.grandTotal)}
                                </td>
                                <td className="px-4 py-3 text-right text-stone-900 whitespace-nowrap">
                                  {row.feeEnabled ? `${row.feePercent}%` : "0% (mati)"}
                                  {row.feePercentOverride !== null && (
                                    <span className="block text-[11px] text-stone-400">
                                      khusus invoice
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-[#7F1D1D] whitespace-nowrap">
                                  {formatCurrency(row.feeAmount)}
                                </td>
                                {isSuperAdmin && (
                                  <td className="px-4 py-3 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1">
                                      <select
                                        value={draft.enabled}
                                        disabled={savingSaleId === row.id}
                                        onChange={(e) =>
                                          handleOverrideChange(row.id, "enabled", e.target.value)
                                        }
                                        className="glass-input !py-1 !px-2 text-xs w-28"
                                        title="Ikut global = mengikuti saklar fee global; Aktif/Nonaktif = khusus invoice ini"
                                      >
                                        <option value="global">Ikut global</option>
                                        <option value="on">Fee aktif</option>
                                        <option value="off">Fee nonaktif</option>
                                      </select>
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={draft.percent}
                                        disabled={savingSaleId === row.id}
                                        onChange={(e) =>
                                          setDrafts((prev) => ({
                                            ...prev,
                                            [row.id]: { ...draft, percent: e.target.value },
                                          }))
                                        }
                                        placeholder={`${feeSetting?.percent ?? 2}%`}
                                        className="glass-input !py-1 !px-2 text-xs w-16 text-right"
                                        title="Persen khusus invoice ini — kosongkan untuk ikut persen global"
                                      />
                                      <button
                                        type="button"
                                        disabled={savingSaleId === row.id}
                                        onClick={() => handlePercentSave(row.id)}
                                        className={btnAccentSm}
                                        title="Simpan persen khusus invoice ini"
                                      >
                                        {savingSaleId === row.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          "✓"
                                        )}
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {rowMessage && (
                  <p className="text-xs text-stone-600 mt-2">{rowMessage}</p>
                )}
                {isSuperAdmin && (
                  <p className="text-xs text-stone-500 mt-2">
                    Hanya SUPER_ADMIN yang bisa mengubah fee per invoice. &quot;Ikut
                    global&quot; = invoice mengikuti saklar fee global; kalau saklar
                    global mati, fee invoice ini tetap Rp0.
                  </p>
                )}
              </div>
            </>
          ) : null}
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
