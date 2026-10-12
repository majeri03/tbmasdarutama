"use client";

import { useState, useEffect, useRef } from "react";
import { X, Printer, Download, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { getSaleById } from "@/lib/actions/sale.actions";
import { getStoreSetting } from "@/lib/actions/store-setting.actions";
import { 
  printInvoice, 
  generateInvoiceHtml, 
  InvoiceData, 
  StoreSetting 
} from "@/lib/utils/invoice-printer";

// Import library untuk Direct Download PDF
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface InvoicePreviewProps {
    isOpen: boolean;
    onClose: () => void;
    invoiceNumber: string;
    saleId: string;
}

export function InvoicePreview({ isOpen, onClose, invoiceNumber, saleId }: InvoicePreviewProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessingPdf, setIsProcessingPdf] = useState(false);
    const [htmlContent, setHtmlContent] = useState<string>("");
    
    // State data menggunakan tipe dari utils
    const [saleData, setSaleData] = useState<InvoiceData | null>(null);
    const [storeSetting, setStoreSetting] = useState<StoreSetting | null>(null);
    const [activeLayout, setActiveLayout] = useState<string>("SURAT_JALAN");
    
    const { showToast } = useToast();
    
    // Ref ke iframe untuk keperluan download PDF
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (isOpen && saleId) {
            loadInvoiceData();
        } else {
            setSaleData(null);
            setHtmlContent("");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, saleId]);

    const loadInvoiceData = async () => {
        setIsLoading(true);

        try {
            // Ambil data sale dan store setting secara paralel
            const [saleResult, storeResult] = await Promise.all([
                getSaleById(saleId),
                getStoreSetting()
            ]);

            if (saleResult.success && saleResult.data) {
                const sale = saleResult.data as unknown as InvoiceData;
                setSaleData(sale);

                let setting: StoreSetting | null = null;
                if (storeResult.success && storeResult.data) {
                    setting = storeResult.data as StoreSetting;
                    setStoreSetting(setting);
                }

                const initialLayout = setting?.invoiceLayoutType || "SURAT_JALAN";
                setActiveLayout(initialLayout);

                const html = generateInvoiceHtml(sale, setting, { layoutType: initialLayout });
                setHtmlContent(html);
            } else {
                showToast(saleResult.error || "Gagal memuat invoice", "error");
            }
        } catch (error) {
            console.error(error);
            showToast("Terjadi kesalahan saat memuat data", "error");
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

    // Fungsi Download: Mengambil snapshot dari Iframe Preview
    const handleDownload = async () => {
        // Pastikan iframe dan isinya sudah siap
        if (!iframeRef.current || !iframeRef.current.contentDocument || !iframeRef.current.contentDocument.body || !saleData) return;

        setIsProcessingPdf(true);
        try {
            const iframeBody = iframeRef.current.contentDocument.body;

            // Gunakan html2canvas untuk 'memotret' isi iframe
            const canvas = await html2canvas(iframeBody, {
                scale: 2, 
                useCORS: true, 
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
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, imgHeight);
            const prefix = activeLayout === "SURAT_JALAN" ? "SuratJalan" : activeLayout === "FAKTUR_NCR" ? "Faktur" : "Invoice";
            pdf.save(`${prefix}-${saleData.invoiceNumber}.pdf`);
            
            showToast("PDF berhasil didownload!", "success");
        } catch (err) {
            console.error("Gagal membuat PDF:", err);
            showToast("Gagal mendownload PDF", "error");
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
                        <p className="text-sm text-gray-500">#{invoiceNumber}</p>
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

                    <div className="flex items-center gap-4 self-end sm:self-center">
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 p-1"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Preview Area (Menggunakan Iframe) */}
                <div className="flex-1 bg-gray-50 overflow-hidden relative">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                            <div className="text-center">
                                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                                <p className="text-sm text-gray-500 mt-2">Loading invoice details...</p>
                            </div>
                        </div>
                    ) : (
                        // Iframe ini menampilkan HTML yang digenerate oleh utils
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
                        disabled={isProcessingPdf || isLoading || !saleData}
                        className="flex-1 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessingPdf ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Memproses PDF...</span>
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
                        disabled={isLoading || !saleData}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                        <Printer className="w-4 h-4" />
                        <span>Print Invoice</span>
                    </button>
                </div>
            </div>
        </div>
    );
}