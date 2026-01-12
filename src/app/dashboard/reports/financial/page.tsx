"use client";

import { useState, useRef } from "react";
import ReportLayout from "../_components/ReportLayout";
import DateRangeFilter from "../_components/DateRangeFilter";
import ReportDownloadButton from "../_components/ReportDownloadButton";
import FinancialReportContent from "./_components/FinancialReportContent";
import { getFinancialReport } from "@/lib/actions/report.actions";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { useReactToPrint } from 'react-to-print';

interface FinancialSummary {
  totalRevenue: number;
  totalDiscount: number;
  netRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  grossProfitMargin: number;
  totalPurchases: number;
  netProfit: number;
  transactionCount: number;
  purchaseCount: number;
}

interface FinancialReportData {
  summary: FinancialSummary;
}

export default function FinancialReportPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<FinancialReportData | null>(null);

  const today = new Date();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(today), "yyyy-MM-dd"));

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const result = await getFinancialReport({
        dateFrom: new Date(dateFrom),
        dateTo: new Date(dateTo),
      });

      if (result.success && result.data) {
        setReportData(result.data as unknown as FinancialReportData);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Laporan-Keuangan-${dateFrom}-${dateTo}`,
    pageStyle: `
      @page { size: A4; margin: 10mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `
  });

  return (
    <ReportLayout
      title="Laporan Keuangan"
      description="Laporan laba rugi dan analisis keuangan"
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
              filename={`Laporan-Keuangan-${dateFrom}-${dateTo}`}
            />
          </div>

          <div ref={printRef}>
            <FinancialReportContent data={reportData} dateFrom={dateFrom} dateTo={dateTo} />
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