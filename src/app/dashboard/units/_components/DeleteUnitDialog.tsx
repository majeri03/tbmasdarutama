"use client";

import { useState } from "react";
import { Trash2, X, AlertTriangle, Loader2 } from "lucide-react";
import { deleteUnit } from "@/lib/actions/unit.actions";

interface DeleteUnitDialogProps {
  unit: {
    id: string;
    name: string;
  };
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

export function DeleteUnitDialog({
  unit,
  onClose,
  onSuccess,
  onError,
}: DeleteUnitDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);

    try {
      const result = await deleteUnit(unit.id);

      if (result.success) {
        onSuccess(result.message!);
        onClose();
      } else {
        onError(result.error!);
      }
    } catch {
      onError("Terjadi kesalahan saat menghapus satuan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
      <div className="glass-card p-6 w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-xl"
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
              }}
            >
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Konfirmasi Hapus</h3>
              <p className="text-sm text-gray-600 mt-0.5">
                Tindakan ini tidak dapat dibatalkan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
          <p className="text-sm text-gray-700">
            Apakah Anda yakin ingin menghapus satuan{" "}
            <span className="font-bold text-gray-900">{unit.name}</span>?
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn-secondary flex-1"
          >
            Batal
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="btn-danger flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menghapus...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Hapus</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}