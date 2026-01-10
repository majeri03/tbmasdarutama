"use client";

import { useState, useEffect } from "react";
import { Plus, FolderTree, Folder, Package } from "lucide-react";
import { CategoryTable } from "./_components/CategoryTable";
import { CategoryFormModal } from "./_components/CategoryFormModal";
import { SubCategoryFormModal } from "./_components/SubCategoryFormModal";
import { DeleteCategoryDialog } from "./_components/DeleteCategoryDialog";
import { DeleteSubCategoryDialog } from "./_components/DeleteSubCategoryDialog";
import { Toast, type ToastType } from "@/components/ui/toast";
import { getCategories } from "@/lib/actions/category.actions";

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

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal states - Category
  const [showCategoryFormModal, setShowCategoryFormModal] = useState(false);
  const [showDeleteCategoryDialog, setShowDeleteCategoryDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  // Modal states - SubCategory
  const [showSubCategoryFormModal, setShowSubCategoryFormModal] = useState(false);
  const [showDeleteSubCategoryDialog, setShowDeleteSubCategoryDialog] = useState(false);
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | null>(null);
  const [preSelectedCategoryId, setPreSelectedCategoryId] = useState<string>("");

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  // Fetch categories
  const fetchCategories = async (page = 1, searchQuery = search) => {
    setLoading(true);
    try {
      const result = await getCategories({
        search: searchQuery,
        page,
        limit: 10,
        includeSubCategories: true,
      });

      if (result.success) {
        setCategories(result.data as Category[]);
        setPagination(result.pagination);
      }
    } catch {
      showToast("Gagal memuat data kategori", "error");
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toast helper
  const showToast = (message: string, type: ToastType = "success") => {
    setToast({ message, type });
  };

  const hideToast = () => {
    setToast(null);
  };

  // ==================== CATEGORY HANDLERS ====================
  const handleSearch = (searchQuery: string) => {
    setSearch(searchQuery);
    fetchCategories(1, searchQuery);
  };

  const handlePageChange = (page: number) => {
    fetchCategories(page);
  };

  const handleAddCategory = () => {
    setSelectedCategory(null);
    setShowCategoryFormModal(true);
  };

  const handleEditCategory = (category: Category) => {
    setSelectedCategory(category);
    setShowCategoryFormModal(true);
  };

  const handleDeleteCategory = (category: Category) => {
    setSelectedCategory(category);
    setShowDeleteCategoryDialog(true);
  };

  const handleCategoryFormSuccess = (message: string) => {
    showToast(message, "success");
    fetchCategories(pagination.page);
  };

  const handleCategoryDeleteSuccess = (message: string) => {
    showToast(message, "success");
    fetchCategories(1);
  };

  // ==================== SUB-CATEGORY HANDLERS ====================
  const handleAddSubCategory = (categoryId: string) => {
    setSelectedSubCategory(null);
    setPreSelectedCategoryId(categoryId);
    setShowSubCategoryFormModal(true);
  };

  const handleEditSubCategory = (subCategory: SubCategory) => {
    setSelectedSubCategory(subCategory);
    setPreSelectedCategoryId("");
    setShowSubCategoryFormModal(true);
  };

  const handleDeleteSubCategory = (subCategory: SubCategory) => {
    setSelectedSubCategory(subCategory);
    setShowDeleteSubCategoryDialog(true);
  };

  const handleSubCategoryFormSuccess = (message: string) => {
    showToast(message, "success");
    fetchCategories(pagination.page);
  };

  const handleSubCategoryDeleteSuccess = (message: string) => {
    showToast(message, "success");
    fetchCategories(pagination.page);
  };

  // Calculate stats
  const totalSubCategories = categories.reduce(
    (sum, cat) => sum + cat._count.subCategories,
    0
  );
  const totalProducts = categories.reduce(
    (sum, cat) => sum + cat._count.products,
    0
  );
  const categoriesWithSub = categories.filter(
    (cat) => cat._count.subCategories > 0
  ).length;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="glass-card p-6 animate-slide-up">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gradient mb-2">
                Master Kategori & Sub-Kategori
              </h1>
              <p className="text-gray-600">
                Kelola kategori dan sub-kategori produk Anda
              </p>
              <div className="flex items-center gap-3 mt-3">
                <div className="badge badge-info">
                  {pagination.total} Kategori
                </div>
                <span className="text-gray-400 text-sm">•</span>
                <div className="badge badge-secondary">
                  {totalSubCategories} Sub-Kategori
                </div>
                <span className="text-gray-400 text-sm">•</span>
                <span className="text-gray-600 text-sm">
                  Halaman {pagination.page} dari {pagination.totalPages || 1}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Total Kategori */}
          <div className="stat-card animate-slide-up">
            <div className="flex items-start justify-between mb-4">
              <div
                className="p-3 rounded-xl"
                style={{
                  background: "rgba(96, 165, 250, 0.15)",
                  border: "1px solid rgba(96, 165, 250, 0.3)",
                }}
              >
                <FolderTree className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-semibold mb-1">
              Total Kategori
            </h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {pagination.total}
            </p>
            <p className="text-gray-500 text-xs">Kategori utama</p>
          </div>

          {/* Total Sub-Kategori */}
          <div className="stat-card animate-slide-up animation-delay-200">
            <div className="flex items-start justify-between mb-4">
              <div
                className="p-3 rounded-xl"
                style={{
                  background: "rgba(167, 139, 250, 0.15)",
                  border: "1px solid rgba(167, 139, 250, 0.3)",
                }}
              >
                <Folder className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-semibold mb-1">
              Total Sub-Kategori
            </h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {totalSubCategories}
            </p>
            <p className="text-gray-500 text-xs">Sub-kategori terdaftar</p>
          </div>

          {/* Kategori dengan Sub */}
          <div className="stat-card animate-slide-up animation-delay-400">
            <div className="flex items-start justify-between mb-4">
              <div
                className="p-3 rounded-xl"
                style={{
                  background: "rgba(34, 197, 94, 0.15)",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                }}
              >
                <FolderTree className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-semibold mb-1">
              Kategori Aktif
            </h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {categoriesWithSub}
            </p>
            <p className="text-gray-500 text-xs">Memiliki sub-kategori</p>
          </div>

          {/* Total Produk */}
          <div className="stat-card animate-slide-up animation-delay-600">
            <div className="flex items-start justify-between mb-4">
              <div
                className="p-3 rounded-xl"
                style={{
                  background: "rgba(251, 146, 60, 0.15)",
                  border: "1px solid rgba(251, 146, 60, 0.3)",
                }}
              >
                <Package className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-semibold mb-1">
              Total Produk
            </h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {totalProducts}
            </p>
            <p className="text-gray-500 text-xs">Produk terkategori</p>
          </div>
        </div>

        {/* Table */}
        <div className="animate-slide-up animation-delay-800">
          <CategoryTable
            categories={categories}
            pagination={pagination}
            onEdit={handleEditCategory}
            onDelete={handleDeleteCategory}
            onSearch={handleSearch}
            onPageChange={handlePageChange}
            onAddSubCategory={handleAddSubCategory}
            onEditSubCategory={handleEditSubCategory}
            onDeleteSubCategory={handleDeleteSubCategory}
            loading={loading}
          />
        </div>
      </div>

      {/* ==================== MODALS - CATEGORY ==================== */}
      {showCategoryFormModal && (
        <CategoryFormModal
          category={selectedCategory || undefined}
          onClose={() => setShowCategoryFormModal(false)}
          onSuccess={handleCategoryFormSuccess}
          onError={(error) => showToast(error, "error")}
        />
      )}

      {showDeleteCategoryDialog && selectedCategory && (
        <DeleteCategoryDialog
          category={selectedCategory}
          onClose={() => setShowDeleteCategoryDialog(false)}
          onSuccess={handleCategoryDeleteSuccess}
          onError={(error) => showToast(error, "error")}
        />
      )}

      {/* ==================== MODALS - SUB-CATEGORY ==================== */}
      {showSubCategoryFormModal && (
        <SubCategoryFormModal
          subCategory={selectedSubCategory || undefined}
          preSelectedCategoryId={preSelectedCategoryId}
          onClose={() => {
            setShowSubCategoryFormModal(false);
            setPreSelectedCategoryId("");
          }}
          onSuccess={handleSubCategoryFormSuccess}
          onError={(error) => showToast(error, "error")}
        />
      )}

      {showDeleteSubCategoryDialog && selectedSubCategory && (
        <DeleteSubCategoryDialog
          subCategory={selectedSubCategory}
          onClose={() => setShowDeleteSubCategoryDialog(false)}
          onSuccess={handleSubCategoryDeleteSuccess}
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

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-40">
        {/* FAB - Sub-Kategori */}
        <button
          onClick={() => {
            setPreSelectedCategoryId("");
            setShowSubCategoryFormModal(true);
          }}
          className="group relative p-4 rounded-full shadow-2xl transition-all hover:scale-110"
          style={{
            background: "linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)",
          }}
          title="Tambah Sub-Kategori"
        >
          <Folder className="w-6 h-6 text-white" />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs font-semibold px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Tambah Sub-Kategori
          </span>
        </button>

        {/* FAB - Kategori */}
        <button
          onClick={handleAddCategory}
          className="group relative p-4 rounded-full shadow-2xl transition-all hover:scale-110"
          style={{
            background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)",
          }}
          title="Tambah Kategori"
        >
          <Plus className="w-6 h-6 text-white" />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs font-semibold px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Tambah Kategori
          </span>
        </button>
      </div>
    </div>
  );
}