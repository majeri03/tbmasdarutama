"use client";

import { useState } from "react";
import { X, AlertTriangle, Trash2 } from "lucide-react";
import { DeliveryOrderData } from "@/types/delivery-order";
import { deleteDeliveryOrder } from "@/lib/actions/delivery-order.actions";
import { useToast } from "@/components/ui/toast";

interface DeleteDeliveryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  deliveryOrder: DeliveryOrderData | null;
}

export function DeleteDeliveryDialog({
  isOpen,
  onClose,
  onSuccess,
  deliveryOrder,
}: DeleteDeliveryDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  if (!isOpen || !deliveryOrder) return null;

  const handleDelete = async () => {
    setIsLoading(true);

    try {
      const result = await deleteDeliveryOrder(deliveryOrder.id);

      if (result.success) {
        showToast(
          result.message || "Surat jalan berhasil dihapus",
          "success"
        );
        onSuccess();
        onClose();
      } else {
        showToast(result.error || "Gagal menghapus surat jalan", "error");
      }
    } catch (error) {
      console.error("Error deleting delivery order:", error);
      showToast("Terjadi kesalahan", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1C1917] rounded-xl w-full max-w-md">
        {/* Header */}
        <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-stone-100 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            Konfirmasi Hapus
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-sm text-red-300">
              <strong>Perhatian!</strong> Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-stone-300">
              Apakah Anda yakin ingin menghapus surat jalan ini?
            </p>
            <div className="glass-card p-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-sm text-stone-400">No. Surat Jalan:</span>
                <span className="font-semibold">{deliveryOrder.doNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-stone-400">Customer:</span>
                <span className="font-semibold">
                  {deliveryOrder.customer.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-stone-400">Total Items:</span>
                <span className="font-semibold text-[#E5484D]">
                  {deliveryOrder.deliveryItems.length} items
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-white/10 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={isLoading}
          >
            Batal
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
              "Menghapus..."
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Hapus
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}