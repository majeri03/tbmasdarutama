"use client";

import { useState } from "react";
import { Search, Edit, Trash2, Truck, Calendar, Loader2, Package, ShoppingCart, Phone, Mail, MapPin, Power } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { SupplierStatusBadge } from "./SupplierStatusBadge";
import { toggleSupplierStatus } from "@/lib/actions/supplier.actions";

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

interface SupplierTableProps {
  suppliers: Supplier[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
  onSearch: (search: string) => void;
  onPageChange: (page: number) => void;
  onFilterStatus: (status: boolean | null) => void;
  activeFilter: boolean | null;
  loading?: boolean;
  onStatusToggle: (message: string) => void;
  onError: (error: string) => void;
}

export function SupplierTable({
  suppliers,
  pagination,
  onEdit,
  onDelete,
  onSearch,
  onPageChange,
  onFilterStatus,
  activeFilter,
  loading = false,
  onStatusToggle,
  onError,
}: SupplierTableProps) {
  const [searchInput, setSearchInput] = useState("");
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchInput);
  };

  const handleSearchClear = () => {
    setSearchInput("");
    onSearch("");
  };

  const handleToggleStatus = async (supplier: Supplier) => {
    setTogglingStatus(supplier.id);
    try {
      const result = await toggleSupplierStatus(supplier.id);
      if (result.success) {
        onStatusToggle(result.message!);
      } else {
        onError(result.error!);
      }
    } catch {
      onError("Gagal mengubah status supplier");
    } finally {
      setTogglingStatus(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="glass-card p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cari kode, nama, telepon, email, atau kota..."
                className="glass-input pl-12"
                disabled={loading}
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleSearchClear}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <span className="text-lg">×</span>
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary px-6"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  <span className="hidden sm:inline">Cari</span>
                </>
              )}
            </button>
          </form>

          {/* Filter Status */}
          <div className="flex gap-2">
            <button
              onClick={() => onFilterStatus(null)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                activeFilter === null
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-white/50 text-gray-700 hover:bg-white/80"
              }`}
              disabled={loading}
            >
              Semua
            </button>
            <button
              onClick={() => onFilterStatus(true)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                activeFilter === true
                  ? "bg-green-600 text-white shadow-lg"
                  : "bg-white/50 text-gray-700 hover:bg-white/80"
              }`}
              disabled={loading}
            >
              Aktif
            </button>
            <button
              onClick={() => onFilterStatus(false)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                activeFilter === false
                  ? "bg-red-600 text-white shadow-lg"
                  : "bg-white/50 text-gray-700 hover:bg-white/80"
              }`}
              disabled={loading}
            >
              Nonaktif
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          // Loading State
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">Memuat data supplier...</p>
          </div>
        ) : suppliers.length === 0 ? (
          // Empty State
          <div className="p-12 text-center">
            <div
              className="inline-flex p-4 rounded-2xl mb-4"
              style={{
                background: "rgba(34, 197, 94, 0.1)",
                border: "1px solid rgba(34, 197, 94, 0.2)",
              }}
            >
              <Truck className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Belum Ada Data Supplier
            </h3>
            <p className="text-gray-600 text-sm">
              {searchInput
                ? `Tidak ada hasil untuk "${searchInput}"`
                : "Tambahkan supplier pertama Anda"}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden xl:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-4 text-sm font-semibold text-gray-700">
                      Kode
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-700">
                      Nama Supplier
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-700">
                      Kontak
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-700">
                      Lokasi
                    </th>
                    <th className="text-center p-4 text-sm font-semibold text-gray-700">
                      Produk
                    </th>
                    <th className="text-center p-4 text-sm font-semibold text-gray-700">
                      Transaksi
                    </th>
                    <th className="text-center p-4 text-sm font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="text-right p-4 text-sm font-semibold text-gray-700">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((supplier, index) => (
                    <tr
                      key={supplier.id}
                      className={`border-b border-gray-100 hover:bg-green-50/30 transition-colors ${
                        index % 2 === 0 ? "bg-white/20" : ""
                      }`}
                    >
                      <td className="p-4">
                        <span className="font-mono text-sm font-semibold text-gray-900">
                          {supplier.code}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="p-2 rounded-lg"
                            style={{
                              background: "rgba(34, 197, 94, 0.1)",
                              border: "1px solid rgba(34, 197, 94, 0.2)",
                            }}
                          >
                            <Truck className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {supplier.name}
                            </p>
                            {supplier.description && (
                              <p className="text-xs text-gray-600 line-clamp-1">
                                {supplier.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          {supplier.phone && (
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <Phone className="w-3.5 h-3.5 text-gray-400" />
                              <span>{supplier.phone}</span>
                            </div>
                          )}
                          {supplier.email && (
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <Mail className="w-3.5 h-3.5 text-gray-400" />
                              <span>{supplier.email}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {supplier.city || supplier.province ? (
                          <div className="flex items-start gap-2 text-sm text-gray-700">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div>
                              {supplier.city && <p>{supplier.city}</p>}
                              {supplier.province && (
                                <p className="text-xs text-gray-600">{supplier.province}</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            supplier._count.products > 0
                              ? "bg-blue-100 text-blue-700 border border-blue-200"
                              : "bg-gray-100 text-gray-600 border border-gray-200"
                          }`}
                        >
                          <Package className="w-3 h-3" />
                          {supplier._count.products}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            supplier._count.purchases > 0
                              ? "bg-purple-100 text-purple-700 border border-purple-200"
                              : "bg-gray-100 text-gray-600 border border-gray-200"
                          }`}
                        >
                          <ShoppingCart className="w-3 h-3" />
                          {supplier._count.purchases}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <SupplierStatusBadge isActive={supplier.isActive} size="sm" />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleStatus(supplier)}
                            disabled={togglingStatus === supplier.id}
                            className={`p-2 rounded-lg transition-colors group ${
                              supplier.isActive
                                ? "hover:bg-red-100"
                                : "hover:bg-green-100"
                            }`}
                            title={supplier.isActive ? "Nonaktifkan" : "Aktifkan"}
                          >
                            {togglingStatus === supplier.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                            ) : (
                              <Power
                                className={`w-4 h-4 group-hover:scale-110 transition-transform ${
                                  supplier.isActive ? "text-red-600" : "text-green-600"
                                }`}
                              />
                            )}
                          </button>
                          <button
                            onClick={() => onEdit(supplier)}
                            className="p-2 rounded-lg hover:bg-blue-100 transition-colors group"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                          </button>
                          <button
                            onClick={() => onDelete(supplier)}
                            className="p-2 rounded-lg hover:bg-red-100 transition-colors group"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4 text-red-600 group-hover:scale-110 transition-transform" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="xl:hidden space-y-3 p-4">
              {suppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="glass-card p-4 space-y-3 hover:bg-white/60 transition-colors"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="p-2 rounded-lg flex-shrink-0"
                        style={{
                          background: "rgba(34, 197, 94, 0.1)",
                          border: "1px solid rgba(34, 197, 94, 0.2)",
                        }}
                      >
                        <Truck className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-gray-900 truncate">
                          {supplier.name}
                        </h4>
                        <p className="text-xs font-mono text-gray-600 mt-0.5">
                          {supplier.code}
                        </p>
                      </div>
                    </div>
                    <SupplierStatusBadge isActive={supplier.isActive} size="sm" />
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1.5 text-sm">
                    {supplier.phone && (
                      <div className="flex items-center gap-2 text-gray-700">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span>{supplier.phone}</span>
                      </div>
                    )}
                    {supplier.email && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        <span className="truncate">{supplier.email}</span>
                      </div>
                    )}
                    {(supplier.city || supplier.province) && (
                      <div className="flex items-start gap-2 text-gray-700">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <span>
                          {supplier.city}
                          {supplier.city && supplier.province && ", "}
                          {supplier.province}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {supplier._count.products} Produk
                    </span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                      <ShoppingCart className="w-3 h-3" />
                      {supplier._count.purchases} Transaksi
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {format(new Date(supplier.createdAt), "dd MMM yyyy", {
                          locale: id,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleStatus(supplier)}
                        disabled={togglingStatus === supplier.id}
                        className={`p-2 rounded-lg transition-colors ${
                          supplier.isActive ? "hover:bg-red-100" : "hover:bg-green-100"
                        }`}
                      >
                        {togglingStatus === supplier.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                        ) : (
                          <Power
                            className={`w-4 h-4 ${
                              supplier.isActive ? "text-red-600" : "text-green-600"
                            }`}
                          />
                        )}
                      </button>
                      <button
                        onClick={() => onEdit(supplier)}
                        className="p-2 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Edit className="w-4 h-4 text-blue-600" />
                      </button>
                      <button
                        onClick={() => onDelete(supplier)}
                        className="p-2 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {!loading && suppliers.length > 0 && pagination.totalPages > 1 && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Menampilkan {(pagination.page - 1) * pagination.limit + 1} -{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} dari{" "}
              {pagination.total} supplier
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-100"
              >
                Prev
              </button>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  const current = pagination.page;
                  return (
                    page === 1 ||
                    page === pagination.totalPages ||
                    (page >= current - 1 && page <= current + 1)
                  );
                })
                .map((page, index, array) => (
                  <div key={page} className="flex items-center gap-2">
                    {index > 0 && array[index - 1] !== page - 1 && (
                      <span className="text-gray-400">...</span>
                    )}
                    <button
                      onClick={() => onPageChange(page)}
                      className={`w-10 h-10 rounded-lg font-semibold text-sm transition-all ${
                        pagination.page === page
                          ? "bg-green-600 text-white shadow-lg"
                          : "hover:bg-green-100 text-gray-700"
                      }`}
                    >
                      {page}
                    </button>
                  </div>
                ))}
              <button
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-100"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}