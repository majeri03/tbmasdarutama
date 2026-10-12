"use client";

import { useState, useEffect, useRef } from "react";
import { X, Printer, Download, Loader2 } from "lucide-react";
import { getSaleById } from "@/lib/actions/sale.actions";
import { getStoreSetting } from "@/lib/actions/store-setting.actions";
import { printInvoice, generateInvoiceHtml, InvoiceData, StoreSetting } from "@/lib/utils/invoice-printer";

// Import library untuk Direct Download
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface SaleInvoicePDFProps {
  isOpen: boolean;
  onClose: () => void;
  saleId: string;
}

export function SaleInvoicePDF({ isOpen, onClose, saleId }: SaleInvoicePDFProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false); // State khusus untuk download PDF
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [saleData, setSaleData] = useState<InvoiceData | null>(null);
  const [storeSetting, setStoreSetting] = useState<StoreSetting | null>(null);
  const [activeLayout, setActiveLayout] = useState<string>("SURAT_JALAN");
  const [error, setError] = useState("");
  
  // Ref untuk iframe
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (isOpen && saleId) {
      loadData();
    } else {
      setHtmlContent("");
      setSaleData(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, saleId]);

  const loadData = async () => {
    setIsLoading(true);
    setError("");

    try {
      const [saleResult, settingResult] = await Promise.all([
        getSaleById(saleId),
        getStoreSetting()
      ]);

      if (saleResult.success && saleResult.data) {
        const sale = saleResult.data as unknown as InvoiceData;
        setSaleData(sale);
        
        let setting: StoreSetting | null = null;
        if (settingResult.success && settingResult.data) {
            setting = settingResult.data as StoreSetting;
            setStoreSetting(setting);
        }

        const initialLayout = setting?.invoiceLayoutType || "SURAT_JALAN";
        setActiveLayout(initialLayout);

        const html = generateInvoiceHtml(sale, setting, { layoutType: initialLayout });
        setHtmlContent(html);
      } else {
        setError(saleResult.error || "Gagal memuat invoice");
      }
    } catch {
      setError("Terjadi kesalahan saat memuat data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLayoutChange = (newLayout: string) => {
    setActiveLayout(newLayout);
    if (saleData) {
      const html = generateInvoiceHtml(saleData, storeSetting, { layoutType: newLayout });
      setHtmlContent(html);
    }
  };

  const handlePrint = () => {
    if (saleData) {
      printInvoice(saleData, storeSetting || {} as StoreSetting, { layoutType: activeLayout });
    }
  };

  // Fungsi Direct Download PDF
  const handleDownload = async () => {
    // Pastikan iframe dan isinya sudah siap
    if (!iframeRef.current || !iframeRef.current.contentDocument || !iframeRef.current.contentDocument.body || !saleData) return;

    setIsProcessingPdf(true);
    try {
      const iframeBody = iframeRef.current.contentDocument.body;

      // Gunakan html2canvas untuk 'memotret' isi iframe
      const canvas = await html2canvas(iframeBody, {
        scale: 2, // Scale up untuk kualitas yang lebih baik
        useCORS: true, // Izinkan gambar dari domain lain (misal logo)
        logging: false,
        backgroundColor: "#ffffff"
      });

      const imgData = canvas.toDataURL("image/png");
      const isThermal = activeLayout === "STRUK_KECIL";

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: isThermal ? [80, 250] : "a4",
      });

      const pdfWidth = isThermal ? 80 : 210;
      const imgWidth = pdfWidth; 
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      const prefix = activeLayout === "SURAT_JALAN" ? "SuratJalan" : activeLayout === "FAKTUR_NCR" ? "Faktur" : "Invoice";
      pdf.save(`${prefix}-${saleData.invoiceNumber}.pdf`);

    } catch (err) {
      console.error("Gagal membuat PDF:", err);
      alert("Gagal mendownload PDF. Silakan coba gunakan tombol Print > Save as PDF.");
    } finally {
      setIsProcessingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
      <div className="glass-card w-full max-w-4xl h-[90vh] flex flex-col bg-white rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-gray-200 bg-white gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Invoice Preview</h2>
            <p className="text-sm text-gray-500">
              {saleData ? `#${saleData.invoiceNumber}` : "Loading..."}
            </p>
          </div>

          {/* Format Selector Pills */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg overflow-x-auto">
            <button
              type="button"
              onClick={() => handleLayoutChange("SURAT_JALAN")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                activeLayout === "SURAT_JALAN"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Surat Jalan
            </button>
            <button
              type="button"
              onClick={() => handleLayoutChange("INVOICE_BESAR")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                activeLayout === "INVOICE_BESAR"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Invoice Besar (A4)
            </button>
            <button
              type="button"
              onClick={() => handleLayoutChange("FAKTUR_NCR")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                activeLayout === "FAKTUR_NCR"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Faktur NCR
            </button>
            <button
              type="button"
              onClick={() => handleLayoutChange("STRUK_KECIL")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                activeLayout === "STRUK_KECIL"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Struk (58mm)
            </button>
          </div>

          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 self-end sm:self-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview Area */}
        <div className="flex-1 bg-gray-50 overflow-hidden relative">
          {error ? (
            <div className="p-8 text-center text-red-600 bg-white h-full flex items-center justify-center">
                {error}
            </div>
          ) : isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                <p className="text-sm text-gray-500 mt-2">Menyiapkan invoice...</p>
              </div>
            </div>
          ) : (
            // Iframe untuk menampilkan HTML dari Utils
            <iframe 
                ref={iframeRef}
                srcDoc={htmlContent} 
                className="w-full h-full border-0 bg-white shadow-sm"
                title="Invoice Preview"
            />
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 flex gap-2 bg-white">
          <button
            onClick={handleDownload}
            disabled={isLoading || !htmlContent || isProcessingPdf}
            className="flex-1 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isProcessingPdf ? (
                 <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                 </>
            ) : (
                 <>
                    <Download className="w-4 h-4" />
                    <span>Download PDF</span>
                 </>
            )}
          </button>
          
          <button
            onClick={handlePrint}
            disabled={isLoading || !htmlContent || isProcessingPdf}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>Print Invoice</span>
          </button>
        </div>
      </div>
    </div>
  );
}