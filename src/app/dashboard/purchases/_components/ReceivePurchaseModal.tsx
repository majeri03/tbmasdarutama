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
    <div className="modal-overlay">
      <div className="modal-container w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/15 rounded-xl">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-stone-100">Terima Barang</h2>
              <p className="text-sm text-stone-400">PO: {purchase.poNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-white/10 text-stone-400 hover:bg-white/15 hover:text-stone-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-300">
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
              <span className="text-sm text-stone-400">Supplier:</span>
              <span className="font-semibold">{purchase.supplier.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-400">Total Item:</span>
              <span className="font-semibold">{purchase.purchaseItems.length} produk</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-sm text-stone-400">Grand Total:</span>
              <span className="text-lg font-bold text-[#E5484D]">
                {formatCurrency(purchase.grandTotal)}
              </span>
            </div>
          </div>

          {/* Items Preview */}
          <div>
            <label className="label mb-2">
              Daftar Barang yang Diterima
            </label>
            <div className="glass-card max-h-48 overflow-y-auto">
              <div className="divide-y divide-white/10">
                {purchase.purchaseItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 hover:bg-white/5">
                    <div className="flex items-center gap-3">
                      <Package className="w-4 h-4 text-stone-500" />
                      <div>
                        <p className="text-sm font-medium text-stone-100">{item.product?.name}</p>
                        <p className="text-xs text-stone-400">{item.product?.code}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-stone-100">
                        {item.quantity} {item.unit?.name}
                      </p>
                      <p className="text-xs text-stone-400">{formatCurrency(item.subtotal)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Received Date */}
          <div>
            <label className="label mb-2">
              Tanggal Terima <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              className="w-full px-3 py-2 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 [color-scheme:dark]"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="label mb-2">
              Catatan (Opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Kondisi barang, dll..."
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex gap-2 bg-white/5 justify-end bg-white/5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-6 py-2 border border-white/10 rounded-xl hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-6 py-2 bg-green-700 text-white rounded-xl disabled:opacity-50 transition-all flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            {isLoading ? "Memproses..." : "Terima Barang"}
          </button>
        </div>
      </div>
    </div>
  );
}