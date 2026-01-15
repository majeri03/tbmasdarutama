"use client";
import { getStoreSetting } from "@/lib/actions/store-setting.actions";
import { useState, useEffect, useRef } from "react";
import { X, Printer, Download, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { getSaleById } from "@/lib/actions/sale.actions";
import { formatCurrency } from "@/lib/utils/pos-helpers";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Image from "next/image";
import { StoreSetting } from "@prisma/client";
interface InvoicePreviewProps {
    isOpen: boolean;
    onClose: () => void;
    invoiceNumber: string;
    saleId: string;
}

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

// ✅ Helper: Convert number to words (Indonesian)
function numberToWords(num: number): string {
    const ones = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan"];
    const teens = ["Sepuluh", "Sebelas", "Dua Belas", "Tiga Belas", "Empat Belas", "Lima Belas", "Enam Belas", "Tujuh Belas", "Delapan Belas", "Sembilan Belas"];
    const tens = ["", "", "Dua Puluh", "Tiga Puluh", "Empat Puluh", "Lima Puluh", "Enam Puluh", "Tujuh Puluh", "Delapan Puluh", "Sembilan Puluh"];

    if (num === 0) return "Nol";
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? " " + ones[num % 10] : "");
    if (num < 1000) {
        const hundred = Math.floor(num / 100);
        const rest = num % 100;
        return (hundred === 1 ? "Seratus" : ones[hundred] + " Ratus") + (rest !== 0 ? " " + numberToWords(rest) : "");
    }
    if (num < 1000000) {
        const thousand = Math.floor(num / 1000);
        const rest = num % 1000;
        return (thousand === 1 ? "Seribu" : numberToWords(thousand) + " Ribu") + (rest !== 0 ? " " + numberToWords(rest) : "");
    }
    if (num < 1000000000) {
        const million = Math.floor(num / 1000000);
        const rest = num % 1000000;
        return numberToWords(million) + " Juta" + (rest !== 0 ? " " + numberToWords(rest) : "");
    }
    return "Angka terlalu besar";
}

