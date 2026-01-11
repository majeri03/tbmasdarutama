"use client";

import { useState, useEffect, useRef } from "react";
import { X, Printer, Download, Loader2 } from "lucide-react";
import { getSaleById } from "@/lib/actions/sale.actions";
import { formatCurrency } from "@/lib/utils/pos-helpers";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface SaleInvoicePDFProps {
  isOpen: boolean;
  onClose: () => void;
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
  } | null;
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

export function SaleInvoicePDF({ isOpen, onClose, saleId }: SaleInvoicePDFProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saleData, setSaleData] = useState<SaleData | null>(null);
  const [error, setError] = useState("");
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && saleId) {
      loadInvoiceData();
    } else {
      setSaleData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, saleId]);

  const loadInvoiceData = async () => {
    setIsLoading(true);
    setError("");
    setSaleData(null);

    try {
      const result = await getSaleById(saleId);
      if (result.success && result.data) {
        setSaleData(result.data as SaleData);
      } else {
        setError(result.error || "Gagal memuat invoice");
      }
    } catch {
      setError("Gagal memuat invoice");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    setIsPrinting(true);
    try {
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownload = async () => {
    if (!invoiceRef.current || !saleData) return;

    setIsPrinting(true);
    try {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const canvas = await html2canvas(invoiceRef.current, {
        scale: 3,
        logging: false,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: 1200,
        windowHeight: invoiceRef.current.scrollHeight,
      });

      document.body.style.overflow = originalOverflow;

      const imgData = canvas.toDataURL("image/png", 1.0);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: false,
      });

      const pdfWidth = 210;
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const x = 10;
      const y = 10;

      pdf.addImage(imgData, "PNG", x, y, imgWidth, imgHeight, undefined, "FAST");
      pdf.save(`Invoice-${saleData.invoiceNumber}.pdf`);
    } catch {
      setError("Gagal membuat PDF");
    } finally {
      setIsPrinting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:relative print:bg-white print:z-0">
        <div className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col print:max-h-none print:max-w-none print:shadow-none">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 print:hidden">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Invoice Preview</h2>
              <p className="text-sm text-gray-500">
                {saleData ? `#${saleData.invoiceNumber}` : "Loading..."}
              </p>
            </div>
            <button onClick={onClose} disabled={isPrinting} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Preview Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 print:p-0 print:bg-white print:overflow-visible">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 print:hidden">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="text-center py-8 print:hidden">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                <p className="text-sm text-gray-500 mt-2">Loading invoice details...</p>
              </div>
            ) : saleData ? (
              <div
                id="invoice-content"
                ref={invoiceRef}
                className="bg-white p-6 shadow-sm rounded-lg print:shadow-none print:rounded-none print:p-0"
                style={{
                  fontFamily: "Arial, sans-serif",
                  fontSize: "11px",
                  lineHeight: "1.7",
                }}
              >
                {/* Header */}
                <div className="border-2 border-black p-3 mb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h1 className="text-base font-bold mb-1">PT. TB MASDAR UTAMA</h1>
                      <p className="text-[10px]">Ruko Graha Arteri Mas</p>
                      <p className="text-[10px]">Jl. Panjang Blok 101 No.1, Jakarta 12233</p>
                      <p className="text-[10px]">Phone: (021) 58365578 (Hunting)</p>
                      <p className="text-[10px]">Fax: (021) 58453581</p>
                    </div>
                    <div className="text-right">
                      <h2 className="text-xl font-bold mb-1">INVOICE</h2>
                      <table className="text-[9px] ml-auto">
                        <tbody>
                          <tr>
                            <td className="pr-2 text-left">Number</td>
                            <td className="text-left">: {saleData.invoiceNumber}</td>
                          </tr>
                          <tr>
                            <td className="pr-2 text-left">Inv. Date</td>
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
                              :{" "}
                              {new Date(
                                new Date(saleData.saleDate).getTime() + 30 * 24 * 60 * 60 * 1000
                              ).toLocaleDateString("en-GB")}
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

                {/* Customer */}
                <div className="mb-3">
                  <div className="border border-black">
                    <div className="bg-gray-100 px-2 py-0.5 border-b border-black">
                      <p className="text-[10px] font-bold">Customer</p>
                    </div>
                    <div className="px-2 py-0.5">
                      <p className="text-[10px] font-bold">
                        {saleData.customer?.name || "Customer Umum"}
                      </p>
                      <p className="text-[9px]">Phone: {saleData.customer?.phone || "-"}</p>
                      <p className="text-[9px]">Address: {saleData.customer?.address || "-"}</p>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full border border-black mb-2 text-[10px]">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-black px-1 py-0.5 text-left w-6">No.</th>
                      <th className="border border-black px-1 py-0.5 text-left">Product Description</th>
                      <th className="border border-black px-1 py-0.5 text-center w-20">Quantity UOM</th>
                      <th className="border border-black px-1 py-0.5 text-right w-20">Unit Price</th>
                      <th className="border border-black px-1 py-0.5 text-right w-20">Gross Amt.</th>
                      <th className="border border-black px-1 py-0.5 text-center w-10">%</th>
                      <th className="border border-black px-1 py-0.5 text-right w-16">Discount</th>
                      <th className="border border-black px-1 py-0.5 text-right w-20">Net Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleData.saleItems.map((item, index) => {
                      const grossAmount = item.unitPrice * item.quantity;
                      const discountPercent =
                        item.discount > 0 ? ((item.discount / grossAmount) * 100).toFixed(0) : "0";

                      return (
                        <tr key={item.id}>
                          <td className="border border-black px-1 py-0.5 text-center">{index + 1}</td>
                          <td className="border border-black px-1 py-0.5">
                            <span className="font-semibold">{item.product.name}</span>
                            <br />
                            <span className="text-[8px] text-gray-600">{item.product.code}</span>
                          </td>
                          <td className="border border-black px-1 py-0.5 text-center">
                            {item.quantity} {item.unit.name}
                          </td>
                          <td className="border border-black px-1 py-0.5 text-right">
                            {formatCurrency(item.unitPrice).replace("Rp ", "").replace(/\s/g, "")}
                          </td>
                          <td className="border border-black px-1 py-0.5 text-right">
                            {formatCurrency(grossAmount).replace("Rp ", "").replace(/\s/g, "")}
                          </td>
                          <td className="border border-black px-1 py-0.5 text-center">
                            {discountPercent}%
                          </td>
                          <td className="border border-black px-1 py-0.5 text-right">
                            {formatCurrency(item.discount).replace("Rp ", "").replace(/\s/g, "")}
                          </td>
                          <td className="border border-black px-1 py-0.5 text-right font-semibold">
                            {formatCurrency(item.subtotal).replace("Rp ", "").replace(/\s/g, "")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Inwords + Totals */}
                <div className="flex gap-3 mb-3">
                  <div className="flex-1 border border-black p-3">
                    <p className="text-[9px] mb-1">
                      <strong>Inword:</strong> {numberToWords(Math.floor(saleData.grandTotal))} Rupiah
                    </p>
                    <p className="text-[9px]">
                      <strong>Remark:</strong>
                    </p>
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <p className="text-[9px] font-bold">TRANSFER VIA</p>
                      <p className="text-[9px]">BCA-IDR</p>
                      <p className="text-[9px]">A/C: 164-800-3321</p>
                      <p className="text-[9px]">A/N: PT. TB MASDAR UTAMA</p>
                    </div>
                    <div className="mt-3 text-center">
                      <p className="text-[9px] font-bold">{saleData.cashier.name}</p>
                    </div>
                  </div>

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
                            {formatCurrency(saleData.totalAmount - saleData.discount)
                              .replace("Rp ", "")
                              .replace(/\s/g, "")}
                          </td>
                        </tr>
                        <tr>
                          <td className="border-b border-black px-2 py-0.5">Tax</td>
                          <td className="border-b border-black px-2 py-0.5 text-right">
                            {formatCurrency(saleData.tax).replace("Rp ", "").replace(/\s/g, "")}
                          </td>
                        </tr>
                        <tr>
                          <td className="border-b border-black px-2 py-0.5">Freight Charge</td>
                          <td className="border-b border-black px-2 py-0.5 text-right">0.00</td>
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

                {/* Footer */}
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

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          html,
          body {
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 0;
            overflow: visible;
            background: white;
          }

          body * {
            visibility: hidden;
          }

          #invoice-content,
          #invoice-content * {
            visibility: visible;
          }

          #invoice-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 190mm;
            padding: 10mm;
            font-size: 11px !important;
          }

          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}