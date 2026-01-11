"use client";

import { useState } from "react";
import { X, CheckCircle, Package, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { receivePurchase } from "@/lib/actions/purchase.actions";
import { PurchaseData } from "@/types/purchase";
import { formatCurrency } from "@/lib/utils/pos-helpers";

interface ReceivePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  purchase: PurchaseData | null;
}

export function ReceivePurchaseModal({
  isOpen,
  onClose,
  onSuccess,
  purchase,
}: ReceivePurchaseModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!purchase) return;

    setIsLoading(true);

    try {
      const result = await receivePurchase({
        id: purchase.id,
        receivedDate: new Date(receivedDate),
        notes: notes || undefined,
      });

      if (result.success) {
        showToast(result.message || "Barang berhasil diterima", "success");
        onSuccess();
        onClose();
      } else {
        showToast(result.error || "Gagal menerima barang", "error");
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
      <div className="glass-card w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Terima Barang</h2>
              <p className="text-sm text-gray-500">PO: {purchase.poNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-semibold mb-1">Perhatian!</p>
              <p>
                Setelah menerima barang, stok produk akan otomatis bertambah dan PO tidak dapat
                diubah lagi.
              </p>
            </div>
          </div>

          {/* Purchase Info */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Supplier:</span>
              <span className="font-semibold">{purchase.supplier.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Item:</span>
              <span className="font-semibold">{purchase.purchaseItems.length} produk</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <span className="text-sm text-gray-600">Grand Total:</span>
              <span className="text-lg font-bold text-blue-600">
                {formatCurrency(purchase.grandTotal)}
              </span>
            </div>
          </div>

          {/* Items Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Daftar Barang yang Diterima
            </label>
            <div className="glass-card max-h-48 overflow-y-auto">
              <div className="divide-y divide-gray-200">
                {purchase.purchaseItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <Package className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.product?.name}</p>
                        <p className="text-xs text-gray-500">{item.product?.code}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {item.quantity} {item.unit?.name}
                      </p>
                      <p className="text-xs text-gray-500">{formatCurrency(item.subtotal)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Received Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tanggal Terima <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Catatan (Opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Kondisi barang, dll..."
            />
          </div>
        </form>

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
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            {isLoading ? "Memproses..." : "Terima Barang"}
          </button>
        </div>
      </div>
    </div>
  );
}