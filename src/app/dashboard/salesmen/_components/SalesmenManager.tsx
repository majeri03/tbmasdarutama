"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Users, Loader2, Plus, Pencil, Trash2, Eye, Percent } from "lucide-react";
import {
  toggleSalesmanStatus,
  getSalesmanFeeSetting,
  updateSalesmanFeeSetting,
} from "@/lib/actions/salesman.actions";
import { SalesmanDetailModal } from "./SalesmanDetailModal";
import { hasMinimumRole } from "@/lib/utils/role";
import { useToast } from "@/components/ui/toast";
import { Toast } from "@/components/ui/toast";

// Dipindah dari SalesSettingsTab (tab "Sales & Poin" di Pengaturan, dihapus
// 24 Nov 2026) ke halaman sendiri /dashboard/salesmen.
// Aturan akses (tidak berubah, server tetap yang memutuskan):
// - Baca daftar: KASIR+ (GET /api/salesmen + getSalesmen: requireMinimumRole KASIR).
// - Tulis (tambah/ubah/nonaktifkan/hapus): SUPER_ADMIN saja — form dan
//   tombol tulis hanya dirender untuk SUPER_ADMIN; server menolak role lain.
// Salesman tercatat internal di penjualan — TIDAK PERNAH dicetak di
// invoice/struk/surat jalan.

type SalesmanRow = {
  id: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  salesCount: number;
};

export default function SalesmenManager() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const canRead = hasMinimumRole(session, "KASIR");

  const [loading, setLoading] = useState(true);
  const [salesmen, setSalesmen] = useState<SalesmanRow[]>([]);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [detailSalesman, setDetailSalesman] = useState<SalesmanRow | null>(null);

  // Pengaturan fee global (24 Nov 2026): default MATI, persen default 2%.
  // Hanya SUPER_ADMIN yang bisa mengubah (server yang memutuskan);
  // KASIR+ hanya melihat statusnya.
  const [feeEnabled, setFeeEnabled] = useState(false);
  const [feePercent, setFeePercent] = useState(2);
  const [feePercentDraft, setFeePercentDraft] = useState("2");
  const [feeLoading, setFeeLoading] = useState(true);
  const [feeSaving, setFeeSaving] = useState(false);

  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    if (canRead) {
      fetchSalesmen();
      fetchFeeSetting();
    } else {
      setLoading(false);
      setFeeLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  const fetchFeeSetting = async () => {
    try {
      const result = await getSalesmanFeeSetting();
      if (result.success && result.data) {
        setFeeEnabled(result.data.enabled);
        setFeePercent(result.data.percent);
        setFeePercentDraft(String(result.data.percent));
      } else {
        showToast(result.error || "Gagal memuat pengaturan fee", "error");
      }
    } catch {
      showToast("Gagal memuat pengaturan fee", "error");
    } finally {
      setFeeLoading(false);
    }
  };

  const handleSaveFeeSetting = async () => {
    const percent = Number(feePercentDraft);
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
      showToast("Persen fee harus bilangan bulat 0–100", "error");
      return;
    }
    setFeeSaving(true);
    try {
      const result = await updateSalesmanFeeSetting({ enabled: feeEnabled, percent });
      if (result.success && result.data) {
        setFeeEnabled(result.data.enabled);
        setFeePercent(result.data.percent);
        setFeePercentDraft(String(result.data.percent));
        showToast(result.message || "Pengaturan fee disimpan", "success");
      } else {
        throw new Error(result.error || "Gagal menyimpan pengaturan fee");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal menyimpan pengaturan fee", "error");
    } finally {
      setFeeSaving(false);
    }
  };

  const fetchSalesmen = async () => {
    try {
      const res = await fetch("/api/salesmen");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setSalesmen(data.data as SalesmanRow[]);
      } else {
        showToast(data.error || "Gagal memuat daftar salesman", "error");
      }
    } catch {
      showToast("Gagal memuat daftar salesman", "error");
    } finally {
      setLoading(false);
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

  return (
    <div className="space-y-4">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}

      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-800">Salesman</h2>
      </div>
      <p className="text-sm text-gray-600">
        Salesman dipilih per transaksi di POS dan tercatat di dalam
        penjualan. Nama salesman TIDAK PERNAH dicetak di invoice, struk,
        atau surat jalan.
        {!isSuperAdmin && " Anda hanya bisa melihat daftar — perubahan hanya bisa dilakukan SUPER_ADMIN."}
      </p>

      {/* Pengaturan fee salesman (24 Nov 2026) */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Percent className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-800">Fee Salesman (per invoice)</h3>
        </div>
        {feeLoading ? (
          <p className="text-sm text-gray-500">Memuat pengaturan fee…</p>
        ) : isSuperAdmin ? (
          <>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={feeEnabled}
                onChange={(e) => setFeeEnabled(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              Fee salesman aktif
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="label">Persen fee (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={feePercentDraft}
                  onChange={(e) => setFeePercentDraft(e.target.value)}
                  className="glass-input w-24"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveFeeSetting}
                disabled={feeSaving}
                className="btn-primary inline-flex items-center gap-2"
              >
                {feeSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Simpan Fee
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Fee = floor(grand total × persen / 100) per invoice, hanya untuk
              penjualan yang punya salesman. Contoh: Rp57.850 × 2% = Rp1.157.
              Kalau fee dimatikan di sini, fee SEMUA invoice jadi Rp0 — apa pun
              pengaturan fee per invoice. Fee tidak pernah dicetak di invoice.
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-600">
            Fee salesman saat ini:{" "}
            <span className="font-semibold text-gray-800">
              {feeEnabled ? `AKTIF — ${feePercent}% per invoice` : "NONAKTIF — fee Rp0"}
            </span>
            . Hanya SUPER_ADMIN yang bisa mengubahnya.
          </p>
        )}
      </div>

      {isSuperAdmin && (
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
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Memuat daftar salesman…</p>
      ) : salesmen.length === 0 ? (
        <p className="text-sm text-gray-500">Belum ada salesman. {isSuperAdmin ? "Tambahkan salesman pertama di atas." : ""}</p>
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
                      <button
                        type="button"
                        onClick={() => setDetailSalesman(s)}
                        className="text-blue-600 hover:underline text-left"
                        title="Klik untuk melihat detail penjualan & fee"
                      >
                        {s.name}
                      </button>
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
                    {isSuperAdmin ? (
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
                    ) : (
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          s.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {s.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    )}
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
                          onClick={() => setDetailSalesman(s)}
                          className="btn-secondary !py-1 !px-3 text-xs mr-2 inline-flex items-center gap-1"
                          title="Lihat detail penjualan & fee salesman ini"
                        >
                          <Eye className="w-3 h-3" /> Detail
                        </button>
                        {isSuperAdmin && (
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
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SalesmanDetailModal
        salesman={detailSalesman}
        isOpen={detailSalesman !== null}
        onClose={() => setDetailSalesman(null)}
      />
    </div>
  );
}
