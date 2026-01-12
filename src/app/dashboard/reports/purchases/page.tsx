"use client";

import { useState, useRef } from "react";
import ReportLayout from "../_components/ReportLayout";
import DateRangeFilter from "../_components/DateRangeFilter";
import ReportDownloadButton from "../_components/ReportDownloadButton";
import PurchasesReportContent from "./_components/PurchasesReportContent";
import { getPurchasesReport } from "@/lib/actions/report.actions";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { useReactToPrint } from 'react-to-print';
interface PurchaseData {
  id: string;
  invoiceNumber: string;
  purchaseDate: Date | string;
  grandTotal: number;
  paidAmount: number;
  status: string;
  supplier: { name: string };
  admin: { name: string };
}

interface PurchasesSummary {
  totalPurchases: number;
  totalAmount: number;
  totalDiscount: number;
  totalPaid: number;
  totalUnpaid: number;
  supplierBreakdown: Record<string, number>;
}

interface PurchasesReportData {
  purchases: PurchaseData[];
  summary: PurchasesSummary;
}
export default function PurchasesReportPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<PurchasesReportData | null>(null);
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(today), "yyyy-MM-dd"));

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const result = await getPurchasesReport({
        dateFrom: new Date(dateFrom),
        dateTo: new Date(dateTo),
      });

      if (result.success && result.data) {
        setReportData(result.data as unknown as PurchasesReportData);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Laporan-Pembelian-${dateFrom}-${dateTo}`,
    pageStyle: `
      @page { size: A4; margin: 10mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `
  });

  return (
    <ReportLayout
      title="Laporan Pembelian"
      description="Laporan transaksi pembelian dari supplier"
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
          <div className="mb-4 flex justify-end print:hidden">
            <ReportDownloadButton
              targetRef={printRef as React.RefObject<HTMLDivElement>}
              filename={`Laporan-Pembelian-${dateFrom}-${dateTo}`}
            />
          </div>

          <div ref={printRef}>
            <PurchasesReportContent data={reportData} dateFrom={dateFrom} dateTo={dateTo} />
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