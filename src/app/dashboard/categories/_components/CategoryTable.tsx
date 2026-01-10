"use client";

import { useState } from "react";
import { Search, Edit, Trash2, FolderTree, Calendar, Loader2, ChevronDown, ChevronRight, Package } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { SubCategoryList } from "./SubCategoryList";

interface SubCategory {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  _count: {
    products: number;
  };
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    subCategories: number;
    products: number;
  };
  subCategories?: SubCategory[];
}

interface CategoryTableProps {
  categories: Category[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onSearch: (search: string) => void;
  onPageChange: (page: number) => void;
  onAddSubCategory: (categoryId: string) => void;
  onEditSubCategory: (subCategory: SubCategory) => void;
  onDeleteSubCategory: (subCategory: SubCategory) => void;
  loading?: boolean;
}

export function CategoryTable({
  categories,
  pagination,
  onEdit,
  onDelete,
  onSearch,
  onPageChange,
  onAddSubCategory,
  onEditSubCategory,
  onDeleteSubCategory,
  loading = false,
}: CategoryTableProps) {
  const [searchInput, setSearchInput] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchInput);
  };

  const handleSearchClear = () => {
    setSearchInput("");
    onSearch("");
  };

  const toggleExpand = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="glass-card p-4">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari nama atau deskripsi kategori..."
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
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          // Loading State
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">Memuat data kategori...</p>
          </div>
        ) : categories.length === 0 ? (
          // Empty State
          <div className="p-12 text-center">
            <div
              className="inline-flex p-4 rounded-2xl mb-4"
              style={{
                background: "rgba(96, 165, 250, 0.1)",
                border: "1px solid rgba(96, 165, 250, 0.2)",
              }}
            >
              <FolderTree className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Belum Ada Data Kategori
            </h3>
            <p className="text-gray-600 text-sm">
              {searchInput
                ? `Tidak ada hasil untuk "${searchInput}"`
                : "Tambahkan kategori produk pertama Anda"}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-4 text-sm font-semibold text-gray-700 w-12"></th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-700">
                      Nama Kategori
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-700">
                      Deskripsi
                    </th>
                    <th className="text-center p-4 text-sm font-semibold text-gray-700">
                      Sub-Kategori
                    </th>
                    <th className="text-center p-4 text-sm font-semibold text-gray-700">
                      Produk
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-700">
                      Dibuat
                    </th>
                    <th className="text-right p-4 text-sm font-semibold text-gray-700">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category, index) => {
                    const isExpanded = expandedCategories.has(category.id);
                    const hasSubCategories = category._count.subCategories > 0;

                    return (
                      <>
                        <tr
                          key={category.id}
                          className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${
                            index % 2 === 0 ? "bg-white/20" : ""
                          }`}
                        >
                          <td className="p-4">
                            {hasSubCategories && (
                              <button
                                onClick={() => toggleExpand(category.id)}
                                className="p-1 hover:bg-blue-100 rounded transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-gray-600" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-600" />
                                )}
                              </button>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="p-2 rounded-lg"
                                style={{
                                  background: "rgba(96, 165, 250, 0.1)",
                                  border: "1px solid rgba(96, 165, 250, 0.2)",
                                }}
                              >
                                <FolderTree className="w-4 h-4 text-blue-600" />
                              </div>
                              <span className="font-semibold text-gray-900">
                                {category.name}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-gray-600">
                              {category.description || "-"}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                category._count.subCategories > 0
                                  ? "bg-purple-100 text-purple-700 border border-purple-200"
                                  : "bg-gray-100 text-gray-600 border border-gray-200"
                              }`}
                            >
                              {category._count.subCategories}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                category._count.products > 0
                                  ? "bg-green-100 text-green-700 border border-green-200"
                                  : "bg-gray-100 text-gray-600 border border-gray-200"
                              }`}
                            >
                              {category._count.products}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="w-4 h-4" />
                              <span>
                                {format(new Date(category.createdAt), "dd MMM yyyy", {
                                  locale: id,
                                })}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => onEdit(category)}
                                className="p-2 rounded-lg hover:bg-blue-100 transition-colors group"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                              </button>
                              <button
                                onClick={() => onDelete(category)}
                                className="p-2 rounded-lg hover:bg-red-100 transition-colors group"
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4 text-red-600 group-hover:scale-110 transition-transform" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && hasSubCategories && category.subCategories && (
                          <tr>
                            <td colSpan={7} className="p-0">
                              <div className="bg-gray-50/50 p-4 border-l-4 border-purple-300">
                                <SubCategoryList
                                  categoryId={category.id}
                                  categoryName={category.name}
                                  subCategories={category.subCategories}
                                  onAddSubCategory={onAddSubCategory}
                                  onEditSubCategory={onEditSubCategory}
                                  onDeleteSubCategory={onDeleteSubCategory}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3 p-4">
              {categories.map((category) => {
                const isExpanded = expandedCategories.has(category.id);
                const hasSubCategories = category._count.subCategories > 0;

                return (
                  <div
                    key={category.id}
                    className="glass-card p-4 space-y-3 hover:bg-white/60 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {hasSubCategories && (
                          <button
                            onClick={() => toggleExpand(category.id)}
                            className="p-1 hover:bg-blue-100 rounded transition-colors flex-shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-600" />
                            )}
                          </button>
                        )}
                        <div
                          className="p-2 rounded-lg flex-shrink-0"
                          style={{
                            background: "rgba(96, 165, 250, 0.1)",
                            border: "1px solid rgba(96, 165, 250, 0.2)",
                          }}
                        >
                          <FolderTree className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-gray-900">
                            {category.name}
                          </h4>
                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">
                            {category.description || "Tidak ada deskripsi"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                        {category._count.subCategories} Sub
                      </span>
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {category._count.products}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {format(new Date(category.createdAt), "dd MMM yyyy", {
                            locale: id,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onEdit(category)}
                          className="p-2 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Edit className="w-4 h-4 text-blue-600" />
                        </button>
                        <button
                          onClick={() => onDelete(category)}
                          className="p-2 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && hasSubCategories && category.subCategories && (
                      <div className="pt-3 border-t border-gray-200">
                        <SubCategoryList
                          categoryId={category.id}
                          categoryName={category.name}
                          subCategories={category.subCategories}
                          onAddSubCategory={onAddSubCategory}
                          onEditSubCategory={onEditSubCategory}
                          onDeleteSubCategory={onDeleteSubCategory}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {!loading && categories.length > 0 && pagination.totalPages > 1 && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Menampilkan {(pagination.page - 1) * pagination.limit + 1} -{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} dari{" "}
              {pagination.total} kategori
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-100"
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
                          ? "bg-blue-600 text-white shadow-lg"
                          : "hover:bg-blue-100 text-gray-700"
                      }`}
                    >
                      {page}
                    </button>
                  </div>
                ))}
              <button
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-100"
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