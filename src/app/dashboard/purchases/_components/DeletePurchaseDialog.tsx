"use client";

import { useState } from "react";
import { X, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { deletePurchase } from "@/lib/actions/purchase.actions";
import { PurchaseData } from "@/types/purchase";
import { formatCurrency } from "@/lib/utils/pos-helpers";

interface DeletePurchaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  purchase: PurchaseData | null;
}

export function DeletePurchaseDialog({
  isOpen,
  onClose,
  onSuccess,
  purchase,
}: DeletePurchaseDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  const handleDelete = async () => {
    if (!purchase) return;

    setIsLoading(true);

    try {
      const result = await deletePurchase(purchase.id);

      if (result.success) {
        showToast(result.message || "Purchase Order berhasil dihapus", "success");
        onSuccess();
        onClose();
      } else {
        showToast(result.error || "Gagal menghapus Purchase Order", "error");
      }
    } catch {
      showToast("Terjadi kesalahan", "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !purchase) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Hapus Purchase Order</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <p className="font-semibold mb-1">Peringatan!</p>
              <p>
                Tindakan ini tidak dapat dibatalkan. Purchase Order dan data terkait akan dihapus
                secara permanen.
              </p>
            </div>
          </div>

          {/* Purchase Info */}
          <div className="glass-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">PO Number:</span>
              <span className="font-semibold">{purchase.poNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Supplier:</span>
              <span className="font-semibold">{purchase.supplier.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Items:</span>
              <span className="font-semibold">{purchase.purchaseItems.length} produk</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <span className="text-sm text-gray-600">Grand Total:</span>
              <span className="text-lg font-bold text-red-600">
                {formatCurrency(purchase.grandTotal)}
              </span>
            </div>
          </div>

          <p className="text-sm text-gray-600">
            Apakah Anda yakin ingin menghapus Purchase Order ini?
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-6 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {isLoading ? "Menghapus..." : "Hapus"}
          </button>
        </div>
      </div>
    </div>
  );
}