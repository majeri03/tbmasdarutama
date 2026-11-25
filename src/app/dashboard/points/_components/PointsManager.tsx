"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Star, Save, Loader2, Plus, Minus, Search } from "lucide-react";
import { getStoreSetting, updateStoreSetting } from "@/lib/actions/store-setting.actions";
import { getCustomers, adjustCustomerPoints } from "@/lib/actions/customer.actions";
import { hasMinimumRole } from "@/lib/utils/role";
import { useToast } from "@/components/ui/toast";
import { Toast } from "@/components/ui/toast";

// WS-8 (25 Nov 2026) — desain ulang tampilan poin loyalitas: tabel rapi
// + filter/pencarian + ringkasan total. LOGIKA TIDAK BERUBAH: aturan dapat
// poin, pengaturan Rp per poin, dan penyesuaian manual sama seperti
// sebelumnya; saldo poin tetap dari server, kolom Total Belanja (lunas)
// adalah agregat tampilan dari getCustomers (lihat customer.actions.ts).
// Aksen visual: merah gelap #7F1D1D, latar putih / abu terang.
// Aturan akses (tidak berubah, server tetap yang memutuskan):
// - Pengaturan poin (aktif/mati + Rp per poin): SUPER_ADMIN saja
//   (updateStoreSetting: MANAGE_STORE_SETTINGS). KASIR/ADMIN hanya melihat
//   nilai yang sedang berlaku.
// - Saldo poin: KASIR+ (getCustomers: requireMinimumRole KASIR; POS butuh ini).
// - Penyesuaian manual poin: SUPER_ADMIN saja (adjustCustomerPoints:
//   requireMinimumRole SUPER_ADMIN; Umum ditolak server, saldo tidak < 0).
// Aturan dapat poin TIDAK berubah: poin = floor(grandTotal /
// pointsRupiahPerPoint), hanya penjualan lunas (bukan CREDIT), bukan
// customer Umum.

// Tombol utama lokal (aksen #7F1D1D). Sengaja TIDAK memakai .btn-primary
// global (gradien biru) supaya halaman ini memakai palet aplikasi yang
// sama dengan APK; .btn-primary global tidak diubah agar halaman lain
// tidak ikut berubah.
const btnAccent =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#7F1D1D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#991B1B] disabled:opacity-50";
const btnAccentSm =
  "inline-flex items-center gap-1 rounded-lg bg-[#7F1D1D] px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#991B1B] disabled:opacity-50";

type CustomerRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  points: number;
  // Dikirim server (getCustomers, WS-8): jumlah grandTotal penjualan
  // lunas (COMPLETED, bukan CREDIT). Opsional supaya data lama tanpa
  // field ini tetap tampil (dianggap 0).
  totalBelanja?: number;
};

type TypeFilter = "ALL" | "REGULER" | "GROSIR" | "PROYEK" | "UMUM";
type PointsFilter = "ALL" | "HAS_POINTS" | "NO_POINTS";
type SortKey = "name" | "points" | "belanja";

const formatRp = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

