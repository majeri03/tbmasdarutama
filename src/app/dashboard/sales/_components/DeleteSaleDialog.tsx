"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { deleteSale } from "@/lib/actions/sale.actions";

interface DeleteSaleDialogProps {
  sale: {
    id: string;
    invoiceNumber: string;
    status: string;
  };
  onSuccess: () => void;
}

export function DeleteSaleDialog({ sale, onSuccess }: DeleteSaleDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleDelete = async () => {
    if (sale.status !== "PENDING") {
      setError("Hanya penjualan PENDING yang bisa dihapus!");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await deleteSale(sale.id);
      if (result.success) {
        setSuccess(result.message || "Penjualan berhasil dihapus");
        setTimeout(() => {
          setIsOpen(false);
          onSuccess();
        }, 1000);
      } else {
        setError(result.error || "Gagal menghapus penjualan");
      }
    } catch {
      setError("Gagal menghapus penjualan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-icon-danger"
        title="Hapus"
        disabled={sale.status !== "PENDING"}
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="modal-overlay">
          <div className="modal-container max-w-md animate-modal-slide-up">
            <div className="modal-header bg-gradient-to-r from-red-500 to-red-600">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Hapus Penjualan
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  {success}
                </div>
              )}
              
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-600" />
                </div>
                <p className="text-gray-700 mb-2">
                  Apakah Anda yakin ingin menghapus penjualan ini?
                </p>
                <p className="text-sm text-gray-500">
                  Invoice: <span className="font-semibold">{sale.invoiceNumber}</span>
                </p>
                <p className="text-xs text-red-600 mt-2">
                  Tindakan ini tidak dapat dibatalkan!
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn-secondary"
                disabled={loading}
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                className="btn-danger"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="spinner"></div>
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Hapus Penjualan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}