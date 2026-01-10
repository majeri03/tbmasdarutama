"use client";

import { useState } from "react";
import { X, AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { deleteStockMovement } from "@/lib/actions/stock.actions";

interface StockMovement {
  id: string;
  type: string;
  quantity: number;
  productName: string;
}

interface DeleteStockDialogProps {
  movement: StockMovement | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function DeleteStockDialog({
  movement,
  isOpen,
  onClose,
  onSuccess,
  onError,
}: DeleteStockDialogProps) {
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  if (!isOpen || !movement) return null;

  const handleDelete = async () => {
    if (confirmText.toLowerCase() !== "hapus") {
      onError('Ketik "HAPUS" untuk konfirmasi');
      return;
    }

    setLoading(true);

    try {
      const result = await deleteStockMovement(movement.id);

      if (result.success) {
        onSuccess(result.message || "Pergerakan stock berhasil dihapus");
        onClose();
        setConfirmText("");
      } else {
        onError(result.error || "Gagal menghapus pergerakan stock");
      }
    } catch  {
      onError("Terjadi kesalahan saat menghapus pergerakan stock");
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "IN":
        return "Masuk";
      case "OUT":
        return "Keluar";
      case "ADJUSTMENT":
        return "Adjustment";
      default:
        return type;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Dialog */}
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full">
          {/* Header */}
          <div className="bg-red-50 border-b border-red-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-red-900">
                  Hapus Pergerakan Stock
                </h2>
                <p className="text-sm text-red-700">
                  Tindakan ini tidak dapat dibatalkan
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-red-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-red-600" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Warning Message */}
            <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                  <p className="font-semibold mb-1">Peringatan Penting!</p>
                  <ul className="list-disc list-inside space-y-1 text-amber-800">
                    <li>Stock produk akan dikembalikan ke kondisi sebelumnya</li>
                    <li>Riwayat pergerakan akan dihapus permanen</li>
                    <li>Laporan stock akan berubah</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Movement Info */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Produk:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {movement.productName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Tipe:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {getTypeLabel(movement.type)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Quantity:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {movement.quantity} unit
                </span>
              </div>
            </div>

            {/* Confirmation Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ketik <span className="text-red-600 font-bold">HAPUS</span> untuk
                konfirmasi
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Ketik HAPUS..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all"
                disabled={loading}
              />
            </div>

            {/* Additional Warning */}
            <p className="text-xs text-gray-600 italic">
              ⚠️ Hanya admin yang dapat menghapus pergerakan stock. Pastikan Anda
              memiliki izin yang sesuai.
            </p>
          </div>

          {/* Actions */}
          <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading || confirmText.toLowerCase() !== "hapus"}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold rounded-lg hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Menghapus...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-5 h-5" />
                  <span>Hapus Sekarang</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}