"use client";

import { useState, useEffect } from "react";
import { X, Printer, Download, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface InvoicePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNumber: string;
  saleId: string;
}

export function InvoicePreview({ isOpen, onClose, invoiceNumber}: InvoicePreviewProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      // Auto-print when modal opens (optional)
      // handlePrint();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      // Placeholder: Implement actual print logic
      // For now, just show success message
      await new Promise((resolve) => setTimeout(resolve, 1000));
      showToast("Invoice berhasil dicetak!", "success");
      onClose();
    } catch  {
      showToast("Gagal mencetak invoice", "error");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownload = () => {
    // Placeholder: Implement PDF download
    showToast("Fitur download akan segera hadir", "info");
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        {/* Modal */}
        <div className="glass-card w-full max-w-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Invoice Preview</h2>
              <p className="text-sm text-gray-500">#{invoiceNumber}</p>
            </div>
            <button
              onClick={onClose}
              disabled={isPrinting}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Preview Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            <div className="bg-white p-8 shadow-sm rounded-lg">
              {/* Company Header */}
              <div className="text-center mb-6 pb-6 border-b-2 border-gray-200">
                <h1 className="text-2xl font-bold text-gray-900">TB MASDAR UTAMA</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Jl. Contoh No. 123, Kota, Provinsi
                </p>
                <p className="text-sm text-gray-600">Telp: (021) 1234567</p>
              </div>

              {/* Invoice Info */}
              <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-200">
                <div>
                  <p className="text-xs text-gray-500 mb-1">No. Invoice</p>
                  <p className="font-semibold">{invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Tanggal</p>
                  <p className="font-semibold">
                    {new Date().toLocaleDateString("id-ID")}
                  </p>
                </div>
              </div>

              {/* Placeholder: Items will be fetched from API */}
              <div className="mb-6">
                <p className="text-sm text-gray-500 text-center py-8">
                  Loading invoice details...
                </p>
              </div>

              {/* Footer */}
              <div className="text-center text-xs text-gray-500 mt-8 pt-6 border-t border-gray-200">
                <p>Terima kasih atas pembelian Anda</p>
                <p>Barang yang sudah dibeli tidak dapat dikembalikan</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-gray-200 flex gap-2">
            <button
              onClick={handleDownload}
              disabled={isPrinting}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mencetak...</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}