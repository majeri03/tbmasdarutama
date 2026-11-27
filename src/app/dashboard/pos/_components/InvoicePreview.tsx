"use client";

import { useState, useEffect, useRef } from "react";
import { X, Printer, Download, Loader2, Bluetooth } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { getSaleById } from "@/lib/actions/sale.actions";
import { getStoreSetting } from "@/lib/actions/store-setting.actions";
import { 
  printInvoice, 
  generateInvoiceHtml, 
  InvoiceData, 
  StoreSetting 
} from "@/lib/utils/invoice-printer";
import {
  isWebBluetoothSupported,
  printThermalReceipt,
} from "@/lib/utils/bluetooth-printer";
import { ShareInvoiceWhatsApp } from "@/app/dashboard/sales/_components/ShareInvoiceWhatsApp";

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
    const [isPrintingThermal, setIsPrintingThermal] = useState(false);
    const [htmlContent, setHtmlContent] = useState<string>("");
    
    // State data menggunakan tipe dari utils
    const [saleData, setSaleData] = useState<InvoiceData | null>(null);
    const [storeSetting, setStoreSetting] = useState<StoreSetting | null>(null);
    const [activeLayout, setActiveLayout] = useState<string>("SURAT_JALAN");
    
    const { showToast } = useToast();
    
    // Ref ke iframe untuk keperluan download PDF
    const iframeRef = useRef<HTMLIFrameElement>(null);
    // Ref + ukuran area preview — dipakai untuk fit-to-width: iframe dirender
    // selebar desktop (850px untuk A4 / 320px untuk struk) lalu diperkecil
    // dengan transform scale supaya muat di layar HP tanpa overflow horizontal.
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

    // Cetak struk ke printer thermal via Web Bluetooth (Chrome/Edge).
    const handleThermalPrint = async () => {
        if (!saleData) return;
        if (!isWebBluetoothSupported()) {
            showToast("Browser ini tidak mendukung Web Bluetooth. Pakai Chrome/Edge terbaru.", "error");
            return;
        }
        setIsPrintingThermal(true);
        try {
            await printThermalReceipt(saleData, storeSetting);
            showToast("Struk dikirim ke printer thermal", "success");
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Gagal mencetak ke printer thermal";
            // Batal pilih perangkat (NotFoundError) bukan error — diam saja.
            if (err instanceof DOMException && err.name === "NotFoundError") {
                // pengguna menutup pemilih perangkat
            } else {
                showToast(message, "error");
            }
        } finally {
            setIsPrintingThermal(false);
        }
    };

    // Fungsi Download: snapshot iframe lalu ekspor ke PDF A4 multi-halaman.
    // Invoice panjang TIDAK LAGI terpotong jadi satu gambar — tiap halaman A4
    // penuh lanjut ke halaman berikutnya.
    const handleDownload = async () => {
        // Pastikan iframe dan isinya sudah siap
        if (!iframeRef.current || !iframeRef.current.contentDocument || !iframeRef.current.contentDocument.body || !saleData) return;

        setIsProcessingPdf(true);
        try {
            const iframeBody = iframeRef.current.contentDocument.body;
            const isThermal = activeLayout === "STRUK_KECIL";

            // windowWidth selebar desktop supaya hasil PDF di HP sama dengan di desktop.
            const canvas = await html2canvas(iframeBody, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: "#ffffff",
                windowWidth: isThermal ? 320 : 850,
            });

            // OPT-C (23 Nov 2026): JPEG q0.85, bukan PNG — PDF 1 halaman
            // turun dari ~8,5 MB jadi ratusan KB. Teks tetap tajam karena scale 2.
            const imgData = canvas.toDataURL("image/jpeg", 0.85);

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
                const prefix = activeLayout === "SURAT_JALAN" ? "SuratJalan" : activeLayout === "FAKTUR_NCR" ? "Faktur" : "Invoice";
                pdf.save(`${prefix}-${saleData.invoiceNumber}.pdf`);
            }

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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
            <div className="glass-card w-full max-w-4xl h-[92dvh] sm:h-[90vh] flex flex-col bg-[#1C1917] rounded-lg shadow-xl overflow-hidden">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-white/10 bg-[#1C1917] gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-stone-100">Invoice Preview</h2>
                        <p className="text-sm text-stone-400">#{invoiceNumber}</p>
                    </div>

                    {/* Format Selector Pills */}
                    <div className="flex items-center gap-1.5 bg-white/[0.07] p-1 rounded-lg overflow-x-auto">
                        <button
                            type="button"
                            onClick={() => handleLayoutChange("SURAT_JALAN")}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                                activeLayout === "SURAT_JALAN"
                                    ? "bg-[#7F1D1D] text-white shadow-sm"
                                    : "text-stone-400 hover:text-stone-100"
                            }`}
                        >
                            Surat Jalan
                        </button>
                        <button
                            type="button"
                            onClick={() => handleLayoutChange("INVOICE_BESAR")}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                                activeLayout === "INVOICE_BESAR"
                                    ? "bg-[#7F1D1D] text-white shadow-sm"
                                    : "text-stone-400 hover:text-stone-100"
                            }`}
                        >
                            Invoice Besar (A4)
                        </button>
                        <button
                            type="button"
                            onClick={() => handleLayoutChange("FAKTUR_NCR")}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                                activeLayout === "FAKTUR_NCR"
                                    ? "bg-[#7F1D1D] text-white shadow-sm"
                                    : "text-stone-400 hover:text-stone-100"
                            }`}
                        >
                            Faktur NCR
                        </button>
                        <button
                            type="button"
                            onClick={() => handleLayoutChange("STRUK_KECIL")}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                                activeLayout === "STRUK_KECIL"
                                    ? "bg-[#7F1D1D] text-white shadow-sm"
                                    : "text-stone-400 hover:text-stone-100"
                            }`}
                        >
                            Struk (58mm)
                        </button>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-center">
                        <button
                            onClick={onClose}
                            className="text-stone-400 hover:text-stone-200 p-1"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Peringatan kalau data toko belum diisi di Pengaturan */}
                {storeSetting && !storeSetting.name?.trim() && !isLoading && (
                    <div className="px-4 py-2 bg-[#FBBF24]/10 border-b border-[#FBBF24]/25 text-xs text-[#FBBF24]">
                        Data toko belum diisi — lengkapi nama, alamat &amp; rekening di Pengaturan agar invoice menampilkan data toko yang benar.
                    </div>
                )}

                {/* Preview Area (Menggunakan Iframe) */}
                {/* WS-5 (27 Nov 2026): area preview faktur WAJIB putih —
                    dulu bg putih 4% di atas modal gelap, jadi faktur
                    terlihat hitam di HP. */}
                <div className="flex-1 bg-white overflow-auto relative" ref={previewWrapRef}>
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/85 z-10">
                            <div className="text-center">
                                <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#E5484D]" />
                                <p className="text-sm text-stone-500 mt-2">Loading invoice details...</p>
                            </div>
                        </div>
                    ) : (
                        // Iframe ini menampilkan HTML yang digenerate oleh utils.
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
                <div className="p-4 border-t border-white/10 flex flex-wrap gap-2 bg-[#1C1917]">
                    <button
                        onClick={handleThermalPrint}
                        disabled={isPrintingThermal || isLoading || !saleData}
                        className="flex-1 px-4 py-3 border border-white/15 rounded-lg hover:bg-white/[0.07] text-stone-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Cetak struk ke printer thermal Bluetooth (Chrome/Edge)"
                    >
                        {isPrintingThermal ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Mengirim...</span>
                            </>
                        ) : (
                            <>
                                <Bluetooth className="w-4 h-4" />
                                <span>Thermal (Bluetooth)</span>
                            </>
                        )}
                    </button>
                    {saleData && (
                        <ShareInvoiceWhatsApp
                            saleId={saleId}
                            label="WhatsApp"
                            className="flex-1 px-4 py-3 border border-white/15 rounded-lg hover:bg-white/[0.07] transition-colors flex items-center justify-center gap-2 text-[#4ADE80]"
                        />
                    )}
                    <button
                        onClick={handleDownload}
                        disabled={isProcessingPdf || isLoading || !saleData}
                        className="flex-1 px-4 py-3 border border-white/15 rounded-lg hover:bg-white/[0.07] text-stone-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className="flex-1 px-4 py-3 bg-[#7F1D1D] text-white rounded-lg hover:bg-[#991B1B] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                        <Printer className="w-4 h-4" />
                        <span>Print Invoice</span>
                    </button>
                </div>
            </div>
        </div>
    );
}