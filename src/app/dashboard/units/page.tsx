"use client";

import { useState, useEffect } from "react";
import { Plus, Package } from "lucide-react";
import { UnitTable } from "./_components/UnitTable";
import { UnitFormModal } from "./_components/UnitFormModal";
import { DeleteUnitDialog } from "./_components/DeleteUnitDialog";
import { Toast, type ToastType } from "@/components/ui/toast";
import { getUnits } from "@/lib/actions/unit.actions";

interface Unit {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    productUnits: number;
  };
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  // WS-F item 6 — statistik GLOBAL (seluruh satuan), bukan dari baris
  // halaman / pencarian saat ini. Dulu "Sedang Digunakan" / "Tidak
  // Digunakan" dihitung dari `units` (maks. 10 baris halaman aktif),
  // jadi halaman 1 tampil "Digunakan 9 / Tidak Digunakan 1" padahal
  // globalnya 15/1. Diambil terpisah tanpa filter pencarian lewat satu
  // panggilan getUnits limit besar. Batasnya STATS_LIMIT baris (lihat
  // catatan yang sama di halaman kategori — file action satuan bukan
  // milik workstream ini, jadi belum ada agregasi server-side).
  const STATS_LIMIT = 1000;
  const [globalStats, setGlobalStats] = useState({
    used: 0,
    unused: 0,
  });

  const fetchGlobalStats = async () => {
    try {
      const result = await getUnits({ page: 1, limit: STATS_LIMIT });
      if (result.success) {
        const all = result.data as Unit[];
        setGlobalStats({
          used: all.filter((u) => u._count.productUnits > 0).length,
          unused: all.filter((u) => u._count.productUnits === 0).length,
        });
      }
    } catch {
      // Statistik gagal dimuat: kartu memakai angka 0, daftar tetap jalan.
    }
  };

  // Fetch units
  const fetchUnits = async (page = 1, searchQuery = search) => {
    setLoading(true);
    try {
      const result = await getUnits({
        search: searchQuery,
        page,
        limit: 10,
      });

      if (result.success) {
        setUnits(result.data);
        setPagination(result.pagination);
      }
    } catch {
      showToast("Gagal memuat data satuan", "error");
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchUnits();
    fetchGlobalStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toast helper
  const showToast = (message: string, type: ToastType = "success") => {
    setToast({ message, type });
  };

  const hideToast = () => {
    setToast(null);
  };

  // Handlers
  const handleSearch = (searchQuery: string) => {
    setSearch(searchQuery);
    fetchUnits(1, searchQuery);
  };

  const handlePageChange = (page: number) => {
    fetchUnits(page);
  };

  const handleAddNew = () => {
    setSelectedUnit(null);
    setShowFormModal(true);
  };

  const handleEdit = (unit: Unit) => {
    setSelectedUnit(unit);
    setShowFormModal(true);
  };

  const handleDelete = (unit: Unit) => {
    setSelectedUnit(unit);
    setShowDeleteDialog(true);
  };

  const handleFormSuccess = (message: string) => {
    showToast(message, "success");
    fetchUnits(pagination.page);
    fetchGlobalStats();
  };

  const handleDeleteSuccess = (message: string) => {
    showToast(message, "success");
    fetchUnits(1); // Reset ke page 1 setelah delete
    fetchGlobalStats();
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="glass-card p-6 animate-slide-up">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-stone-900 mb-2">
                Master Satuan
              </h1>
              <p className="text-stone-600">
                Kelola satuan produk untuk sistem inventori
              </p>
              <div className="flex items-center gap-3 mt-3">
                <div className="badge badge-info">
                  {pagination.total} Total Satuan
                </div>
                <span className="text-stone-400 text-sm">•</span>
                <span className="text-stone-600 text-sm">
                  Halaman {pagination.page} dari {pagination.totalPages || 1}
                </span>
              </div>
            </div>
            <div className="relative group">
              <button
                onClick={handleAddNew}
                className="relative btn-primary"
              >
                <Plus className="w-5 h-5" />
                <span>Tambah Satuan</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="stat-card animate-slide-up">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-stone-100 border border-stone-200">
                <Package className="w-6 h-6 text-stone-600" />
              </div>
            </div>
            <h3 className="text-stone-500 text-sm font-medium mb-1">
              Total Satuan
            </h3>
            <p className="text-3xl font-semibold tabular-nums text-stone-900 mb-1">
              {pagination.total}
            </p>
            <p className="text-stone-500 text-xs">Satuan terdaftar</p>
          </div>

          <div className="stat-card animate-slide-up animation-delay-200">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-stone-100 border border-stone-200">
                <Package className="w-6 h-6 text-stone-600" />
              </div>
            </div>
            <h3 className="text-stone-500 text-sm font-medium mb-1">
              Sedang Digunakan
            </h3>
            <p className="text-3xl font-semibold tabular-nums text-stone-900 mb-1">
              {globalStats.used}
            </p>
            <p className="text-stone-500 text-xs">Satuan aktif</p>
          </div>

          <div className="stat-card animate-slide-up animation-delay-400">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-stone-100 border border-stone-200">
                <Package className="w-6 h-6 text-stone-600" />
              </div>
            </div>
            <h3 className="text-stone-500 text-sm font-medium mb-1">
              Tidak Digunakan
            </h3>
            <p className="text-3xl font-semibold tabular-nums text-stone-900 mb-1">
              {globalStats.unused}
            </p>
            <p className="text-stone-500 text-xs">Satuan tersedia</p>
          </div>
        </div>

        {/* Table */}
        <div className="animate-slide-up animation-delay-600">
          <UnitTable
            units={units}
            pagination={pagination}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSearch={handleSearch}
            onPageChange={handlePageChange}
            loading={loading}
          />
        </div>
      </div>

      {/* Modals */}
      {showFormModal && (
        <UnitFormModal
          unit={selectedUnit || undefined}
          onClose={() => setShowFormModal(false)}
          onSuccess={handleFormSuccess}
          onError={(error) => showToast(error, "error")}
        />
      )}

      {showDeleteDialog && selectedUnit && (
        <DeleteUnitDialog
          unit={selectedUnit}
          onClose={() => setShowDeleteDialog(false)}
          onSuccess={handleDeleteSuccess}
          onError={(error) => showToast(error, "error")}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={hideToast}
        />
      )}
    </div>
  );
}