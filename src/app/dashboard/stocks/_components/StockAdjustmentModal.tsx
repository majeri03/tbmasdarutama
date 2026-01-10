"use client";

import { useState, useEffect } from "react";
import { X, Package, AlertCircle, Loader2 } from "lucide-react";
import { MovementType } from "@prisma/client";
import { createStockAdjustment } from "@/lib/actions/stock.actions";

interface Product {
  id: string;
  code: string;
  name: string;
  currentStock: number;
}

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  products: Product[];
}

export function StockAdjustmentModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
  products,
}: StockAdjustmentModalProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [type, setType] = useState<MovementType>(MovementType.IN);
  const [quantity, setQuantity] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchProduct, setSearchProduct] = useState("");

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedProduct(null);
      setType(MovementType.IN);
      setQuantity("");
      setNotes("");
      setSearchProduct("");
    }
  }, [isOpen]);

  // Filter products based on search
  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
      product.code.toLowerCase().includes(searchProduct.toLowerCase())
  );

  // Calculate new stock based on type
  const calculateNewStock = () => {
    if (!selectedProduct || !quantity) return selectedProduct?.currentStock || 0;

    const qty = parseInt(quantity);
    if (isNaN(qty)) return selectedProduct.currentStock;

    switch (type) {
      case MovementType.IN:
        return selectedProduct.currentStock + qty;
      case MovementType.OUT:
        return selectedProduct.currentStock - qty;
      case MovementType.ADJUSTMENT:
        return qty; // For adjustment, quantity IS the new stock
      default:
        return selectedProduct.currentStock;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProduct) {
      onError("Silakan pilih produk terlebih dahulu");
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      onError("Quantity harus berupa angka positif");
      return;
    }

    if (type === MovementType.OUT && qty > selectedProduct.currentStock) {
      onError("Stock tidak mencukupi untuk pengurangan");
      return;
    }

    if (!notes.trim()) {
      onError("Catatan wajib diisi");
      return;
    }

    setLoading(true);

    try {
      const result = await createStockAdjustment({
        productId: selectedProduct.id,
        type,
        quantity: qty,
        notes: notes.trim(),
        referenceType: "Manual Adjustment",
      });

      if (result.success) {
        onSuccess(result.message || "Stock berhasil disesuaikan");
        onClose();
      } else {
        onError(result.error || "Gagal menyesuaikan stock");
      }
    } catch  {
      onError("Terjadi kesalahan saat menyesuaikan stock");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const newStock = calculateNewStock();
  const isStockNegative = newStock < 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Adjustment Stock
                </h2>
                <p className="text-sm text-gray-600">
                  Sesuaikan stock produk manual
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Product Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Pilih Produk <span className="text-red-500">*</span>
              </label>
              
              {/* Search Product */}
              <input
                type="text"
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                placeholder="Cari produk..."
                className="glass-input mb-3"
              />

              {/* Product List */}
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    Tidak ada produk ditemukan
                  </div>
                ) : (
                  filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setSelectedProduct(product)}
                      className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
                        selectedProduct?.id === product.id
                          ? "bg-blue-50 border-l-4 border-blue-600"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">
                            {product.name}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {product.code}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Stock saat ini</div>
                          <div className="text-sm font-bold text-blue-600">
                            {product.currentStock} unit
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {selectedProduct && (
              <>
                {/* Movement Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tipe Pergerakan <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setType(MovementType.IN)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        type === MovementType.IN
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 hover:border-green-300"
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-1">📥</div>
                        <div className="font-semibold text-sm">Masuk</div>
                        <div className="text-xs text-gray-500">Stock Bertambah</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setType(MovementType.OUT)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        type === MovementType.OUT
                          ? "border-red-500 bg-red-50"
                          : "border-gray-200 hover:border-red-300"
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-1">📤</div>
                        <div className="font-semibold text-sm">Keluar</div>
                        <div className="text-xs text-gray-500">Stock Berkurang</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setType(MovementType.ADJUSTMENT)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        type === MovementType.ADJUSTMENT
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-blue-300"
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-1">✏️</div>
                        <div className="font-semibold text-sm">Adjustment</div>
                        <div className="text-xs text-gray-500">Set Stock Baru</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {type === MovementType.ADJUSTMENT ? "Stock Baru" : "Quantity"}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder={
                      type === MovementType.ADJUSTMENT
                        ? "Masukkan jumlah stock baru..."
                        : "Masukkan jumlah..."
                    }
                    className="glass-input"
                    min="0"
                    required
                  />
                </div>

                {/* Stock Preview */}
                {quantity && (
                  <div
                    className={`p-4 rounded-lg border-2 ${
                      isStockNegative
                        ? "bg-red-50 border-red-200"
                        : "bg-blue-50 border-blue-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-700">
                          Stock Setelah Adjustment
                        </div>
                        <div
                          className={`text-2xl font-bold ${
                            isStockNegative ? "text-red-600" : "text-blue-600"
                          }`}
                        >
                          {selectedProduct.currentStock} →{" "}
                          <span
                            className={
                              isStockNegative ? "text-red-600" : "text-green-600"
                            }
                          >
                            {newStock}
                          </span>{" "}
                          unit
                        </div>
                      </div>
                      {isStockNegative && (
                        <AlertCircle className="w-8 h-8 text-red-500" />
                      )}
                    </div>
                    {isStockNegative && (
                      <div className="mt-2 text-sm text-red-600 font-medium">
                        ⚠️ Stock tidak boleh negatif!
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Catatan <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Jelaskan alasan adjustment stock..."
                    rows={4}
                    className="glass-input resize-none"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Contoh: Stock opname, barang rusak, kehilangan, dll.
                  </p>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading || !selectedProduct || isStockNegative}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Package className="w-5 h-5" />
                    <span>Simpan Adjustment</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}