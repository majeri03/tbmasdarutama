"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ProductStats } from "./ProductStats";
import { ProductTable } from "./ProductTable";
import { ProductFormModal } from "./ProductFormModal";
import { ProductViewModal } from "./ProductViewModal";
import { Toast } from "@/components/ui/toast";

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
  createdAt: Date;
  updatedAt: Date;
  categoryId: string;        // ✅ TAMBAHKAN INI
  subCategoryId: string | null;  // ✅ TAMBAHKAN INI
  supplierId: string | null;
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

interface ProductsClientProps {
  initialProducts: Product[];
  initialTotal: number;
  initialPage: number;
  initialLimit: number;
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  lowStockProducts: number;
  categories: Category[];
  subCategories: SubCategory[];
  suppliers: Supplier[];
  units: Unit[];
}

type ModalMode = "create" | "edit" | "view" | null;

export function ProductsClient({
  initialProducts,
  initialTotal,
  initialPage,
  initialLimit,
  totalProducts,
  activeProducts,
  inactiveProducts,
  lowStockProducts,
  categories,
  subCategories,
  suppliers,
  units,
}: ProductsClientProps) {
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error";
  }>({
    show: false,
    message: "",
    type: "success",
  });

  // Handle refresh (ini akan trigger server action di page.tsx)
  const handleRefresh = async (params: {
    search?: string;
    page?: number;
    categoryId?: string;
    supplierId?: string;
    isActive?: boolean | null;
    lowStock?: boolean;
  }) => {
    // Build query params
    const searchParams = new URLSearchParams();
    
    if (params.search) searchParams.set("search", params.search);
    if (params.page) searchParams.set("page", params.page.toString());
    if (params.categoryId) searchParams.set("categoryId", params.categoryId);
    if (params.supplierId) searchParams.set("supplierId", params.supplierId);
    if (params.isActive !== undefined && params.isActive !== null) {
      searchParams.set("isActive", params.isActive.toString());
    }
    if (params.lowStock) searchParams.set("lowStock", "true");

    // Reload page with new params (Next.js will handle caching)
    window.location.href = `/dashboard/products?${searchParams.toString()}`;
  };

  // Handle create
  const handleCreate = () => {
    setSelectedProduct(null);
    setModalMode("create");
  };

  // Handle edit
  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setModalMode("edit");
  };

  // Handle view
  const handleView = (product: Product) => {
    setSelectedProduct(product);
    setModalMode("view");
  };

  // Handle edit from view modal
  const handleEditFromView = () => {
    setModalMode("edit");
  };

  // Handle close modal
  const handleCloseModal = () => {
    setModalMode(null);
    setSelectedProduct(null);
  };

  // Handle success
  const handleSuccess = (message: string) => {
    setToast({
      show: true,
      message,
      type: "success",
    });
    // Refresh page after success
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  // Handle error
  const handleError = (error: string) => {
    setToast({
      show: true,
      message: error,
      type: "error",
    });
  };

  // Close toast
  const handleCloseToast = () => {
    setToast({ ...toast, show: false });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manajemen Produk</h1>
          <p className="text-gray-600 mt-1">
            Kelola semua produk, stok, dan harga
          </p>
        </div>
        <button onClick={handleCreate} className="btn-primary">
          <Plus className="w-5 h-5" />
          <span>Tambah Produk</span>
        </button>
      </div>

      {/* Stats */}
      <ProductStats
        totalProducts={totalProducts}
        activeProducts={activeProducts}
        inactiveProducts={inactiveProducts}
        lowStockProducts={lowStockProducts}
      />

      {/* Table */}
      <ProductTable
        initialProducts={initialProducts}
        initialTotal={initialTotal}
        initialPage={initialPage}
        initialLimit={initialLimit}
        categories={categories}
        suppliers={suppliers}
        onEdit={handleEdit}
        onView={handleView}
        onRefresh={handleRefresh}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      {/* Form Modal */}
      {(modalMode === "create" || modalMode === "edit") && (
        <ProductFormModal
          mode={modalMode}
          product={selectedProduct || undefined}
          categories={categories}
          subCategories={subCategories}
          suppliers={suppliers}
          units={units}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      {/* View Modal */}
      {modalMode === "view" && selectedProduct && (
        <ProductViewModal
          product={selectedProduct}
          onClose={handleCloseModal}
          onEdit={handleEditFromView}
        />
      )}

      {/* Toast Notification */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={handleCloseToast}
        />
      )}
    </div>
  );
}