"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  HardDrive,
  Trash2,
  RefreshCw,
  Database,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Search,
  X,
} from "lucide-react";
import {
  deleteR2FileAction,
  deleteOrphanR2Files,
  listR2Files,
  runBackfill,
} from "@/lib/actions/storage.actions";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Aktif",
  PENDING: "Menunggu",
  ORPHANED: "Yatim",
  DELETED: "Terhapus",
  DELETE_FAILED: "Gagal hapus",
};

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  ORPHANED: "bg-red-100 text-red-700",
  DELETED: "bg-gray-100 text-gray-500",
  DELETE_FAILED: "bg-orange-100 text-orange-700",
};

interface Props {
  overview: any;
  files: any[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: { status: string; folder: string; search: string };
}

export function StorageClient({ overview, files, pagination, filters }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [reconcileText, setReconcileText] = useState("");
  const [reconcileResult, setReconcileResult] = useState<any>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [searchText, setSearchText] = useState(filters.search);

  const showNotice = (type: "success" | "error", text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 6000);
  };

  const applyFilters = (next: Partial<typeof filters> & { page?: number }) => {
    const q = new URLSearchParams();
    const s = { ...filters, ...next };
    if (s.status) q.set("status", s.status);
    if (s.folder) q.set("folder", s.folder);
    if (s.search) q.set("search", s.search);
    if (next.page && next.page > 1) q.set("page", String(next.page));
    router.push(`/dashboard/storage?${q.toString()}`);
  };