export default function PointsManager() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const canRead = hasMinimumRole(session, "KASIR");

  const [loading, setLoading] = useState(true);
  const [savingPoints, setSavingPoints] = useState(false);
  const [pointsEnabled, setPointsEnabled] = useState(true);
  const [pointsRupiahPerPoint, setPointsRupiahPerPoint] = useState("10000");

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [pointsFilter, setPointsFilter] = useState<PointsFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [adjustInputs, setAdjustInputs] = useState<Record<string, string>>({});
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustMessages, setAdjustMessages] = useState<Record<string, string>>({});

  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    if (canRead) {
      fetchPointsSettings();
      fetchCustomers();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  const fetchPointsSettings = async () => {
    const result = await getStoreSetting();
    if (result.success && result.data) {
      const s = result.data as { pointsEnabled?: boolean; pointsRupiahPerPoint?: number };
      setPointsEnabled(s.pointsEnabled ?? true);
      setPointsRupiahPerPoint(String(s.pointsRupiahPerPoint ?? 10000));
    }
  };

  const fetchCustomers = async () => {
    try {
      const result = await getCustomers();
      if (result.success && result.data) {
        setCustomers(
          (result.data as CustomerRow[]).map((c) => ({
            id: c.id,
            code: c.code,
            name: c.name,
            type: c.type,
            points: c.points ?? 0,
            totalBelanja: c.totalBelanja ?? 0,
          }))
        );
      } else {
        showToast(result.error || "Gagal memuat saldo poin customer", "error");
      }
    } catch {
      showToast("Gagal memuat saldo poin customer", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePoints = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = Number(pointsRupiahPerPoint);
    if (!Number.isInteger(rate) || rate < 1) {
      showToast("Nilai Rp per poin harus bilangan bulat minimal Rp 1", "error");
      return;
    }
    setSavingPoints(true);
    try {
      const result = await updateStoreSetting({
        pointsEnabled,
        pointsRupiahPerPoint: rate,
      });
      if (result.success) {
        showToast("Pengaturan poin berhasil disimpan", "success");
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal menyimpan pengaturan poin", "error");
    } finally {
      setSavingPoints(false);
    }
  };

  const handleAdjustPoints = async (customerId: string, sign: 1 | -1) => {
    const amount = parseInt(adjustInputs[customerId] || "", 10);
    if (!amount || amount <= 0) {
      setAdjustMessages((m) => ({ ...m, [customerId]: "Masukkan jumlah poin lebih dari 0" }));
      return;
    }
    setAdjustingId(customerId);
    setAdjustMessages((m) => ({ ...m, [customerId]: "" }));
    try {
      const result = await adjustCustomerPoints(customerId, sign * amount);
      if (result.success) {
        const data = result.data as unknown as { points?: number } | null;
        setCustomers((list) =>
          list.map((c) =>
            c.id === customerId
              ? { ...c, points: typeof data?.points === "number" ? data.points : Math.max(0, c.points + sign * amount) }
              : c
          )
        );
        setAdjustInputs((v) => ({ ...v, [customerId]: "" }));
        setAdjustMessages((m) => ({
          ...m,
          [customerId]: sign > 0 ? `${amount} poin ditambahkan` : `${amount} poin dikurangi`,
        }));
      } else {
        setAdjustMessages((m) => ({ ...m, [customerId]: result.error || "Gagal mengubah poin" }));
      }
    } catch {
      setAdjustMessages((m) => ({ ...m, [customerId]: "Gagal mengubah poin" }));
    } finally {
      setAdjustingId(null);
    }
  };

  // ---------- Tampilan: filter + urutan + total (klien saja) ----------
  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = customers.filter((c) => {
      if (typeFilter !== "ALL" && c.type !== typeFilter) return false;
      if (pointsFilter === "HAS_POINTS" && (c.points ?? 0) <= 0) return false;
      if (pointsFilter === "NO_POINTS" && (c.points ?? 0) > 0) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.code.toLowerCase().includes(q)) return false;
      return true;
    });
    switch (sortKey) {
      case "points":
        return [...list].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
      case "belanja":
        return [...list].sort((a, b) => (b.totalBelanja ?? 0) - (a.totalBelanja ?? 0));
      case "name":
      default:
        return [...list].sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
    }
  }, [customers, search, typeFilter, pointsFilter, sortKey]);

  // Total mengikuti filter yang aktif; customer UMUM tidak dihitung
  // (tidak punya poin dan tidak masuk total belanja berpoin).
  const totals = useMemo(() => {
    const counted = filteredCustomers.filter((c) => c.type !== "UMUM");
    return {
      count: counted.length,
      totalPoints: counted.reduce((sum, c) => sum + (c.points ?? 0), 0),
      totalBelanja: counted.reduce((sum, c) => sum + (c.totalBelanja ?? 0), 0),
    };
  }, [filteredCustomers]);

  const typeChips: { key: TypeFilter; label: string }[] = [
    { key: "ALL", label: "Semua Tipe" },
    { key: "REGULER", label: "Reguler" },
    { key: "GROSIR", label: "Grosir" },
    { key: "PROYEK", label: "Proyek" },
    { key: "UMUM", label: "Umum" },
  ];
  const pointsChips: { key: PointsFilter; label: string }[] = [
    { key: "ALL", label: "Semua Poin" },
    { key: "HAS_POINTS", label: "Ada Poin" },
    { key: "NO_POINTS", label: "Tanpa Poin" },
  ];

  return (
    <div className="space-y-4">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}

      {/* ---------- Pengaturan Poin ---------- */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-[#7F1D1D]" />
          <h2 className="text-lg font-semibold text-gray-800">Poin Loyalitas Customer</h2>
        </div>
        <p className="text-sm text-gray-600">
          Customer mendapat poin dari penjualan lunas (bukan CREDIT), bukan
          customer Umum. Poin = total belanja dibagi nilai Rp per poin
          (dibulatkan ke bawah). Contoh: Rp 10.000 per poin, belanja Rp 250.000
          = 25 poin.
        </p>
        {isSuperAdmin ? (
          <form onSubmit={handleSavePoints} className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={pointsEnabled}
                onChange={(e) => setPointsEnabled(e.target.checked)}
                className="w-4 h-4 accent-[#7F1D1D] rounded"
              />
              <span className="text-sm font-medium text-gray-700">Aktifkan pemberian poin</span>
            </label>
            <div>
              <label className="label">Nilai Rp per 1 poin</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 font-medium">Rp</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={pointsRupiahPerPoint}
                  onChange={(e) => setPointsRupiahPerPoint(e.target.value)}
                  className="glass-input w-40"
                  placeholder="10000"
                />
              </div>
            </div>
            <button type="submit" disabled={savingPoints} className={btnAccent}>
              {savingPoints ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan Pengaturan Poin
            </button>
          </form>
        ) : (
          <p className="text-sm text-gray-600">
            Saat ini poin <strong>{pointsEnabled ? "aktif" : "nonaktif"}</strong>, Rp{" "}
            {Number(pointsRupiahPerPoint).toLocaleString("id-ID")} per 1 poin.
            Pengaturan ini hanya bisa diubah SUPER_ADMIN.
          </p>
        )}
      </div>

      {/* ---------- Ringkasan total ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Customer (bukan Umum)</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{totals.count}</p>
          <p className="text-xs text-gray-500">dari {filteredCustomers.length} baris tampil</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Saldo Poin</p>
          <p className="mt-1 text-2xl font-bold text-[#7F1D1D]">
            {totals.totalPoints.toLocaleString("id-ID")} poin
          </p>
          <p className="text-xs text-gray-500">Jumlah saldo semua customer</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Belanja (Lunas)</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatRp(totals.totalBelanja)}</p>
          <p className="text-xs text-gray-500">Penjualan lunas saja (bukan CREDIT)</p>
        </div>
      </div>

      {/* ---------- Saldo Poin Customer ---------- */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">Saldo Poin Customer</h2>
        <p className="text-sm text-gray-600">
          Saldo poin semua customer. Penyesuaian manual (tambah/kurang) hanya
          untuk SUPER_ADMIN; customer Umum tidak punya poin. Kolom Total
          Belanja hanya menghitung penjualan lunas (bukan CREDIT, bukan
          CANCELLED/RETURN) — basis yang sama dengan perolehan poin.
        </p>

        {/* Filter & pencarian */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="glass-input !pl-9 w-64"
              placeholder="Cari nama / kode customer…"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
            {typeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setTypeFilter(chip.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  typeFilter === chip.key
                    ? "bg-[#7F1D1D] text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
            {pointsChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setPointsFilter(chip.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  pointsFilter === chip.key
                    ? "bg-[#7F1D1D] text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="glass-input w-52"
            title="Urutkan tabel"
          >
            <option value="name">Urutkan: Nama (A–Z)</option>
            <option value="points">Urutkan: Saldo Poin ↓</option>
            <option value="belanja">Urutkan: Total Belanja ↓</option>
          </select>
          <span className="text-xs text-gray-500">
            Menampilkan {filteredCustomers.length} dari {customers.length} customer
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Memuat saldo poin…</p>
        ) : filteredCustomers.length === 0 ? (
          <p className="text-sm text-gray-500">Tidak ada customer yang cocok.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Tipe</th>
                  <th className="px-4 py-3 font-semibold text-right">Total Belanja (Lunas)</th>
                  <th className="px-4 py-3 font-semibold text-right">Saldo Poin</th>
                  {isSuperAdmin && <th className="px-4 py-3 font-semibold text-right">Penyesuaian Manual</th>}
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c) => {
                  const isUmum = c.type === "UMUM";
                  return (
                    <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.code}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${
                            isUmum
                              ? "bg-gray-100 text-gray-500"
                              : c.type === "GROSIR"
                                ? "bg-amber-50 text-amber-700"
                                : c.type === "PROYEK"
                                  ? "bg-violet-50 text-violet-700"
                                  : "bg-green-50 text-green-700"
                          }`}
                        >
                          {c.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                        {isUmum ? "—" : formatRp(c.totalBelanja ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#7F1D1D] whitespace-nowrap">
                        {isUmum ? "—" : `${(c.points ?? 0).toLocaleString("id-ID")} poin`}
                      </td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3 text-right">
                          {isUmum ? (
                            <span className="text-xs text-gray-400">Umum tidak dapat poin</span>
                          ) : (
                            <div className="inline-flex flex-col items-end gap-1">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={adjustInputs[c.id] || ""}
                                  onChange={(e) =>
                                    setAdjustInputs((v) => ({ ...v, [c.id]: e.target.value }))
                                  }
                                  className="glass-input w-20 !py-1 text-right"
                                  placeholder="0"
                                />
                                <button
                                  type="button"
                                  disabled={adjustingId === c.id}
                                  onClick={() => handleAdjustPoints(c.id, 1)}
                                  className={btnAccentSm}
                                  title="Tambah poin"
                                >
                                  <Plus className="w-3 h-3" /> Tambah
                                </button>
                                <button
                                  type="button"
                                  disabled={adjustingId === c.id}
                                  onClick={() => handleAdjustPoints(c.id, -1)}
                                  className="btn-secondary !py-1 !px-2 text-xs inline-flex items-center gap-1"
                                  title="Kurangi poin"
                                >
                                  <Minus className="w-3 h-3" /> Kurang
                                </button>
                              </div>
                              {adjustMessages[c.id] && (
                                <span className="text-xs text-gray-500">{adjustMessages[c.id]}</span>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-900">
                  <td className="px-4 py-3" colSpan={2}>
                    TOTAL ({totals.count} customer, bukan Umum)
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatRp(totals.totalBelanja)}</td>
                  <td className="px-4 py-3 text-right text-[#7F1D1D] whitespace-nowrap">
                    {totals.totalPoints.toLocaleString("id-ID")} poin
                  </td>
                  {isSuperAdmin && <td className="px-4 py-3" />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
