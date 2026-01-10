"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  Eye,
  Trash2,
  Calendar,
  Package,
  TrendingUp,
  TrendingDown,
  Edit,
  X,
  RotateCcw,
} from "lucide-react";
import { MovementType } from "@prisma/client";

interface StockMovement {
  id: string;
  productId: string;
  type: MovementType;
  quantity: number;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdAt: Date;
  product: {
    id: string;
    code: string;
    name: string;
    barcode: string | null;
    currentStock: number;
  };
}

interface StockTableProps {
  movements: StockMovement[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onView: (movement: StockMovement) => void;
  onDelete: (movement: StockMovement) => void;
  onRefresh: (filters: {
    search?: string;
    page?: number;
    movementType?: MovementType;
  }) => void;
}

export function StockTable({
  movements,
  currentPage,
  totalPages,
  onPageChange,
  onView,
  onDelete,
  onRefresh,
}: StockTableProps) {
  const [search, setSearch] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState<MovementType | "">("");
  const [isClient, setIsClient] = useState(false);

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with URL params on client mount
  useEffect(() => {
    // Mark as client-side (deferred to avoid cascading renders)
    setTimeout(() => setIsClient(true), 0);
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlSearch = urlParams.get("search") || "";
      const urlType = (urlParams.get("type") as MovementType | "") || "";

      setTimeout(() => {
        setSearch(urlSearch);
        setMovementTypeFilter(urlType);
      }, 0);
    }
  }, []);  

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  // Handle search with debounce
  const handleSearch = (value: string) => {
    setSearch(value);

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current = setTimeout(() => {
      onRefresh({
        search: value || undefined,
        page: 1,
        movementType: movementTypeFilter ? (movementTypeFilter as MovementType) : undefined,
      });
    }, 800);
  };

  // Handle type filter
  const handleTypeFilter = (value: string) => {
    const newType = value as MovementType | "";
    setMovementTypeFilter(newType);
    onRefresh({
      search: search || undefined,
      page: 1,
      movementType: newType ? (newType as MovementType) : undefined,
    });
  };

  // Handle reset filters
  const handleResetFilters = () => {
    setSearch("");
    setMovementTypeFilter("");
    onRefresh({ page: 1 });
  };

  const hasActiveFilters = search !== "" || movementTypeFilter !== "";

  const getMovementTypeBadge = (type: MovementType) => {
    switch (type) {
      case MovementType.IN:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            <TrendingUp className="w-3 h-3" />
            Masuk
          </span>
        );
      case MovementType.OUT:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <TrendingDown className="w-3 h-3" />
            Keluar
          </span>
        );
      case MovementType.ADJUSTMENT:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Edit className="w-3 h-3" />
            Adjustment
          </span>
        );
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  return (
    <div className="space-y-6">
      {/* Search & Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Cari produk (nama, kode, barcode)..."
              className="glass-input pl-10"
            />
            {isClient && search && (
              <button
                onClick={() => handleSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Movement Type Filter */}
          <select
            value={movementTypeFilter}
            onChange={(e) => handleTypeFilter(e.target.value)}
            className="glass-input md:w-48"
          >
            <option value="">Semua Tipe</option>
            <option value={MovementType.IN}>Masuk</option>
            <option value={MovementType.OUT}>Keluar</option>
            <option value={MovementType.ADJUSTMENT}>Adjustment</option>
          </select>
        </div>

        {/* Reset Filter Button */}
        {isClient && hasActiveFilters && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Filter
            </button>
            <span className="text-sm text-gray-600">
              {movements.length} hasil ditemukan
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Produk
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Tipe
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Referensi
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="w-12 h-12 text-gray-300" />
                      <p className="text-sm text-gray-500">
                        {hasActiveFilters
                          ? "Tidak ada pergerakan stock yang sesuai dengan filter"
                          : "Belum ada pergerakan stock"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                movements.map((movement) => (
                  <tr
                    key={movement.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* Product */}
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {movement.product.name}
                        </div>
                        <div className="text-sm text-gray-500 font-mono">
                          {movement.product.code}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            Stock saat ini:
                          </span>
                          <span className="text-xs font-semibold text-blue-600">
                            {movement.product.currentStock} unit
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getMovementTypeBadge(movement.type)}
                    </td>

                    {/* Quantity */}
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 font-bold text-lg ${
                          movement.type === MovementType.IN
                            ? "text-green-600"
                            : movement.type === MovementType.OUT
                            ? "text-red-600"
                            : "text-blue-600"
                        }`}
                      >
                        {movement.type === MovementType.IN && "+"}
                        {movement.type === MovementType.OUT && "-"}
                        {movement.quantity}
                      </span>
                    </td>

                    {/* Reference */}
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {movement.referenceType}
                        </div>
                        {movement.referenceId && (
                          <div className="text-xs text-gray-500 font-mono">
                            {movement.referenceId}
                          </div>
                        )}
                        {movement.notes && (
                          <div className="text-xs text-gray-600 mt-1 italic">
                            {movement.notes}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(movement.createdAt)}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onView(movement)}
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                          title="Lihat Detail"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(movement)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Halaman {currentPage} dari {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}