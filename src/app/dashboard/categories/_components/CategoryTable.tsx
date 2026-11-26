"use client";
import React from "react";
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
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
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
                className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 transition-colors"
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
      <div className="glass-card overflow-hidden bg-white/15 border-white/10">
        {loading ? (
          // Loading State
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-stone-400 mx-auto mb-3" />
            <p className="text-stone-400 text-sm">Memuat data kategori...</p>
          </div>
        ) : categories.length === 0 ? (
          // Empty State
          <div className="p-12 text-center">
            <div
              className="inline-flex p-4 rounded-2xl mb-4 bg-white/10 border border-white/10"
            >
              <FolderTree className="w-8 h-8 text-stone-400" />
            </div>
            <h3 className="text-lg font-bold text-stone-100 mb-2">
              Belum Ada Data Kategori
            </h3>
            <p className="text-stone-400 text-sm">
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
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-[11px] font-semibold uppercase tracking-wider text-stone-400 w-12"></th>
                    <th className="text-left p-4 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                      Nama Kategori
                    </th>
                    <th className="text-left p-4 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                      Deskripsi
                    </th>
                    <th className="text-center p-4 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                      Sub-Kategori
                    </th>
                    <th className="text-center p-4 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                      Produk
                    </th>
                    <th className="text-left p-4 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                      Dibuat
                    </th>
                    <th className="text-right p-4 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category, index) => {
                    const isExpanded = expandedCategories.has(category.id);
                    const hasSubCategories = category._count.subCategories > 0;

                    return (
                      <React.Fragment key={category.id}>
                        <tr
                          key={category.id}
                          className={`border-b border-white/10 hover:bg-white/5 transition-colors ${
                            index % 2 === 0 ? "bg-white/5" : ""
                          }`}
                        >
                          <td className="p-4">
                            {hasSubCategories && (
                              <button
                                onClick={() => toggleExpand(category.id)}
                                className="p-1 hover:bg-white/10 rounded transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-stone-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-stone-400" />
                                )}
                              </button>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="p-2 rounded-lg bg-white/10 border border-white/10"
                              >
                                <FolderTree className="w-4 h-4 text-stone-400" />
                              </div>
                              <span className="font-semibold text-stone-100">
                                {category.name}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-stone-400">
                              {category.description || "-"}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                category._count.subCategories > 0
                                  ? "bg-white/10 text-stone-400 border border-white/10"
                                  : "bg-white/10 text-stone-400 border border-white/10"
                              }`}
                            >
                              {category._count.subCategories}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                category._count.products > 0
                                  ? "bg-green-500/15 text-green-300 border border-green-500/25"
                                  : "bg-white/10 text-stone-400 border border-white/10"
                              }`}
                            >
                              {category._count.products}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 text-sm text-stone-400">
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
                                className="p-2 rounded-lg hover:bg-white/10 transition-colors group"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4 text-stone-400 group-hover:scale-110 transition-transform" />
                              </button>
                              <button
                                onClick={() => onDelete(category)}
                                className="p-2 rounded-lg hover:bg-red-500/10 transition-colors group"
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4 text-red-300 group-hover:scale-110 transition-transform" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && hasSubCategories && category.subCategories && (
                          <tr>
                            <td colSpan={7} className="p-0">
                              <div className="bg-white/5 p-4 border-l-4 border-white/15">
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
                      </React.Fragment>
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
                    className="glass-card p-4 space-y-3 bg-white/15 border-white/10 hover:bg-white/20 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {hasSubCategories && (
                          <button
                            onClick={() => toggleExpand(category.id)}
                            className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-stone-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-stone-400" />
                            )}
                          </button>
                        )}
                        <div
                          className="p-2 rounded-lg flex-shrink-0 bg-white/10 border border-white/10"
                        >
                          <FolderTree className="w-4 h-4 text-stone-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-stone-100">
                            {category.name}
                          </h4>
                          <p className="text-xs text-stone-400 mt-0.5 line-clamp-1">
                            {category.description || "Tidak ada deskripsi"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white/10 text-stone-400">
                        {category._count.subCategories} Sub
                      </span>
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-500/15 text-green-300 flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {category._count.products}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/10">
                      <div className="flex items-center gap-2 text-xs text-stone-400">
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
                          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        >
                          <Edit className="w-4 h-4 text-stone-400" />
                        </button>
                        <button
                          onClick={() => onDelete(category)}
                          className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-300" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && hasSubCategories && category.subCategories && (
                      <div className="pt-3 border-t border-white/10">
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
            <p className="text-sm text-stone-400">
              Menampilkan {(pagination.page - 1) * pagination.limit + 1} -{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} dari{" "}
              {pagination.total} kategori
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10"
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
                      <span className="text-stone-400">...</span>
                    )}
                    <button
                      onClick={() => onPageChange(page)}
                      className={`w-10 h-10 rounded-lg font-semibold text-sm transition-all ${
                        pagination.page === page
                          ? "bg-red-900 text-white shadow-lg"
                          : "hover:bg-white/10 text-stone-300"
                      }`}
                    >
                      {page}
                    </button>
                  </div>
                ))}
              <button
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10"
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