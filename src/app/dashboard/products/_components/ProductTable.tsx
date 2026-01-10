"use client";

import { useEffect, useState } from "react";
import { Search, Filter, Edit2, Trash2, Eye, Power, ChevronLeft, ChevronRight } from "lucide-react";
import { ProductStockBadge } from "./ProductStockBadge";
import { ProductUnitDisplay } from "./ProductUnitDisplay";
import { ProductImageDisplay } from "./ProductImageDisplay";
import { DeleteProductDialog } from "./DeleteProductDialog";
import { toggleProductStatus } from "@/lib/actions/product.actions";

interface Category {
  id: string;
  name: string;
}

interface SubCategory {
  id: string;
  name: string;
  categoryId: string;
}

interface Supplier {
  id: string;
  code: string;
  name: string;
  phone: string | null;
}

interface Unit {
  id: string;
  name: string;
}

interface ProductUnit {
  id: string;
  unitId: string;
  conversionValue: number;
  buyPrice: number;
  sellPrice: number;
  isPrimary: boolean;
  unit: Unit;
}

interface ProductImage {
  id: string;
  imageUrl: string;
  isPrimary: boolean;
}

interface Product {
  id: string;
  code: string;
  barcode: string | null;
  name: string;
  description: string | null;
  currentStock: number;
  minStock: number;
  isActive: boolean;
  createdAt: Date;              // ✅ TAMBAHKAN
  updatedAt: Date;              // ✅ TAMBAHKAN
  categoryId: string;           // ✅ TAMBAHKAN
  subCategoryId: string | null; // ✅ TAMBAHKAN
  supplierId: string | null;    // ✅ TAMBAHKAN
  category: Category;
  subCategory: SubCategory | null;
  supplier: Supplier | null;
  productUnits: ProductUnit[];
  productImages: ProductImage[];
  _count: {
    productImages: number;
    saleItems: number;
    purchaseItems: number;
  };
}

interface ProductTableProps {
  initialProducts: Product[];
  initialTotal: number;
  initialPage: number;
  initialLimit: number;
  categories: Category[];
  suppliers: Supplier[];
  onEdit: (product: Product) => void;
  onView: (product: Product) => void;
  onRefresh: (params: {
    search?: string;
    page?: number;
    categoryId?: string;
    supplierId?: string;
    isActive?: boolean | null;
    lowStock?: boolean;
  }) => void;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

export function ProductTable({
  initialProducts,
  initialTotal,
  initialPage,
  initialLimit,
  categories,
  suppliers,
  onEdit,
  onView,
  onRefresh,
  onSuccess,
  onError,
}: ProductTableProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<boolean | null>(null);
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);

  const totalPages = Math.ceil(initialTotal / initialLimit);
  // ✅ Initialize filters from URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);

      const urlSearch = urlParams.get('search');
      const urlCategory = urlParams.get('categoryId');
      const urlSupplier = urlParams.get('supplierId');
      const urlIsActive = urlParams.get('isActive');
      const urlLowStock = urlParams.get('lowStock');

