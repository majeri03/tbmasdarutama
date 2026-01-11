"use client";

import { useState, useEffect } from "react";
import { X, Printer, Download, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { getSaleById } from "@/lib/actions/sale.actions";
import { formatCurrency } from "@/lib/utils/pos-helpers";

interface InvoicePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNumber: string;
  saleId: string;
}

// ✅ Add proper type for sale data
interface SaleData {
  id: string;
  invoiceNumber: string;
  saleDate: Date;
  totalAmount: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: string;
  customer: {
    code: string;
    name: string;
    type: string;
    phone: string | null;
    address: string | null;
  };
  cashier: {
    name: string;
    email: string;
  };
  saleItems: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    subtotal: number;
    product: {
      code: string;
      name: string;
    };
    unit: {
      name: string;
    };
  }>;
}

export function InvoicePreview({ isOpen, onClose, invoiceNumber, saleId }: InvoicePreviewProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saleData, setSaleData] = useState<SaleData | null>(null);
  const { showToast } = useToast();

  // ✅ Load data only when modal opens - NO showToast in deps
  useEffect(() => {
    if (isOpen && saleId) {
      const loadInvoiceData = async () => {
        setIsLoading(true);
        setSaleData(null); // Reset data
        
        const result = await getSaleById(saleId);
        if (result.success && result.data) {
          setSaleData(result.data as SaleData);
        } else {
          // ✅ Call showToast directly, don't put in deps
          showToast(result.error || "Gagal memuat invoice", "error");
        }
        setIsLoading(false);
      };

      loadInvoiceData();
    } else {
      // Reset when modal closes
      setSaleData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, saleId]); // ✅ ONLY isOpen and saleId - showToast causes infinite loop

  if (!isOpen) return null;

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      window.print();
      showToast("Invoice berhasil dicetak!", "success");
      onClose();
    } catch {
      showToast("Gagal mencetak invoice", "error");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownload = () => {
    showToast("Fitur download PDF akan segera hadir", "info");
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

              {isLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                  <p className="text-sm text-gray-500 mt-2">Loading invoice details...</p>
                </div>
              ) : saleData ? (
                <>
                  {/* Invoice Info */}
                  <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-200">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">No. Invoice</p>
                      <p className="font-semibold">{saleData.invoiceNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Tanggal</p>
                      <p className="font-semibold">
                        {new Date(saleData.saleDate).toLocaleDateString("id-ID")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Customer</p>
                      <p className="font-semibold">{saleData.customer.name}</p>
                      <p className="text-xs text-gray-500">{saleData.customer.code}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Kasir</p>
                      <p className="font-semibold">{saleData.cashier.name}</p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="mb-6">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-2 px-3">Produk</th>
                          <th className="text-center py-2 px-3">Qty</th>
                          <th className="text-right py-2 px-3">Harga</th>
                          <th className="text-right py-2 px-3">Diskon</th>
                          <th className="text-right py-2 px-3">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {saleData.saleItems.map((item) => (
                          <tr key={item.id} className="border-b border-gray-100">
                            <td className="py-2 px-3">
                              <p className="font-medium">{item.product.name}</p>
                              <p className="text-xs text-gray-500">
                                {item.product.code} • {item.unit.name}
                              </p>
                            </td>
                            <td className="text-center py-2 px-3">{item.quantity}</td>
                            <td className="text-right py-2 px-3">{formatCurrency(item.unitPrice)}</td>
                            <td className="text-right py-2 px-3">{formatCurrency(item.discount)}</td>
                            <td className="text-right py-2 px-3 font-semibold">
                              {formatCurrency(item.subtotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="border-t-2 border-gray-200 pt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(saleData.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Diskon:</span>
                      <span>- {formatCurrency(saleData.discount)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>PPN:</span>
                      <span>{formatCurrency(saleData.tax)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                      <span>TOTAL:</span>
                      <span>{formatCurrency(saleData.grandTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-2 text-gray-600">
                      <span>Bayar ({saleData.paymentMethod}):</span>
                      <span>{formatCurrency(saleData.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Kembali:</span>
                      <span>{formatCurrency(saleData.changeAmount)}</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="text-center text-xs text-gray-500 mt-8 pt-6 border-t border-gray-200">
                    <p>Terima kasih atas pembelian Anda</p>
                    <p>Barang yang sudah dibeli tidak dapat dikembalikan</p>
                  </div>
                </>
              ) : (
                <p className="text-center text-gray-500 py-8">Data invoice tidak tersedia</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-gray-200 flex gap-2">
            <button
              onClick={handleDownload}
              disabled={isPrinting || isLoading}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={isPrinting || isLoading}
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