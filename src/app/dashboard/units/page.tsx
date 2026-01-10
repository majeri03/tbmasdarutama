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
  };

  const handleDeleteSuccess = (message: string) => {
    showToast(message, "success");
    fetchUnits(1); // Reset ke page 1 setelah delete
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="glass-card p-6 animate-slide-up">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gradient mb-2">
                Master Satuan
              </h1>
              <p className="text-gray-600">
                Kelola satuan produk untuk sistem inventori
              </p>
              <div className="flex items-center gap-3 mt-3">
                <div className="badge badge-info">
                  {pagination.total} Total Satuan
                </div>
                <span className="text-gray-400 text-sm">•</span>
                <span className="text-gray-600 text-sm">
                  Halaman {pagination.page} dari {pagination.totalPages || 1}
                </span>
              </div>
            </div>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-accent-blue to-accent-purple rounded-xl blur-xl opacity-50 group-hover:opacity-70 transition-all"></div>
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
              <div
                className="p-3 rounded-xl"
                style={{
                  background: "rgba(96, 165, 250, 0.15)",
                  border: "1px solid rgba(96, 165, 250, 0.3)",
                }}
              >
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-semibold mb-1">
              Total Satuan
            </h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {pagination.total}
            </p>
            <p className="text-gray-500 text-xs">Satuan terdaftar</p>
          </div>

          <div className="stat-card animate-slide-up animation-delay-200">
            <div className="flex items-start justify-between mb-4">
              <div
                className="p-3 rounded-xl"
                style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                }}
              >
                <Package className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-semibold mb-1">
              Sedang Digunakan
            </h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {units.filter((u) => u._count.productUnits > 0).length}
            </p>
            <p className="text-gray-500 text-xs">Satuan aktif</p>
          </div>

          <div className="stat-card animate-slide-up animation-delay-400">
            <div className="flex items-start justify-between mb-4">
              <div
                className="p-3 rounded-xl"
                style={{
                  background: "rgba(156, 163, 175, 0.15)",
                  border: "1px solid rgba(156, 163, 175, 0.3)",
                }}
              >
                <Package className="w-6 h-6 text-gray-600" />
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-semibold mb-1">
              Tidak Digunakan
            </h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {units.filter((u) => u._count.productUnits === 0).length}
            </p>
            <p className="text-gray-500 text-xs">Satuan tersedia</p>
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