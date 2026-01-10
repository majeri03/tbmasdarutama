"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { MovementType } from "@prisma/client";
import { StockStats } from "./StockStats";
import { StockTable } from "./StockTable";
import { StockAdjustmentModal } from "./StockAdjustmentModal";
import { StockHistoryModal } from "./StockHistoryModal";
import { LowStockAlert } from "./LowStockAlert";
import { DeleteStockDialog } from "./DeleteStockDialog";
import { Toast, useToast } from "@/components/ui/toast";

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

interface Product {
  id: string;
  code: string;
  name: string;
  currentStock: number;
}

interface LowStockProduct {
  id: string;
  code: string;
  name: string;
  barcode: string | null;
  currentStock: number;
  minStock: number;
  category: {
    id: string;
    name: string;
  } | null;
  supplier: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
}

interface StockClientProps {
  initialMovements: StockMovement[];
  initialTotal: number;
  initialPage: number;
  initialLimit: number;
  statistics: {
    totalProducts: number;
    totalBuyValue: number;
    totalSellValue: number;
    lowStockCount: number;
    movementsToday: number;
    stockInMonth: number;
    stockOutMonth: number;
  };
  products: Product[];
  lowStockProducts: LowStockProduct[];
}

export function StockClient({
  initialMovements,
  initialTotal,
  initialPage,
  initialLimit,
  statistics,
  products,
  lowStockProducts,
}: StockClientProps) {
  // Toast hook
  const { toast, showToast, hideToast } = useToast();

  // Modal states
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(
    null
  );

  // Calculate total pages
  const totalPages = Math.ceil(initialTotal / initialLimit);

  // Handle success
  const handleSuccess = (message: string) => {
    showToast(message, "success");
    setTimeout(() => {
      const currentParams = new URLSearchParams(window.location.search);
      window.location.href = `/dashboard/stocks?${currentParams.toString()}&t=${Date.now()}`;
    }, 1500);
  };

  // Handle error
  const handleError = (message: string) => {
    showToast(message, "error");
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", page.toString());
    window.location.href = `/dashboard/stocks?${params.toString()}`;
  };

  // Handle refresh with filters
  const handleRefresh = (filters: {
    search?: string;
    page?: number;
    movementType?: MovementType;
  }) => {
    const params = new URLSearchParams();

    if (filters.search) params.set("search", filters.search);
    if (filters.page) params.set("page", filters.page.toString());
    if (filters.movementType) params.set("type", filters.movementType);

    window.location.href = `/dashboard/stocks?${params.toString()}`;
  };

  // Handle view movement
  const handleView = (movement: StockMovement) => {
    setSelectedMovement(movement);
    setHistoryModalOpen(true);
  };

  // Handle delete movement
  const handleDelete = (movement: StockMovement) => {
    setSelectedMovement(movement);
    setDeleteDialogOpen(true);
  };

  // Handle add adjustment
  const handleAddAdjustment = () => {
    setAdjustmentModalOpen(true);
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Stock Control</h1>
          <p className="text-gray-600 mt-1">
            Kelola pergerakan dan monitoring stock produk
          </p>
        </div>
        <button onClick={handleAddAdjustment} className="btn-primary">
          <Plus className="w-5 h-5" />
          <span>Adjustment Stock</span>
        </button>
      </div>

      {/* Statistics */}
      <StockStats
        totalProducts={statistics.totalProducts}
        totalBuyValue={statistics.totalBuyValue}
        totalSellValue={statistics.totalSellValue}
        lowStockCount={statistics.lowStockCount}
        movementsToday={statistics.movementsToday}
        stockInMonth={statistics.stockInMonth}
        stockOutMonth={statistics.stockOutMonth}
      />

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <LowStockAlert products={lowStockProducts} />
      )}

      {/* Stock Movements Table */}
      <StockTable
        movements={initialMovements}
        currentPage={initialPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        onView={handleView}
        onDelete={handleDelete}
        onRefresh={handleRefresh}
      />

      {/* Modals */}
      <StockAdjustmentModal
        isOpen={adjustmentModalOpen}
        onClose={() => setAdjustmentModalOpen(false)}
        onSuccess={handleSuccess}
        onError={handleError}
        products={products}
      />

      <StockHistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        movement={selectedMovement}
        productName={selectedMovement?.product.name}
      />

      <DeleteStockDialog
        movement={
          selectedMovement
            ? {
                id: selectedMovement.id,
                type: selectedMovement.type,
                quantity: selectedMovement.quantity,
                productName: selectedMovement.product.name,
              }
            : null
        }
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      {/* Toast Notification */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}
    </div>
  );
}