"use client";

import { useState, useRef } from "react";
import ReportLayout from "../_components/ReportLayout";
import ReportDownloadButton from "../_components/ReportDownloadButton";
import DebtsReportContent from "./_components/DebtsReportContent";
import { getDebtsReport } from "@/lib/actions/report.actions";
import { useReactToPrint } from 'react-to-print';

interface CustomerDebt {
  id: string;
  totalDebt: number;
  paidAmount: number;
  remainingDebt: number;
  dueDate: Date | string;
  status: string;
  customer: { name: string; phone: string | null };
  sale: { invoiceNumber: string };
}

interface SupplierDebt {
  id: string;
  totalDebt: number;
  paidAmount: number;
  remainingDebt: number;
  dueDate: Date | string;
  status: string;
  supplier: { name: string; phone: string | null };
  purchase: { invoiceNumber: string };
}

interface DebtSummary {
  totalDebt: number;
  totalPaid: number;
  totalRemaining: number;
  count: number;
}

interface DebtsReportData {
  customerDebts: CustomerDebt[];
  supplierDebts: SupplierDebt[];
  customerDebtSummary: DebtSummary;
  supplierDebtSummary: DebtSummary;
}

export default function DebtsReportPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<DebtsReportData | null>(null);

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const result = await getDebtsReport({});

      if (result.success && result.data) {
        setReportData(result.data as unknown as DebtsReportData);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Laporan-Piutang-Hutang-${new Date().toISOString().split('T')[0]}`,
    pageStyle: `
      @page { size: A4; margin: 10mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `
  });

  return (
    <ReportLayout
      title="Laporan Piutang & Hutang"
      description="Laporan piutang customer dan hutang supplier"
      onPrint={reportData ? handlePrint : undefined}
      isLoading={isLoading}
    >
      {reportData ? (
        <>
          <div className="mb-4 flex gap-3 justify-end print:hidden">
            <button onClick={handleGenerateReport} className="btn-secondary">
              Refresh Data
            </button>
            <ReportDownloadButton
              targetRef={printRef as React.RefObject<HTMLDivElement>}
              filename={`Laporan-Piutang-Hutang-${new Date().toISOString().split('T')[0]}`}
            />
          </div>

          <div ref={printRef}>
            <DebtsReportContent data={reportData} />
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Klik tombol di bawah untuk generate laporan</p>
          <button onClick={handleGenerateReport} className="btn-primary">
            Generate Laporan
          </button>
        </div>
      )}
    </ReportLayout>
  );
}