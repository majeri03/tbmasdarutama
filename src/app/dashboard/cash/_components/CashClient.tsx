"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/utils/pos-helpers";

interface CashMovement {
  id: string;
  type: "IN" | "OUT";
  amount: number;
  description: string;
  category: string | null;
  createdAt: string;
  createdByName: string;
}

interface CashData {
  balance: number;
  totalIn: number;
  totalOut: number;
  transactions: CashMovement[];
}

// Tanggal lokal (yyyy-mm-dd) untuk <input type="date">. JANGAN pakai
// toISOString() di sini: itu UTC, jadi jam 00:00-07:59 WITA akan
// menampilkan tanggal KEMARIN.
function toISODateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function firstDayOfMonthInput(): string {
  const now = new Date();
  return toISODateInput(new Date(now.getFullYear(), now.getMonth(), 1));
}

export default function CashClient() {
  const [dateFrom, setDateFrom] = useState(firstDayOfMonthInput());
  const [dateTo, setDateTo] = useState(toISODateInput(new Date()));
  const [typeFilter, setTypeFilter] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [data, setData] = useState<CashData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Form catat kas
  const [formType, setFormType] = useState<"IN" | "OUT">("IN");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const loadData = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      setError("Pilih tanggal awal dan tanggal akhir dulu");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      // PENTING: API membandingkan createdAt <= dateTo mentah-mentah
      // (tanpa endOfDay). Kalau dikirim "2026-11-25" saja, itu tengah
      // malam UTC = 07:00 WITA — gerakan kas tanggal itu sesudah jam 7
      // pagi tidak ikut. Jadi kirim rentang penuh hari lokal.
      const from = new Date(`${dateFrom}T00:00:00`).toISOString();
      const to = new Date(`${dateTo}T23:59:59`).toISOString();
      const params = new URLSearchParams({ dateFrom: from, dateTo: to });
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      const res = await fetch(`/api/cash-movements?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat data kas");
      }
      setData(json.data as CashData);
    } catch (e) {
      console.error("Error loading cash movements:", e);
      setError(e instanceof Error ? e.message : "Gagal memuat data kas");
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, typeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setFormError("Jumlah harus angka lebih dari 0");
      return;
    }
    if (!description.trim()) {
      setFormError("Keterangan wajib diisi");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/cash-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formType,
          amount: amountNum,
          description: description.trim(),
          category: category.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mencatat kas");
      }
      setFormSuccess(
        `Kas ${formType === "IN" ? "masuk" : "keluar"} ${formatCurrency(amountNum)} berhasil dicatat`
      );
      setAmount("");
      setDescription("");
      setCategory("");
      await loadData();
    } catch (err) {
      console.error("Error saving cash movement:", err);
      setFormError(err instanceof Error ? err.message : "Gagal mencatat kas");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })} ${d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  return (
    <div className="space-y-6">
      {/* Ringkasan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6">
          <p className="text-sm text-stone-600 mb-1">Saldo Kas</p>
          <p className="text-2xl font-bold text-red-900">
            {data ? formatCurrency(data.balance) : "—"}
          </p>
          <p className="text-stone-500 text-xs mt-1">
            Total semua kas masuk − total semua kas keluar
          </p>
        </div>
        <div className="glass-card p-6">
          <p className="text-sm text-stone-600 mb-1">Kas Masuk (periode ini)</p>
          <p className="text-2xl font-bold text-green-700">
            {data ? formatCurrency(data.totalIn) : "—"}
          </p>
          <p className="text-stone-500 text-xs mt-1">
            {dateFrom} s.d. {dateTo}
          </p>
        </div>
        <div className="glass-card p-6">
          <p className="text-sm text-stone-600 mb-1">Kas Keluar (periode ini)</p>
          <p className="text-2xl font-bold text-red-800">
            {data ? formatCurrency(data.totalOut) : "—"}
          </p>
          <p className="text-stone-500 text-xs mt-1">
            {dateFrom} s.d. {dateTo}
          </p>
        </div>
      </div>

      {/* Form catat kas */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-stone-900 mb-4">
          Catat Kas Masuk / Keluar
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFormType("IN")}
              className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition ${ formType === "IN" ? "bg-green-700 text-white shadow" : "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100" }`}
            >
              Kas Masuk
            </button>
            <button
              type="button"
              onClick={() => setFormType("OUT")}
              className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition ${ formType === "OUT" ? "bg-red-900 text-white shadow" : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100" }`}
            >
              Kas Keluar
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label mb-2">
                Jumlah (Rp) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-field"
                placeholder="cth: 500000"
                required
                min="0"
                step="1"
              />
            </div>
            <div>
              <label className="label mb-2">
                Kategori (opsional)
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-field"
                placeholder="cth: Penjualan, Operasional, Gaji"
                maxLength={100}
              />
            </div>
          </div>
          <div>
            <label className="label mb-2">
              Keterangan <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field"
              placeholder="cth: Setoran tunai penjualan hari ini"
              required
              maxLength={500}
            />
          </div>
          {formError && (
            <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {formError}
            </p>
          )}
          {formSuccess && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
              {formSuccess}
            </p>
          )}
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Menyimpan..." : "Simpan"}
          </button>
        </form>
      </div>

      {/* Filter + daftar */}
      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label className="label mb-2">
              Dari tanggal
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="flex-1">
            <label className="label mb-2">
              Sampai tanggal
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="flex-1">
            <label className="label mb-2">
              Jenis
            </label>
            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as "ALL" | "IN" | "OUT")
              }
              className="input-field"
            >
              <option value="ALL">Semua</option>
              <option value="IN">Kas Masuk</option>
              <option value="OUT">Kas Keluar</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="button" onClick={loadData} className="btn-primary">
              Tampilkan
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-900 mx-auto"></div>
            <p className="mt-4 text-stone-600">Memuat data kas...</p>
          </div>
        ) : error ? (
          <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </p>
        ) : !data || data.transactions.length === 0 ? (
          <p className="text-center text-stone-500 py-12">
            Belum ada arus kas pada periode ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-900">
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider">
                    Keterangan
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider">
                    Kategori
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider">
                    Oleh
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider">
                    Masuk
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider">
                    Keluar
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-stone-200 even:bg-[#FAFAFA]"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDateTime(t.createdAt)}
                    </td>
                    <td className="px-3 py-2">{t.description}</td>
                    <td className="px-3 py-2">{t.category || "—"}</td>
                    <td className="px-3 py-2">{t.createdByName}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-green-700">
                      {t.type === "IN" ? formatCurrency(t.amount) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-red-800">
                      {t.type === "OUT" ? formatCurrency(t.amount) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-stone-500 mt-3">
              Menampilkan {data.transactions.length} transaksi terakhir
              (maksimal 100 dari API).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
