"use client";

import { useState, useRef } from "react";
import ReportLayout from "../_components/ReportLayout";
import ReportDownloadButton from "../_components/ReportDownloadButton";
import InventoryReportContent from "./_components/InventoryReportContent";
import { getInventoryReport } from "@/lib/actions/report.actions";
import { useReactToPrint } from 'react-to-print';

// Tambah setelah import
interface ProductData {
    id: string;
    code: string;
    name: string;
    currentStock: number;
    minStock: number;
    category: { name: string };
    subCategory: { name: string } | null;
    supplier: { name: string };
    productUnits: Array<{
        buyPrice: number;
        sellPrice: number;
        unit: { name: string };
    }>;
}

interface InventorySummary {
    totalProducts: number;
    totalStockValue: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    categoriesBreakdown: Record<string, number>;
}

interface InventoryReportData {
    products: ProductData[];
    summary: InventorySummary;
}

export default function InventoryReportPage() {
    const printRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [reportData, setReportData] = useState<InventoryReportData | null>(null);

    const handleGenerateReport = async () => {
        setIsLoading(true);
        try {
            const result = await getInventoryReport({});

            if (result.success && result.data) {
                setReportData(result.data as unknown as InventoryReportData);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Laporan-Inventory-${new Date().toISOString().split('T')[0]}`,
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
            title="Laporan Stok Inventory"
            description="Laporan stok produk dan nilai inventory"
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
                            filename={`Laporan-Inventory-${new Date().toISOString().split('T')[0]}`}
                        />
                    </div>

                    <div ref={printRef}>
                        <InventoryReportContent data={reportData} />
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