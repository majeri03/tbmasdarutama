"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Star, Save, Loader2, Plus, Minus } from "lucide-react";
import { getStoreSetting, updateStoreSetting } from "@/lib/actions/store-setting.actions";
import { getCustomers, adjustCustomerPoints } from "@/lib/actions/customer.actions";
import { hasMinimumRole } from "@/lib/utils/role";
import { useToast } from "@/components/ui/toast";
import { Toast } from "@/components/ui/toast";

// Dipindah dari SalesSettingsTab (tab "Sales & Poin" di Pengaturan, dihapus
// 24 Nov 2026) ke halaman sendiri /dashboard/points, ditambah saldo poin
// per customer + penyesuaian manual (action adjustCustomerPoints sudah ada,
// sebelumnya UI-nya hanya di modal detail customer).
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

type CustomerRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  points: number;
};

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

  const filteredCustomers = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-8">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}

      {/* ---------- Pengaturan Poin ---------- */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-800">Poin Loyalitas Customer</h2>
        </div>
        <p className="text-sm text-gray-600">
          Customer mendapat poin dari penjualan lunas (bukan CREDIT), bukan
          customer Umum. Poin = total belanja dibagi nilai Rp per poin
          (dibulatkan ke bawah). Contoh: Rp 10.000 per poin, belanja Rp 250.000
          = 25 poin.
        </p>
        {isSuperAdmin ? (
          <form onSubmit={handleSavePoints} className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={pointsEnabled}
                onChange={(e) => setPointsEnabled(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
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
            <button type="submit" disabled={savingPoints} className="btn-primary inline-flex items-center gap-2">
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

      {/* ---------- Saldo Poin Customer ---------- */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Saldo Poin Customer</h2>
        <p className="text-sm text-gray-600">
          Saldo poin semua customer. Penyesuaian manual (tambah/kurang) hanya
          untuk SUPER_ADMIN; customer Umum tidak punya poin.
        </p>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="glass-input w-64"
          placeholder="Cari nama / kode customer…"
        />
        {loading ? (
          <p className="text-sm text-gray-500">Memuat saldo poin…</p>
        ) : filteredCustomers.length === 0 ? (
          <p className="text-sm text-gray-500">Tidak ada customer yang cocok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-2 font-medium">Customer</th>
                  <th className="py-2 pr-2 font-medium">Tipe</th>
                  <th className="py-2 pr-2 font-medium">Saldo Poin</th>
                  {isSuperAdmin && <th className="py-2 font-medium text-right">Penyesuaian Manual</th>}
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c) => {
                  const isUmum = c.type === "UMUM";
                  return (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-2 pr-2">
                        <p className="font-medium text-gray-800">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.code}</p>
                      </td>
                      <td className="py-2 pr-2 text-gray-600">{c.type}</td>
                      <td className="py-2 pr-2 font-semibold text-gray-800">
                        {isUmum ? "—" : `${c.points} poin`}
                      </td>
                      {isSuperAdmin && (
                        <td className="py-2 text-right">
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
                                  className="btn-primary !py-1 !px-2 text-xs inline-flex items-center gap-1"
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
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
