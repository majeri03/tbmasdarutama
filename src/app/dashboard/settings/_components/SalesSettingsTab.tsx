"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Users, Star, Save, Loader2, Plus, Pencil, Trash2, ShieldAlert } from "lucide-react";
import { getStoreSetting, updateStoreSetting } from "@/lib/actions/store-setting.actions";
import { toggleSalesmanStatus } from "@/lib/actions/salesman.actions";
import { useToast } from "@/components/ui/toast";
import { Toast } from "@/components/ui/toast";

// PKG-A (23 Nov 2026, perbaikan 7 item #5/#6): tab "Sales & Poin" di
// Pengaturan — KHUSUS SUPER_ADMIN (server juga menolak role lain di
// salesman.actions + updateStoreSetting/MANAGE_STORE_SETTINGS).
// Isinya: CRUD salesman + pengaturan poin loyalitas (aktif/mati dan
// Rp per poin). Salesman tercatat internal di penjualan — TIDAK PERNAH
// dicetak di invoice/struk/surat jalan.

type SalesmanRow = {
  id: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  salesCount: number;
};

export default function SalesSettingsTab() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  const [loading, setLoading] = useState(true);
  const [savingPoints, setSavingPoints] = useState(false);
  const [pointsEnabled, setPointsEnabled] = useState(true);
  const [pointsRupiahPerPoint, setPointsRupiahPerPoint] = useState("10000");

  const [salesmen, setSalesmen] = useState<SalesmanRow[]>([]);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    if (isSuperAdmin) {
      fetchSalesmen();
      fetchPointsSettings();
    }
  }, [isSuperAdmin]);

  const fetchSalesmen = async () => {
    try {
      const res = await fetch("/api/salesmen");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setSalesmen(data.data as SalesmanRow[]);
      }
    } catch {
      showToast("Gagal memuat daftar salesman", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchPointsSettings = async () => {
    const result = await getStoreSetting();
    if (result.success && result.data) {
      const s = result.data as { pointsEnabled?: boolean; pointsRupiahPerPoint?: number };
      setPointsEnabled(s.pointsEnabled ?? true);
      setPointsRupiahPerPoint(String(s.pointsRupiahPerPoint ?? 10000));
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

  const handleAddSalesman = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      showToast("Nama salesman wajib diisi", "error");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/salesmen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), phone: newPhone.trim() || null }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Salesman berhasil ditambahkan", "success");
        setNewName("");
        setNewPhone("");
        fetchSalesmen();
      } else {
        throw new Error(data.error || "Gagal menambahkan salesman");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal menambahkan salesman", "error");
    } finally {
      setAdding(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) {
      showToast("Nama salesman wajib diisi", "error");
      return;
    }
    try {
      const res = await fetch(`/api/salesmen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), phone: editPhone.trim() || null }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Salesman berhasil diperbarui", "success");
        setEditingId(null);
        fetchSalesmen();
      } else {
        throw new Error(data.error || "Gagal memperbarui salesman");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal memperbarui salesman", "error");
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      const result = await toggleSalesmanStatus(id);
      if (!result.success) throw new Error(result.error || "Gagal mengubah status salesman");
      showToast(result.message || "Status salesman diubah", "success");
      fetchSalesmen();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal mengubah status salesman", "error");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Hapus salesman "${name}"? Salesman yang sudah tercatat di penjualan tidak bisa dihapus.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/salesmen/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Salesman berhasil dihapus", "success");
        fetchSalesmen();
      } else {
        throw new Error(data.error || "Gagal menghapus salesman");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal menghapus salesman", "error");
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          Tab Sales &amp; Poin hanya untuk SUPER_ADMIN. Daftar salesman dan
          pengaturan poin hanya bisa diubah oleh pemilik toko.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}

      {/* ---------- Pengaturan Poin ---------- */}
      <form onSubmit={handleSavePoints} className="space-y-4">
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

      {/* ---------- Daftar Salesman ---------- */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-800">Salesman</h2>
        </div>
        <p className="text-sm text-gray-600">
          Salesman dipilih per transaksi di POS dan tercatat di dalam
          penjualan. Nama salesman TIDAK PERNAH dicetak di invoice, struk,
          atau surat jalan.
        </p>

        <form onSubmit={handleAddSalesman} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label label-required">Nama salesman</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="glass-input w-56"
              placeholder="Nama salesman"
              maxLength={100}
            />
          </div>
          <div>
            <label className="label">No. HP (opsional)</label>
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="glass-input w-44"
              placeholder="08xxxxxxxxxx"
              maxLength={30}
            />
          </div>
          <button type="submit" disabled={adding} className="btn-primary inline-flex items-center gap-2">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Tambah
          </button>
        </form>

        {loading ? (
          <p className="text-sm text-gray-500">Memuat daftar salesman…</p>
        ) : salesmen.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada salesman. Tambahkan salesman pertama di atas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-2 font-medium">Nama</th>
                  <th className="py-2 pr-2 font-medium">No. HP</th>
                  <th className="py-2 pr-2 font-medium">Penjualan</th>
                  <th className="py-2 pr-2 font-medium">Status</th>
                  <th className="py-2 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {salesmen.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2 pr-2 font-medium text-gray-800">
                      {editingId === s.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="glass-input w-44"
                          maxLength={100}
                        />
                      ) : (
                        s.name
                      )}
                    </td>
                    <td className="py-2 pr-2 text-gray-600">
                      {editingId === s.id ? (
                        <input
                          type="text"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="glass-input w-36"
                          maxLength={30}
                        />
                      ) : (
                        s.phone || "-"
                      )}
                    </td>
                    <td className="py-2 pr-2 text-gray-600">{s.salesCount} transaksi</td>
                    <td className="py-2 pr-2">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(s.id)}
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          s.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}
                        title="Klik untuk mengubah status"
                      >
                        {s.isActive ? "Aktif" : "Nonaktif"}
                      </button>
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {editingId === s.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(s.id)}
                            className="btn-primary !py-1 !px-3 text-xs mr-2"
                          >
                            Simpan
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="btn-secondary !py-1 !px-3 text-xs"
                          >
                            Batal
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(s.id);
                              setEditName(s.name);
                              setEditPhone(s.phone || "");
                            }}
                            className="btn-secondary !py-1 !px-3 text-xs mr-2 inline-flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" /> Ubah
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id, s.name)}
                            className="btn-secondary !py-1 !px-3 text-xs inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Hapus
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
