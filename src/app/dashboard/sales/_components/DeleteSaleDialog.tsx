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
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleClose = () => {
    setIsOpen(false);
    setPassword("");
    setError("");
    setSuccess("");
  };

  const handleDelete = async () => {
    if (sale.status === "CANCELLED") {
      setError("Transaksi ini sudah dibatalkan!");
      return;
    }

    if (!password) {
      setError("Password konfirmasi wajib diisi!");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await deleteSale(sale.id, password);
      if (result.success) {
        setSuccess(result.message || "Penjualan berhasil dibatalkan (Tutup Buku)");
        setPassword("");
        setTimeout(() => {
          setIsOpen(false);
          onSuccess();
        }, 1000);
      } else {
        setError(result.error || "Gagal memproses penghapusan penjualan");
      }
    } catch {
      setError("Gagal memproses penghapusan penjualan");
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
        disabled={sale.status === "CANCELLED"}
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="modal-overlay">
          <div className="modal-container max-w-md animate-modal-slide-up">
            <div className="modal-header bg-gradient-to-r from-red-500 to-red-600">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Hapus Penjualan (Tutup Buku)
              </h2>
              <button
                onClick={handleClose}
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
              
              <div className="text-center py-2">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <p className="text-gray-700 text-sm mb-1 font-semibold">
                  Apakah Anda yakin ingin menghapus/membatalkan penjualan ini?
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  Invoice: <span className="font-semibold text-blue-600">{sale.invoiceNumber}</span>
                </p>
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg mt-1 text-left leading-relaxed">
                  <strong>Pemberitahuan Tutup Buku:</strong> Transaksi tidak dihapus secara fisik dari database, melainkan ditandai sebagai <strong>DIBATALKAN</strong> (pencatatan lengkap diarsip). Stok barang akan otomatis dikembalikan ke gudang dan sisa piutang akan dibatalkan.
                </p>
              </div>

              {/* Password Confirmation field */}
              <div className="mt-4 text-left border-t pt-4">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Konfirmasi Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password akun Anda"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={handleClose}
                className="btn-secondary text-sm"
                disabled={loading}
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                className="btn-danger text-sm"
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