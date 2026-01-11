"use client";

import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { CustomerDebtData } from "@/types/customer-debt";
import { deleteCustomerDebt } from "@/lib/actions/customer-debt.actions";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils/pos-helpers";

interface DeleteDebtDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  debt: CustomerDebtData | null;
}

export function DeleteDebtDialog({
  isOpen,
  onClose,
  onSuccess,
  debt,
}: DeleteDebtDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  if (!isOpen || !debt) return null;

  const handleDelete = async () => {
    setIsLoading(true);

    try {
      const result = await deleteCustomerDebt(debt.id);

      if (result.success) {
        showToast(result.message || "Piutang berhasil dihapus", "success");
        onSuccess();
        onClose();
      } else {
        showToast(result.error || "Gagal menghapus piutang", "error");
      }
    } catch (error) {
      console.error("Error deleting debt:", error);
      showToast("Terjadi kesalahan", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Hapus Piutang</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Debt Info */}
          <div className="glass-card p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">No. Piutang:</span>
              <span className="font-semibold">{debt.debtNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Customer:</span>
              <span className="font-semibold">{debt.customer.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Invoice:</span>
              <span className="font-semibold">{debt.sale.invoiceNumber}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-sm text-gray-600">Total Piutang:</span>
              <span className="text-lg font-bold text-red-600">
                {formatCurrency(debt.totalDebt)}
              </span>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              <strong>Perhatian!</strong> Tindakan ini tidak dapat dibatalkan.
              Piutang akan dihapus secara permanen dari sistem.
            </p>
          </div>

          <p className="text-sm text-gray-600">
            Apakah Anda yakin ingin menghapus piutang ini?
          </p>
        </div>

        {/* Actions */}
        <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={isLoading}
          >
            Batal
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            disabled={isLoading}
          >
            {isLoading ? "Menghapus..." : "Ya, Hapus"}
          </button>
        </div>
      </div>
    </div>
  );
}