  const handleBackfill = async () => {
    setBusy("backfill");
    try {
      const res = await runBackfill();
      if (res.success) {
        showNotice("success", res.message || "Backfill selesai.");
        router.refresh();
      } else {
        showNotice("error", res.error || "Backfill gagal.");
      }
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteOne = async (r2Key: string, force = false) => {
    setBusy(`del-${r2Key}`);
    try {
      const res = await deleteR2FileAction(r2Key, force);
      if (res.success) {
        showNotice("success", res.message || "File dihapus.");
        setConfirmDeleteKey(null);
        router.refresh();
      } else {
        showNotice("error", res.error || "Gagal menghapus file.");
      }
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteAllOrphans = async () => {
    setBusy("orphans");
    try {
      // Ambil semua key yatim (maks 100 per halaman; ulangi sampai habis).
      const allKeys: string[] = [];
      let page = 1;
      for (;;) {
        const res: any = await listR2Files({ status: "ORPHANED", page, limit: 100 });
        if (!res.success) break;
        allKeys.push(...res.data.map((r: any) => r.r2Key));
        if (page >= res.pagination.totalPages) break;
        page++;
      }
      if (allKeys.length === 0) {
        showNotice("success", "Tidak ada file yatim.");
        return;
      }
      const res = await deleteOrphanR2Files(allKeys);
      if (res.success) {
        showNotice("success", res.message || "File yatim dihapus.");
        router.refresh();
      } else {
        showNotice("error", res.error || "Gagal menghapus file yatim.");
      }
    } finally {
      setBusy(null);
    }
  };

  const handleReconcile = async () => {
    const lines = reconcileText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      showNotice("error", "Tempel dulu daftar key R2 (satu key per baris).");
      return;
    }
    setBusy("reconcile");
    setReconcileResult(null);
    try {
      const keys = lines.map((line) => {
        const [key, size] = line.split(",").map((s) => s.trim());
        return { key, sizeBytes: size ? Number(size) || 0 : 0 };
      });
      const res = await fetch("/api/storage/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys }),
      });
      const data = await res.json();
      if (!data.success) {
        showNotice("error", data.error || "Rekonsiliasi gagal.");
        return;
      }
      setReconcileResult(data.data);
      showNotice("success", data.message || "Rekonsiliasi selesai.");
      router.refresh();
    } catch {
      showNotice("error", "Gagal menjalankan rekonsiliasi.");
    } finally {
      setBusy(null);
    }
  };

  const usedPercent = overview.usedPercent ?? 0;
  const usedMB = (overview.usedBytes / 1024 / 1024).toFixed(2);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <HardDrive className="w-6 h-6 text-[#7F1D1D]" />
            Penyimpanan Gambar
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            File gambar di Cloudflare R2 — kuota gratis 10 GB. Angka di sini ukuran asli dari database pelacakan, bukan tebakan.
          </p>
        </div>
        <button
          onClick={handleBackfill}
          disabled={busy === "backfill"}
          className="btn-secondary inline-flex items-center gap-2"
          title="Isi tabel pelacakan dari file-file lama (foto DO, bukti transfer, gambar produk, hero, logo)"
        >
          {busy === "backfill" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          Isi data lama (backfill)
        </button>
      </div>

      {notice && (
        <div
          className={`flex items-start gap-2 p-3 rounded-lg border ${
            notice.type === "success"
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-600"
          }`}
        >
          {notice.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          )}
          <p className="text-sm flex-1">{notice.text}</p>
          <button onClick={() => setNotice(null)} className="hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Kuota */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex flex-wrap justify-between gap-2">
          <div>
            <p className="text-sm text-gray-500">Terpakai (file aktif)</p>
            <p className="text-2xl font-bold text-gray-900">
              {usedMB} MB <span className="text-sm font-normal text-gray-500">dari 10 GB ({usedPercent}%)</span>
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="text-gray-500">
              File aktif: <span className="font-semibold text-gray-900">{overview.activeCount}</span>
            </p>
            <p className="text-gray-500">
              Yatim:{" "}
              <span className="font-semibold text-red-600">
                {overview.orphans.count} file ({formatBytes(overview.orphans.sizeBytes)})
              </span>
            </p>
            <p className="text-gray-500">
              Menunggu konfirmasi: {overview.pending.count} file ({formatBytes(overview.pending.sizeBytes)})
            </p>
            {overview.deleteFailed.count > 0 && (
              <p className="text-gray-500">
                Gagal hapus:{" "}
                <span className="font-semibold text-orange-600">{overview.deleteFailed.count} file</span>
              </p>
            )}
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-3 rounded-full ${usedPercent > 80 ? "bg-red-500" : usedPercent > 50 ? "bg-yellow-500" : "bg-[#7F1D1D]"}`}
            style={{ width: `${Math.min(100, usedPercent)}%` }}
          />
        </div>
        {overview.orphans.count > 0 && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              Ada {overview.orphans.count} file yatim ({formatBytes(overview.orphans.sizeBytes)}) yang tidak dipakai
              entitas apa pun.
            </p>
            <button
              onClick={handleDeleteAllOrphans}
              disabled={busy === "orphans"}
              className="btn-danger inline-flex items-center gap-2"
            >
              {busy === "orphans" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Hapus semua yatim
            </button>
          </div>
        )}
      </div>

      {/* Per folder */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Per folder</h2>
        {overview.byFolder.length === 0 ? (
          <p className="text-sm text-gray-500">
            Belum ada file tercatat. Jalankan backfill di atas supaya file-file lama ikut tercatat.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {overview.byFolder.map((f: any) => (
              <button
                key={f.folder}
                onClick={() => applyFilters({ folder: f.folder, page: 1 })}
                className="text-left p-3 rounded-lg border border-gray-200 hover:border-[#7F1D1D]/40 transition-colors"
              >
                <p className="font-mono text-sm font-semibold text-gray-900 truncate">{f.folder}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {f.count} file • {formatBytes(f.sizeBytes)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Rekonsiliasi */}
      <div className="glass-card p-5 space-y-3">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-[#7F1D1D]" />
          Rekonsiliasi dengan isi R2
        </h2>
        <p className="text-sm text-gray-600">
          Aplikasi tidak bisa membaca isi bucket R2 langsung (tidak ada kredensial listing di server). Export daftar
          objek dari dashboard Cloudflare (R2 → bucket → Objects) atau jalankan{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">wrangler r2 object list &lt;nama-bucket&gt;</code>, lalu
          tempel key-nya di bawah ini — satu key per baris (boleh tambah ukuran setelah koma:{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">proofs_delivery/123.jpg,45200</code>).
        </p>
        <textarea
          value={reconcileText}
          onChange={(e) => setReconcileText(e.target.value)}
          rows={4}
          placeholder={"proofs_delivery/1699999999-abc.jpg\nproducts/1699999999-def.jpg"}
          className="w-full p-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#7F1D1D]"
        />
        <div>
          <button
            onClick={handleReconcile}
            disabled={busy === "reconcile"}
            className="btn-primary inline-flex items-center gap-2"
          >
            {busy === "reconcile" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Bandingkan dengan database
          </button>
        </div>
        {reconcileResult && (
          <div className="p-3 rounded-lg bg-[#7F1D1D]/[0.06] border border-[#7F1D1D]/20 text-sm space-y-1">
            <p>
              Total di R2: <b>{reconcileResult.totalInR2}</b> • Tercatat di DB: <b>{reconcileResult.totalInDb}</b> •
              Cocok: <b>{reconcileResult.matched}</b>
            </p>
            <p className="text-red-600">
              Yatim (di R2 tapi tidak dikenal DB): <b>{reconcileResult.inR2NotInDb.length}</b> — sudah dicatat supaya
              bisa dihapus dari daftar di bawah (filter status Yatim).
            </p>
            <p className="text-orange-600">
              Hilang (tercatat di DB tapi tidak ada di R2): <b>{reconcileResult.inDbNotInR2.length}</b>
            </p>
          </div>
        )}
      </div>

      {/* Filter + daftar file */}
      <div className="glass-card p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Daftar file</h2>
        <div className="flex flex-wrap gap-2">
          <select
            value={filters.status}
            onChange={(e) => applyFilters({ status: e.target.value, page: 1 })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Semua status</option>
            {Object.keys(STATUS_LABEL).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            value={filters.folder}
            onChange={(e) => applyFilters({ folder: e.target.value, page: 1 })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Semua folder</option>
            {["products", "proofs_delivery", "proofs_payment", "heroes", "logos"].map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilters({ search: searchText, page: 1 });
              }}
              onBlur={() => {
                if (searchText !== filters.search) applyFilters({ search: searchText, page: 1 });
              }}
              placeholder="Cari key / ID pemilik... (Enter untuk mencari)"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7F1D1D]"
            />
          </div>
        </div>

        {files.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            Tidak ada file untuk filter ini. Jalankan backfill kalau file lama belum tercatat.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-2">File</th>
                  <th className="py-2 pr-2">Folder / Pemilik</th>
                  <th className="py-2 pr-2">Ukuran</th>
                  <th className="py-2 pr-2">Tanggal</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {files.map((f: any) => (
                  <tr key={f.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <div className="relative w-10 h-10 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                          <Image src={f.url} alt={f.r2Key} fill className="object-cover" sizes="40px" />
                        </div>
                        <span className="font-mono text-xs break-all">{f.r2Key}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <p className="font-mono text-xs">{f.folder}</p>
                      <p className="text-xs text-gray-500">
                        {f.ownerType} {f.ownerId ? `• ${String(f.ownerId).slice(0, 8)}…` : "• tanpa pemilik"}
                      </p>
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap">{formatBytes(f.sizeBytes)}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">{formatDate(f.createdAt)}</td>
                    <td className="py-2 pr-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[f.status] || ""}`}>
                        {STATUS_LABEL[f.status] || f.status}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {f.status !== "DELETED" && (
                        <button
                          onClick={() => setConfirmDeleteKey(f.r2Key)}
                          disabled={busy === `del-${f.r2Key}`}
                          className="btn-icon-danger"
                          title="Hapus file dari R2"
                        >
                          {busy === `del-${f.r2Key}` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-500">
              Halaman {pagination.page} dari {pagination.totalPages} ({pagination.total} file)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => applyFilters({ page: pagination.page - 1 })}
                disabled={pagination.page <= 1}
                className="btn-secondary disabled:opacity-50"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => applyFilters({ page: pagination.page + 1 })}
                disabled={pagination.page >= pagination.totalPages}
                className="btn-secondary disabled:opacity-50"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal konfirmasi hapus */}
      {confirmDeleteKey && (
        <div className="modal-overlay">
          <div className="modal-container max-w-md">
            <div className="modal-header">
              <h3 className="text-lg font-semibold text-gray-800">Hapus File</h3>
              <button onClick={() => setConfirmDeleteKey(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body">
              <p className="text-gray-600 text-sm break-all">
                Hapus <span className="font-mono">{confirmDeleteKey}</span> dari Cloudflare R2? File yang sudah
                terhapus tidak bisa dikembalikan.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setConfirmDeleteKey(null)} className="btn-secondary">
                Batal
              </button>
              <button
                onClick={() => handleDeleteOne(confirmDeleteKey)}
                className="btn-danger inline-flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
