"use client";

import { useState, useEffect } from "react";
import { Plus, Truck, CheckCircle, XCircle, Package, ShoppingCart } from "lucide-react";
import { SupplierTable } from "./_components/SupplierTable";
import { SupplierFormModal } from "./_components/SupplierFormModal";
import { DeleteSupplierDialog } from "./_components/DeleteSupplierDialog";
import { Toast, type ToastType } from "@/components/ui/toast";
import { getSuppliers, getSupplierStatistics } from "@/lib/actions/supplier.actions";

interface Supplier {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    products: number;
    purchases: number;
  };
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  // WS-F item 6 — statistik GLOBAL (seluruh supplier), bukan dari baris
  // halaman / filter saat ini. Dulu angka-angka ini dihitung dari `suppliers`
  // (maks. 10 baris halaman aktif), jadi pindah halaman / memfilter mengubah
  // kartu statistik. Diambil terpisah dari daftar lewat
  // getSupplierStatistics dan di-refresh tiap ada perubahan data.
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    totalProducts: 0,
    totalPurchases: 0,
  });

  const fetchGlobalStats = async () => {
    try {
      const result = await getSupplierStatistics();
      if (result.success) {
        setStats(result.data);
      }
    } catch {
      // Statistik gagal dimuat: kartu memakai angka 0, daftar tetap jalan.
    }
  };

  // Fetch suppliers
  const fetchSuppliers = async (
    page = 1,
    searchQuery = search,
    statusQuery = statusFilter
  ) => {
    setLoading(true);
    try {
      const result = await getSuppliers({
        search: searchQuery,
        page,
        limit: 10,
        isActive: statusQuery,
      });

      if (result.success) {
        setSuppliers(result.data);
        setPagination(result.pagination);
      }
    } catch {
      showToast("Gagal memuat data supplier", "error");
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchSuppliers();
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

  const handleSearch = (searchQuery: string) => {
    setSearch(searchQuery);
    fetchSuppliers(1, searchQuery, statusFilter);
  };

  const handleFilterStatus = (status: boolean | null) => {
    setStatusFilter(status);
    fetchSuppliers(1, search, status);
  };

  const handlePageChange = (page: number) => {
    fetchSuppliers(page, search, statusFilter);
  };

  const handleAdd = () => {
    setSelectedSupplier(null);
    setShowFormModal(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowFormModal(true);
  };

  const handleDelete = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowDeleteDialog(true);
  };

  const handleFormSuccess = (message: string) => {
    showToast(message, "success");
    fetchSuppliers(pagination.page, search, statusFilter);
    fetchGlobalStats();
  };

  const handleDeleteSuccess = (message: string) => {
    showToast(message, "success");
    fetchSuppliers(1, search, statusFilter);
    fetchGlobalStats();
  };

  const handleStatusToggle = (message: string) => {
    showToast(message, "success");
    fetchSuppliers(pagination.page, search, statusFilter);
    fetchGlobalStats();
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="glass-card p-6 animate-slide-up">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-stone-100 mb-2">
                Master Supplier
              </h1>
              <p className="text-stone-400">
                Kelola data supplier dan pemasok produk Anda
              </p>
              <div className="flex items-center gap-3 mt-3">
                <div className="badge badge-info">
                  {stats.total} Total Supplier
                </div>
                <span className="text-stone-400 text-sm">•</span>
                <div className="badge badge-success">
                  {stats.active} Aktif
                </div>
                {stats.inactive > 0 && (
                  <>
                    <span className="text-stone-400 text-sm">•</span>
                    <div className="badge badge-danger">
                      {stats.inactive} Nonaktif
                    </div>
                  </>
                )}
                <span className="text-stone-400 text-sm">•</span>
                <span className="text-stone-400 text-sm">
                  Halaman {pagination.page} dari {pagination.totalPages || 1}
                </span>
              </div>
            </div>
            <div className="relative group">
              <button onClick={handleAdd} className="relative btn-primary">
                <Plus className="w-5 h-5" />
                <span>Tambah Supplier</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Total Supplier */}
          <div className="stat-card animate-slide-up">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                <Truck className="w-6 h-6 text-stone-400" />
              </div>
            </div>
            <h3 className="text-stone-400 text-sm font-medium mb-1">
              Total Supplier
            </h3>
            <p className="text-3xl font-semibold tabular-nums text-stone-100 mb-1">
              {stats.total}
            </p>
            <p className="text-stone-400 text-xs">Supplier terdaftar</p>
          </div>

          {/* Supplier Aktif */}
          <div className="stat-card animate-slide-up animation-delay-200">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                <CheckCircle className="w-6 h-6 text-stone-400" />
              </div>
            </div>
            <h3 className="text-stone-400 text-sm font-medium mb-1">
              Supplier Aktif
            </h3>
            <p className="text-3xl font-semibold tabular-nums text-stone-100 mb-1">
              {stats.active}
            </p>
            <p className="text-stone-400 text-xs">
              {stats.total > 0
                ? `${((stats.active / stats.total) * 100).toFixed(0)}% dari total`
                : "Belum ada data"}
            </p>
          </div>

          {/* Supplier Nonaktif */}
          <div className="stat-card animate-slide-up animation-delay-400">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                <XCircle className="w-6 h-6 text-red-300" />
              </div>
            </div>
            <h3 className="text-stone-400 text-sm font-medium mb-1">
              Supplier Nonaktif
            </h3>
            <p className="text-3xl font-semibold tabular-nums text-stone-100 mb-1">
              {stats.inactive}
            </p>
            <p className="text-stone-400 text-xs">
              {stats.total > 0
                ? `${((stats.inactive / stats.total) * 100).toFixed(0)}% dari total`
                : "Belum ada data"}
            </p>
          </div>

          {/* Total Produk */}
          <div className="stat-card animate-slide-up animation-delay-600">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-white/10 border border-white/10">
                <Package className="w-6 h-6 text-stone-400" />
              </div>
            </div>
            <h3 className="text-stone-400 text-sm font-medium mb-1">
              Total Produk
            </h3>
            <p className="text-3xl font-semibold tabular-nums text-stone-100 mb-1">
              {stats.totalProducts}
            </p>
            <p className="text-stone-400 text-xs">Produk dari supplier</p>
          </div>
        </div>

        {/* Additional Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Total Transaksi Pembelian */}
          <div className="stat-card animate-slide-up animation-delay-800">
            <div className="flex items-center gap-4">
              <div
                className="p-4 rounded-xl bg-white/10 border border-white/10"
              >
                <ShoppingCart className="w-8 h-8 text-stone-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-stone-400 text-sm font-medium mb-1">
                  Total Transaksi Pembelian
                </h3>
                <p className="text-3xl font-bold text-stone-100">
                  {stats.totalPurchases}
                </p>
              </div>
            </div>
          </div>

          {/* Rata-rata Produk per Supplier */}
          <div className="stat-card animate-slide-up animation-delay-1000">
            <div className="flex items-center gap-4">
              <div
                className="p-4 rounded-xl bg-white/10 border border-white/10"
              >
                <Package className="w-8 h-8 text-stone-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-stone-400 text-sm font-medium mb-1">
                  Rata-rata Produk per Supplier
                </h3>
                <p className="text-3xl font-bold text-stone-100">
                  {stats.total > 0
                    ? (stats.totalProducts / stats.total).toFixed(1)
                    : "0"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="animate-slide-up animation-delay-1200">
          <SupplierTable
            suppliers={suppliers}
            pagination={pagination}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSearch={handleSearch}
            onPageChange={handlePageChange}
            onFilterStatus={handleFilterStatus}
            activeFilter={statusFilter}
            loading={loading}
            onStatusToggle={handleStatusToggle}
            onError={(error) => showToast(error, "error")}
          />
        </div>
      </div>

      {/* ==================== MODALS ==================== */}
      {showFormModal && (
        <SupplierFormModal
          supplier={selectedSupplier || undefined}
          onClose={() => setShowFormModal(false)}
          onSuccess={handleFormSuccess}
          onError={(error) => showToast(error, "error")}
        />
      )}

      {showDeleteDialog && selectedSupplier && (
        <DeleteSupplierDialog
          supplier={selectedSupplier}
          onClose={() => setShowDeleteDialog(false)}
          onSuccess={handleDeleteSuccess}
          onError={(error) => showToast(error, "error")}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}
    </div>
  );
}