export function InvoicePreview({ isOpen, onClose, invoiceNumber, saleId }: InvoicePreviewProps) {
    const [isPrinting, setIsPrinting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [saleData, setSaleData] = useState<SaleData | null>(null);
    const { showToast } = useToast();
    const invoiceRef = useRef<HTMLDivElement>(null);
    const [storeSetting, setStoreSetting] = useState<StoreSetting | null>(null);
    useEffect(() => {
        if (isOpen && saleId) {
            const loadInvoiceData = async () => {
                setIsLoading(true);

                // Ambil data sale dan store setting secara paralel
                const [saleResult, storeResult] = await Promise.all([
                    getSaleById(saleId),
                    getStoreSetting()
                ]);

                if (saleResult.success && saleResult.data) {
                    setSaleData(saleResult.data as SaleData);
                } else {
                    showToast(saleResult.error || "Gagal memuat invoice", "error");
                }

                if (storeResult.success && storeResult.data) {
                    setStoreSetting(storeResult.data);
                }

                setIsLoading(false);
            };

            loadInvoiceData();
        } else {
            setSaleData(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, saleId]);

    if (!isOpen) return null;

    const handlePrint = () => {
        const printContent = document.getElementById('invoice-content');
        if (!printContent) return;

        // Buka jendela baru
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        // Tulis HTML dan CSS yang bersih ke jendela baru
        printWindow.document.write(`
        <html>
            <head>
                <title>Print Invoice - ${invoiceNumber}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    @page { size: A4 portrait; margin: 10mm; }
                    body { background: white !important; padding: 0; margin: 0; }
                    #invoice-content { width: 100%; border: none !important; box-shadow: none !important; }
                    table { border-collapse: collapse !important; }
                    th, td { border: 1px solid black !important;}
                    .print-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <div class="p-4">
                    ${printContent.innerHTML}
                </div>
                <script>
                    // Tunggu Tailwind selesai memproses class sebelum print
                    window.onload = function() {
                        setTimeout(() => {
                            window.print();
                            window.close(); // Otomatis menutup tab dan kembali ke asal
                        }, 500);
                    };
                </script>
            </body>
        </html>
    `);
        printWindow.document.close();
    };

    const handleDownload = async () => {
        if (!invoiceRef.current || !saleData) return;
        setIsPrinting(true);
        try {
            const canvas = await html2canvas(invoiceRef.current, {
                scale: 3, // Agar gambar PDF tajam (tidak pecah)
                useCORS: true,
                backgroundColor: '#ffffff',
            });

            const imgData = canvas.toDataURL("image/png", 1.0);
            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4",
            });

            const imgWidth = 190; // Lebar A4 (210mm) dikurang margin
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
            pdf.save(`Invoice-${saleData.invoiceNumber}.pdf`);
            showToast("PDF berhasil didownload!", "success");
        } catch {
            showToast("Gagal membuat PDF", "error");
        } finally {
            setIsPrinting(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col ">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 print:hidden">
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
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50 print:overflow-visible print:p-0 print:bg-white">
                        {isLoading ? (
                            <div className="text-center py-8 print:hidden">
                                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                                <p className="text-sm text-gray-500 mt-2">Loading invoice details...</p>
                            </div>
                        ) : saleData ? (
                            <div
                                id="invoice-content"
                                ref={invoiceRef}
                                className="bg-white shadow-sm rounded-lg print:shadow-none print:rounded-none"
                                style={{
                                    fontFamily: 'Arial, sans-serif',
                                    fontSize: '12px',
                                    lineHeight: '1.3',
                                    width: '210mm', // A4 width
                                    minHeight: '297mm', // A4 height
                                    margin: '0 auto',
                                    padding: '10mm', // Sama dengan margin @page
                                    boxSizing: 'border-box'
                                }}
                            >
                                {/* ==================== HEADER ==================== */}
                                <div className="border-2 border-black p-3 mb-3">
                                    <div className="flex justify-between items-start">
                                        {/* Company Info + Logo */}
                                        <div className="flex gap-3">
                                            {storeSetting?.logoUrl && (
                                                <div className="relative w-12 h-12">
                                                    <Image
                                                        src={storeSetting.logoUrl}
                                                        alt="Logo Toko"
                                                        fill
                                                        className="object-contain"
                                                        unoptimized // Tambahkan ini jika logo berasal dari URL eksternal/upload
                                                    />
                                                </div>
                                            )}
                                            <div>
                                                <h1 className="text-base font-bold mb-1 uppercase">
                                                    {storeSetting?.name || "PT. TB MASDAR UTAMA"}
                                                </h1>
                                                <p className="text-[10px] max-w-[250px]">
                                                    {storeSetting?.address || "Alamat belum diatur"}
                                                    {storeSetting?.city && `, ${storeSetting.city}`}
                                                    {storeSetting?.postalCode && ` ${storeSetting.postalCode}`}
                                                </p>
                                                <p className="text-[10px]">
                                                    Phone: {storeSetting?.phone || "-"}
                                                    {storeSetting?.email && ` | Email: ${storeSetting.email}`}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Invoice Info */}
                                        <div className="text-right">
                                            <h2 className="text-xl font-bold mb-2">INVOICE</h2>
                                            <table className="text-[9px] ml-auto border-collapse">
                                                <tbody>
                                                    <tr>
                                                        <td className="pr-2 text-left">Number</td>
                                                        <td className="text-left">: {saleData.invoiceNumber}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="pr-3 text-left font-semibold">Inv. Date</td>
                                                        <td className="text-left">
                                                            : {new Date(saleData.saleDate).toLocaleDateString("en-GB")}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td className="pr-2 text-left">Payment Term</td>
                                                        <td className="text-left">: {saleData.paymentMethod}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="pr-2 text-left">Due Date</td>
                                                        <td className="text-left">
                                                            : {new Date(new Date(saleData.saleDate).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB")}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td className="pr-2 text-left">Salesman</td>
                                                        <td className="text-left">: {saleData.cashier.name}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="pr-2 text-left">Currency</td>
                                                        <td className="text-left">: IDR</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* ==================== CUSTOMER INFO ==================== */}
                                <div className="mb-3 border border-black">
                                    <div className="bg-gray-100 px-2 py-1 border-b border-black">
                                        <p className="text-[10px] font-bold">Customer</p>
                                    </div>
                                    <div className="px-2 py-1">
                                        <p className="text-[10px] font-bold">{saleData.customer.name}</p>
                                        <p className="text-[9px]">Phone: {saleData.customer.phone || "-"}</p>
                                        <p className="text-[9px]">Address: {saleData.customer.address || "-"}</p>
                                    </div>
                                </div>

                                {/* ==================== ITEMS TABLE ==================== */}
                                <table className="w-full border-collapse border-black mb-2 text-[11px]">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="border border-black px-2 py-1.5 text-left w-8">No.</th>
                                            <th className="border border-black px-2 py-1.5 text-left">Product Description</th>
                                            <th className="border border-black px-2 py-1.5 text-center w-20">Quantity UOM</th>
                                            <th className="border border-black px-2 py-1.5 text-right w-20">Unit Price</th>
                                            <th className="border border-black px-2 py-1.5 text-right w-20">Gross Amt.</th>
                                            <th className="border border-black px-2 py-1.5 text-center w-10">%</th>
                                            <th className="border border-black px-2 py-1.5 text-right w-16">Discount</th>
                                            <th className="border border-black px-2 py-1.5 text-right w-20">Net Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {saleData.saleItems.map((item, index) => {
                                            const grossAmount = item.unitPrice * item.quantity;
                                            const discountPercent = item.discount > 0
                                                ? ((item.discount / grossAmount) * 100).toFixed(0)
                                                : "0";

                                            return (
                                                <tr key={item.id}>
                                                    <td className="border border-black   text-center">{index + 1}</td>
                                                    <td className="border border-black  ">
                                                        <span className="font-semibold">{item.product.name}</span>
                                                    </td>
                                                    <td className="border border-black  text-center">
                                                        {item.quantity} {item.unit.name}
                                                    </td>
                                                    <td className="border border-black   text-center">
                                                        {formatCurrency(item.unitPrice).replace("Rp ", "").replace(/\s/g, "")}
                                                    </td>
                                                    <td className="border border-black text-center">
                                                        {formatCurrency(grossAmount).replace("Rp ", "").replace(/\s/g, "")}
                                                    </td>
                                                    <td className="border border-black  py-0.5 text-center">
                                                        {discountPercent}%
                                                    </td>
                                                    <td className="border border-black py-0.5 text-center">
                                                        {formatCurrency(item.discount).replace("Rp ", "").replace(/\s/g, "")}
                                                    </td>
                                                    <td className="border border-black  py-0.5 text-center font-semibold">
                                                        {formatCurrency(item.subtotal).replace("Rp ", "").replace(/\s/g, "")}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {/* ==================== INWORDS + TOTALS ==================== */}
                                <div className="flex gap-3 mb-3">
                                    {/* Left: Inwords */}
                                    <div className="flex-1 border border-black p-3">
                                        <p className="text-[9px] mb-1">
                                            <strong>Inword:</strong> {numberToWords(Math.floor(saleData.grandTotal))} Rupiah
                                        </p>
                                        <p className="text-[9px]"><strong>Remark:</strong></p>
                                        <div className="mt-3 pt-3 border-t border-gray-300">
                                            <p className="text-[9px] font-bold uppercase">TRANSFER VIA</p>
                                            {storeSetting?.bankName ? (
                                                <>
                                                    <p className="text-[9px]">{storeSetting.bankName}</p>
                                                    <p className="text-[9px]">A/C: {storeSetting.bankAccount || "-"}</p>
                                                    <p className="text-[9px]">A/N: {storeSetting.bankHolder || "-"}</p>
                                                </>
                                            ) : (
                                                <p className="text-[9px] text-gray-500 italic">Informasi bank belum diatur</p>
                                            )}
                                        </div>
                                        <div className="mt-6 pt-4 border-t border-gray-300 text-center">
                                            <p className="text-[9px] font-bold">{saleData.cashier.name}</p>
                                        </div>
                                    </div>

                                    {/* Right: Totals */}
                                    <div className="w-64 border border-black">
                                        <table className="w-full text-[9px]">
                                            <tbody>
                                                <tr>
                                                    <td className="border-b border-black px-2 py-0.5">Gross Total</td>
                                                    <td className="border-b border-black px-2 py-0.5 text-right font-semibold">
                                                        {formatCurrency(saleData.totalAmount).replace("Rp ", "").replace(/\s/g, "")}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="border-b border-black px-2 py-0.5">Discount Total</td>
                                                    <td className="border-b border-black px-2 py-0.5 text-right">
                                                        {formatCurrency(saleData.discount).replace("Rp ", "").replace(/\s/g, "")}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="border-b border-black px-2 py-0.5 font-bold">Down Payment</td>
                                                    <td className="border-b border-black px-2 py-0.5 text-right font-bold">
                                                        {formatCurrency(saleData.totalAmount - saleData.discount).replace("Rp ", "").replace(/\s/g, "")}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="border-b border-black px-2 py-0.5">Tax</td>
                                                    <td className="border-b border-black px-2 py-0.5 text-right">
                                                        {formatCurrency(saleData.tax).replace("Rp ", "").replace(/\s/g, "")}
                                                    </td>
                                                </tr>

                                                <tr className="bg-gray-100">
                                                    <td className="border-b border-black px-2 py-0.5 font-bold">Net Total</td>
                                                    <td className="border-b border-black px-2 py-0.5 text-right font-bold text-[11px]">
                                                        {formatCurrency(saleData.grandTotal).replace("Rp ", "").replace(/\s/g, "")}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* ==================== FOOTER ==================== */}
                                <div className="text-center text-[9px] border-t-2 border-black pt-1">
                                    <p className="font-bold">
                                        PEMBAYARAN DENGAN CHEQUE BG DIANGGAP LUNAS, APABILA SUDAH DAPAT DIUANGKAN
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-gray-500 py-8 print:hidden">Data invoice tidak tersedia</p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="p-4 border-t border-gray-200 flex gap-2 print:hidden">
                        <button
                            onClick={handleDownload}
                            disabled={isPrinting || isLoading || !saleData}
                            className="flex-1 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download className="w-4 h-4" />
                            <span>Download PDF</span>
                        </button>
                        <button
                            onClick={handlePrint}
                            disabled={isPrinting || isLoading || !saleData}
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