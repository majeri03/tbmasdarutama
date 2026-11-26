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
  // Ref + ukuran area preview — dipakai untuk fit-to-width (PKG-E,
  // perbaikan 7 item #4; pola yang sama dengan InvoicePreview di POS):
  // iframe dirender selebar desktop (850px untuk A4 / 320px untuk struk)
  // lalu diperkecil dengan transform scale supaya muat di layar HP tanpa
  // overflow horizontal.
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = previewWrapRef.current;
    if (!el) return;
    const update = () => setPreviewSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen]);

  // Lebar "desktop" konten invoice di dalam iframe.
  const previewBaseWidth = activeLayout === "STRUK_KECIL" ? 320 : 850;
  const previewScale = previewSize.width > 0 ? Math.min(1, previewSize.width / previewBaseWidth) : 1;

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

  // Fungsi Direct Download PDF — A4 multi-halaman (PKG-E, perbaikan 7 item
  // #4; pola yang sama dengan InvoicePreview di POS). Invoice panjang TIDAK
  // LAGI terpotong jadi satu gambar — tiap halaman A4 penuh lanjut ke
  // halaman berikutnya. Struk thermal tetap satu halaman memanjang.
  const handleDownload = async () => {
    // Pastikan iframe dan isinya sudah siap
    if (!iframeRef.current || !iframeRef.current.contentDocument || !iframeRef.current.contentDocument.body || !saleData) return;

    setIsProcessingPdf(true);
    try {
      const iframeBody = iframeRef.current.contentDocument.body;
      const isThermal = activeLayout === "STRUK_KECIL";

      // windowWidth selebar desktop supaya hasil PDF di HP sama dengan di desktop.
      const canvas = await html2canvas(iframeBody, {
        scale: 2, // Scale up untuk kualitas yang lebih baik
        useCORS: true, // Izinkan gambar dari domain lain (misal logo)
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: isThermal ? 320 : 850,
      });

      // OPT-C (23 Nov 2026): JPEG q0.85, bukan PNG — PDF 1 halaman turun
      // dari ~8,5 MB jadi ratusan KB. Teks tetap tajam karena scale 2.
      const imgData = canvas.toDataURL("image/jpeg", 0.85);
      const prefix = activeLayout === "SURAT_JALAN" ? "SuratJalan" : activeLayout === "FAKTUR_NCR" ? "Faktur" : "Invoice";

      if (isThermal) {
        // Struk thermal = gulungan: satu halaman memanjang.
        const pdfWidth = 80;
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        const thermalPdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [80, Math.max(imgHeight, 100)],
        });
        thermalPdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, imgHeight);
        thermalPdf.save(`Struk-${saleData.invoiceNumber}.pdf`);
      } else {
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
        });

        const pdfWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;
        pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;
        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, imgHeight);
          heightLeft -= pageHeight;
        }
        pdf.save(`${prefix}-${saleData.invoiceNumber}.pdf`);
      }

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
      <div className="glass-card w-full max-w-4xl h-[92dvh] sm:h-[90vh] flex flex-col bg-white rounded-lg shadow-xl overflow-hidden">
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
                  ? "bg-red-900 text-white shadow-sm"
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
                  ? "bg-red-900 text-white shadow-sm"
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
                  ? "bg-red-900 text-white shadow-sm"
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
                  ? "bg-red-900 text-white shadow-sm"
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

        {/* Peringatan kalau data toko belum diisi di Pengaturan */}
        {storeSetting && !storeSetting.name?.trim() && !isLoading && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
            Data toko belum diisi — lengkapi nama, alamat &amp; rekening di Pengaturan agar invoice menampilkan data toko yang benar.
          </div>
        )}

        {/* Preview Area */}
        <div className="flex-1 bg-gray-50 overflow-auto relative" ref={previewWrapRef}>
          {error ? (
            <div className="p-8 text-center text-red-600 bg-white h-full flex items-center justify-center">
                {error}
            </div>
          ) : isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-red-900" />
                <p className="text-sm text-gray-500 mt-2">Menyiapkan invoice...</p>
              </div>
            </div>
          ) : (
            // Iframe untuk menampilkan HTML dari Utils
            // Fit-to-width: iframe dirender selebar desktop lalu di-scale
            // supaya muat di layar HP tanpa overflow horizontal.
            // XSS fix (Nov 2026): sandbox="allow-same-origin" — script di dalam
            // iframe TIDAK boleh jalan, tapi iframe tetap satu origin supaya
            // download PDF (html2canvas baca iframeRef.contentDocument) tetap jalan.
            // sandbox="" polos akan merusak download PDF; allow-scripts akan
            // membiarkan script injeksi jalan — keduanya jangan dipakai.
            <div className="min-h-full flex justify-center">
              <iframe
                  ref={iframeRef}
                  srcDoc={htmlContent}
                  sandbox="allow-same-origin"
                  className="border-0 bg-white shadow-sm shrink-0"
                  style={{
                      width: previewBaseWidth,
                      height: previewSize.height > 0 ? previewSize.height / previewScale : 600,
                      transform: `scale(${previewScale})`,
                      transformOrigin: "top center",
                  }}
                  title="Invoice Preview"
              />
            </div>
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
            className="flex-1 px-4 py-3 bg-red-900 hover:bg-red-800 text-white rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>Print Invoice</span>
          </button>
        </div>
      </div>
    </div>
  );
}