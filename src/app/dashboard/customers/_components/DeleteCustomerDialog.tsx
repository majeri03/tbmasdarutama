"use client";

import { useState } from "react";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { deleteCustomer } from "@/lib/actions/customer.actions";

interface DeleteCustomerDialogProps {
  customer: {
    id: string;
    code: string;
    name: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function DeleteCustomerDialog({
  customer,
  isOpen,
  onClose,
  onSuccess,
  onError,
}: DeleteCustomerDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);

    try {
      const result = await deleteCustomer(customer.id);

      if (result.success) {
        onSuccess(result.message || "Customer berhasil dihapus!");
        onClose();
      } else {
        onError(result.error || "Gagal menghapus customer");
      }
    } catch (error) {
      console.error("Error deleting customer:", error);
      onError("Terjadi kesalahan saat menghapus customer");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-md p-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-1">
              Hapus Customer
            </h3>
            <p className="text-sm text-gray-600">
              Apakah Anda yakin ingin menghapus customer ini?
            </p>
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Kode Customer:</span>
            <span className="text-sm font-semibold text-gray-900">
              {customer.code}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Nama Customer:</span>
            <span className="text-sm font-semibold text-gray-900">
              {customer.name}
            </span>
          </div>
        </div>

        {/* Warning Message */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 mb-6">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">
            Customer akan dihapus secara permanen jika tidak memiliki transaksi.
            Data yang sudah dihapus tidak dapat dikembalikan.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 btn-secondary"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menghapus...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Hapus Customer</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}