      if (urlSearch) setSearch(urlSearch);
      if (urlCategory) setSelectedCategory(urlCategory);
      if (urlSupplier) setSelectedSupplier(urlSupplier);
      if (urlIsActive) setStatusFilter(urlIsActive === 'true');
      if (urlLowStock) setLowStockFilter(urlLowStock === 'true');
    }
  }, []);
  // Handle search
  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
    onRefresh({
      search: value,
      page: 1,
      categoryId: selectedCategory || undefined,
      supplierId: selectedSupplier || undefined,
      isActive: statusFilter,
      lowStock: lowStockFilter,
    });
  };

  // Handle filter change
  // const handleFilterChange = () => {
  //   setCurrentPage(1);
  //   onRefresh({
  //     search,
  //     page: 1,
  //     categoryId: selectedCategory || undefined,
  //     supplierId: selectedSupplier || undefined,
  //     isActive: statusFilter === null ? undefined : statusFilter,  // ✅ Convert null to undefined
  //     lowStock: lowStockFilter,
  //   });
  // };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    onRefresh({
      search,
      page,
      categoryId: selectedCategory || undefined,
      supplierId: selectedSupplier || undefined,
      isActive: statusFilter,
      lowStock: lowStockFilter,
    });
  };

  // Handle toggle status
  const handleToggleStatus = async (product: Product) => {
    setTogglingStatus(product.id);

    try {
      const result = await toggleProductStatus(product.id);

      if (result.success) {
        // Update local state
        setProducts(prev =>
          prev.map(p =>
            p.id === product.id ? { ...p, isActive: !p.isActive } : p
          )
        );
        onSuccess(result.message!);
      } else {
        onError(result.error!);
      }
    } catch (error) {
      console.error("Toggle status error:", error);
      onError("Gagal mengubah status produk.");
    } finally {
      setTogglingStatus(null);
    }
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearch("");
    setSelectedCategory("");
    setSelectedSupplier("");
    setStatusFilter(null);
    setLowStockFilter(false);
    setCurrentPage(1);
    onRefresh({ page: 1 });
  };

  const activeFilterCount =
    (search ? 1 : 0) +
    (selectedCategory ? 1 : 0) +
    (selectedSupplier ? 1 : 0) +
    (statusFilter !== null ? 1 : 0) +
    (lowStockFilter ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Cari produk (nama, kode, barcode)..."
              className="glass-input pl-10"
            />
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary relative ${activeFilterCount > 0 ? "ring-2 ring-blue-500" : ""
              }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 animate-slide-down">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Category Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Kategori
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    const newCategory = e.target.value;
                    setSelectedCategory(newCategory);

                    // ✅ Trigger refresh dengan setTimeout
                    setTimeout(() => {
                      setCurrentPage(1);
                      onRefresh({
                        search,
                        page: 1,
                        categoryId: newCategory || undefined,
                        supplierId: selectedSupplier || undefined,
                        isActive: statusFilter === null ? undefined : statusFilter,
                        lowStock: lowStockFilter,
                      });
                    }, 0);
                  }}
                  className="glass-input text-sm"
                >
                  <option value="">Semua Kategori</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Supplier Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Supplier
                </label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => {
                    const newSupplier = e.target.value;
                    setSelectedSupplier(newSupplier);

                    // ✅ Trigger refresh dengan setTimeout
                    setTimeout(() => {
                      setCurrentPage(1);
                      onRefresh({
                        search,
                        page: 1,
                        categoryId: selectedCategory || undefined,
                        supplierId: newSupplier || undefined,
                        isActive: statusFilter === null ? undefined : statusFilter,
                        lowStock: lowStockFilter,
                      });
                    }, 0);
                  }}
                  className="glass-input text-sm"
                >
                  <option value="">Semua Supplier</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter === null ? "" : statusFilter ? "active" : "inactive"}
                  onChange={(e) => {
                    const value = e.target.value;
                    const newStatus = value === "" ? null : value === "active" ? true : false;  // ✅ Explicit true/false
                    setStatusFilter(newStatus);

                    // ✅ Trigger refresh dengan setTimeout agar state updated
                    setTimeout(() => {
                      setCurrentPage(1);
                      onRefresh({
                        search,
                        page: 1,
                        categoryId: selectedCategory || undefined,
                        supplierId: selectedSupplier || undefined,
                        isActive: newStatus === null ? undefined : newStatus,
                        lowStock: lowStockFilter,
                      });
                    }, 0);
                  }}
                  className="glass-input text-sm"
                >
                  <option value="">Semua Status</option>
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </select>
              </div>

              {/* Low Stock Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Stok
                </label>
                <label className="flex items-center gap-2 glass-input text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lowStockFilter}
                    onChange={(e) => {
                      const newLowStock = e.target.checked;
                      setLowStockFilter(newLowStock);

                      // ✅ Trigger refresh dengan setTimeout
                      setTimeout(() => {
                        setCurrentPage(1);
                        onRefresh({
                          search,
                          page: 1,
                          categoryId: selectedCategory || undefined,
                          supplierId: selectedSupplier || undefined,
                          isActive: statusFilter === null ? undefined : statusFilter,
                          lowStock: newLowStock,
                        });
                      }, 0);
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span>Stok Menipis</span>
                </label>
              </div>
            </div>

            {/* Reset Filters */}
            {activeFilterCount > 0 && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleResetFilters}
                  className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                >
                  Reset Semua Filter
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Produk
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Kategori
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Satuan & Harga
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Stok
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <Search className="w-12 h-12 mb-3 text-gray-300" />
                      <p className="text-lg font-semibold">Tidak ada produk</p>
                      <p className="text-sm">
                        {search || activeFilterCount > 0
                          ? "Coba ubah filter pencarian"
                          : "Belum ada produk yang ditambahkan"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* Product Info */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <ProductImageDisplay
                          images={product.productImages}
                          productName={product.name}
                          variant="thumbnail"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 truncate">
                            {product.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                              {product.code}
                            </span>
                            {product.barcode && (
                              <span className="text-xs text-gray-500">
                                | {product.barcode}
                              </span>
                            )}
                          </div>
                          {product.supplier && (
                            <p className="text-xs text-gray-500 mt-1">
                              Supplier: {product.supplier.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {product.category.name}
                        </p>
                        {product.subCategory && (
                          <p className="text-xs text-gray-600 mt-0.5">
                            {product.subCategory.name}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Units & Prices */}
                    <td className="px-4 py-4">
                      <ProductUnitDisplay
                        units={product.productUnits}
                        variant="compact"
                      />
                    </td>

                    {/* Stock */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-lg font-bold text-gray-900">
                          {product.currentStock}
                        </span>
                        <ProductStockBadge
                          currentStock={product.currentStock}
                          minStock={product.minStock}
                          size="sm"
                        />
                        <span className="text-xs text-gray-500">
                          Min: {product.minStock}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(product)}
                        disabled={togglingStatus === product.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${product.isActive
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          } ${togglingStatus === product.id
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                          }`}
                      >
                        <Power className="w-3 h-3" />
                        <span>{product.isActive ? "Aktif" : "Nonaktif"}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onView(product)}
                          className="p-2 rounded-lg hover:bg-blue-100 transition-colors group"
                          title="Lihat Detail"
                        >
                          <Eye className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                        </button>
                        <button
                          onClick={() => onEdit(product)}
                          className="p-2 rounded-lg hover:bg-yellow-100 transition-colors group"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4 text-yellow-600 group-hover:scale-110 transition-transform" />
                        </button>
                        <button
                          onClick={() => setDeleteProduct(product)}
                          disabled={
                            product._count.saleItems > 0 ||
                            product._count.purchaseItems > 0
                          }
                          className={`p-2 rounded-lg transition-colors group ${product._count.saleItems > 0 ||
                            product._count.purchaseItems > 0
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-red-100"
                            }`}
                          title={
                            product._count.saleItems > 0 ||
                              product._count.purchaseItems > 0
                              ? "Tidak dapat dihapus (ada transaksi terkait)"
                              : "Hapus"
                          }
                        >
                          <Trash2
                            className={`w-4 h-4 ${product._count.saleItems > 0 ||
                              product._count.purchaseItems > 0
                              ? "text-gray-400"
                              : "text-red-600 group-hover:scale-110 transition-transform"
                              }`}
                          />
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
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">
                Menampilkan <span className="font-semibold">{products.length}</span> dari{" "}
                <span className="font-semibold">{initialTotal}</span> produk
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Show first, last, current, and adjacent pages
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${page === currentPage
                            ? "bg-blue-600 text-white"
                            : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
                            }`}
                        >
                          {page}
                        </button>
                      );
                    } else if (
                      page === currentPage - 2 ||
                      page === currentPage + 2
                    ) {
                      return (
                        <span key={page} className="px-2 text-gray-500">
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      {deleteProduct && (
        <DeleteProductDialog
          product={{
            id: deleteProduct.id,
            code: deleteProduct.code,
            name: deleteProduct.name,
          }}
          onClose={() => setDeleteProduct(null)}
          onSuccess={(message) => {
            onSuccess(message);
            setDeleteProduct(null);
            // Remove from local state
            setProducts(prev => prev.filter(p => p.id !== deleteProduct.id));
          }}
          onError={onError}
        />
      )}
    </div>
  );
}