"use client";

import { useState, useEffect } from "react";
import { Plus, Truck, CheckCircle, XCircle, Package, ShoppingCart } from "lucide-react";
import { SupplierTable } from "./_components/SupplierTable";
import { SupplierFormModal } from "./_components/SupplierFormModal";
import { DeleteSupplierDialog } from "./_components/DeleteSupplierDialog";
import { Toast, type ToastType } from "@/components/ui/toast";
import { getSuppliers } from "@/lib/actions/supplier.actions";

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

  // Stats
  const activeSuppliers = suppliers.filter((s) => s.isActive).length;
  const inactiveSuppliers = suppliers.filter((s) => !s.isActive).length;
  const totalProducts = suppliers.reduce((sum, s) => sum + s._count.products, 0);
  const totalPurchases = suppliers.reduce((sum, s) => sum + s._count.purchases, 0);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toast helper
  const showToast = (message: string, type: ToastType = "success") => {
    setToast({ message, type });
  };

  const hideToast = () => {
    setToast(null);
  };

  // ==================== HANDLERS ====================
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
  };

  const handleDeleteSuccess = (message: string) => {
    showToast(message, "success");
    fetchSuppliers(1, search, statusFilter);
  };

  const handleStatusToggle = (message: string) => {
    showToast(message, "success");
    fetchSuppliers(pagination.page, search, statusFilter);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="glass-card p-6 animate-slide-up">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gradient mb-2">
                Master Supplier
              </h1>
              <p className="text-gray-600">
                Kelola data supplier dan pemasok produk Anda
              </p>
              <div className="flex items-center gap-3 mt-3">
                <div className="badge badge-info">
                  {pagination.total} Total Supplier
                </div>
                <span className="text-gray-400 text-sm">•</span>
                <div className="badge badge-success">
                  {activeSuppliers} Aktif
                </div>
                {inactiveSuppliers > 0 && (
                  <>
                    <span className="text-gray-400 text-sm">•</span>
                    <div className="badge badge-danger">
                      {inactiveSuppliers} Nonaktif
                    </div>
                  </>
                )}
                <span className="text-gray-400 text-sm">•</span>
                <span className="text-gray-600 text-sm">
                  Halaman {pagination.page} dari {pagination.totalPages || 1}
                </span>
              </div>
            </div>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-green-600 rounded-xl blur-xl opacity-50 group-hover:opacity-70 transition-all"></div>
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
              <div
                className="p-3 rounded-xl"
                style={{
                  background: "rgba(34, 197, 94, 0.15)",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                }}
              >
                <Truck className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-semibold mb-1">
              Total Supplier
            </h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {pagination.total}
            </p>
            <p className="text-gray-500 text-xs">Supplier terdaftar</p>
          </div>

          {/* Supplier Aktif */}
          <div className="stat-card animate-slide-up animation-delay-200">
            <div className="flex items-start justify-between mb-4">
              <div
                className="p-3 rounded-xl"
                style={{
                  background: "rgba(34, 197, 94, 0.15)",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                }}
              >
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-semibold mb-1">
              Supplier Aktif
            </h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {activeSuppliers}
            </p>
            <p className="text-gray-500 text-xs">
              {pagination.total > 0
                ? `${((activeSuppliers / pagination.total) * 100).toFixed(0)}% dari total`
                : "Belum ada data"}
            </p>
          </div>

          {/* Supplier Nonaktif */}
          <div className="stat-card animate-slide-up animation-delay-400">
            <div className="flex items-start justify-between mb-4">
              <div
                className="p-3 rounded-xl"
                style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                }}
              >
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-semibold mb-1">
              Supplier Nonaktif
            </h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {inactiveSuppliers}
            </p>
            <p className="text-gray-500 text-xs">
              {pagination.total > 0
                ? `${((inactiveSuppliers / pagination.total) * 100).toFixed(0)}% dari total`
                : "Belum ada data"}
            </p>
          </div>

          {/* Total Produk */}
          <div className="stat-card animate-slide-up animation-delay-600">
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
              Total Produk
            </h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {totalProducts}
            </p>
            <p className="text-gray-500 text-xs">Produk dari supplier</p>
          </div>
        </div>

        {/* Additional Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Total Transaksi Pembelian */}
          <div className="stat-card animate-slide-up animation-delay-800">
            <div className="flex items-center gap-4">
              <div
                className="p-4 rounded-xl"
                style={{
                  background: "rgba(167, 139, 250, 0.15)",
                  border: "1px solid rgba(167, 139, 250, 0.3)",
                }}
              >
                <ShoppingCart className="w-8 h-8 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-gray-600 text-sm font-semibold mb-1">
                  Total Transaksi Pembelian
                </h3>
                <p className="text-3xl font-bold text-gray-900">
                  {totalPurchases}
                </p>
              </div>
            </div>
          </div>

          {/* Rata-rata Produk per Supplier */}
          <div className="stat-card animate-slide-up animation-delay-1000">
            <div className="flex items-center gap-4">
              <div
                className="p-4 rounded-xl"
                style={{
                  background: "rgba(251, 146, 60, 0.15)",
                  border: "1px solid rgba(251, 146, 60, 0.3)",
                }}
              >
                <Package className="w-8 h-8 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-gray-600 text-sm font-semibold mb-1">
                  Rata-rata Produk per Supplier
                </h3>
                <p className="text-3xl font-bold text-gray-900">
                  {pagination.total > 0
                    ? (totalProducts / pagination.total).toFixed(1)
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