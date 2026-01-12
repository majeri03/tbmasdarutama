"use client";

import { useState, useRef } from "react";
import ReportLayout from "../_components/ReportLayout";
import DateRangeFilter from "../_components/DateRangeFilter";
import ReportDownloadButton from "../_components/ReportDownloadButton";
import SalesReportContent from "./_components/SalesReportContent";
import { getSalesReport } from "@/lib/actions/report.actions";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { useReactToPrint } from 'react-to-print';
// Import types from SalesReportContent
interface SaleData {
    id: string;
    invoiceNumber: string;
    saleDate: Date | string;
    grandTotal: number | string;
    paymentMethod: string;
    customer: { name: string } | null;
    cashier: { name: string } | null;
}

interface SalesSummary {
    totalTransactions: number;
    totalRevenue: number;
    totalDiscount: number;
    totalTax: number;
    paymentMethods: Record<string, number>;
}

interface SalesReportData {
    sales: SaleData[];
    summary: SalesSummary;
}

export default function SalesReportPage() {
    const printRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [reportData, setReportData] = useState<SalesReportData | null>(null);

    const today = new Date();
    const [dateFrom, setDateFrom] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
    const [dateTo, setDateTo] = useState(format(endOfMonth(today), "yyyy-MM-dd"));

    const handleGenerateReport = async () => {
        setIsLoading(true);
        try {
            const result = await getSalesReport({
                dateFrom: new Date(dateFrom),
                dateTo: new Date(dateTo),
            });

            if (result.success && result.data) {
                setReportData(result.data as unknown as SalesReportData);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Laporan-Penjualan-${dateFrom}-${dateTo}`,
        pageStyle: `
    @page {
      size: A4;
      margin: 10mm;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `
    });

    return (
        <ReportLayout
            title="Laporan Penjualan"
            description="Laporan transaksi penjualan berdasarkan periode"
            filters={
                <DateRangeFilter
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onDateFromChange={setDateFrom}
                    onDateToChange={setDateTo}
                    onApply={handleGenerateReport}
                />
            }
            onPrint={reportData ? handlePrint : undefined}
            isLoading={isLoading}
        >
            {reportData ? (
                <>
                    {/* Download Button */}
                    <div className="mb-4 flex justify-end print:hidden">
                        <ReportDownloadButton
                            targetRef={printRef as React.RefObject<HTMLDivElement>}
                            filename={`Laporan-Penjualan-${dateFrom}-${dateTo}`}
                        />
                    </div>

                    {/* Report Content */}
                    <div ref={printRef}>
                        <SalesReportContent data={reportData} dateFrom={dateFrom} dateTo={dateTo} />
                    </div>
                </>
            ) : (
                <div className="text-center py-12">
                    <p className="text-gray-500">Pilih periode dan klik Tampilkan untuk generate laporan</p>
                </div>
            )}
        </ReportLayout>
    );
}