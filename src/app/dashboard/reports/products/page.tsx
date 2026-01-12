"use client";

import { useState, useRef } from "react";
import ReportLayout from "../_components/ReportLayout";
import ReportDownloadButton from "../_components/ReportDownloadButton";
import ProductsReportContent from "./_components/ProductsReportContent";
import { getProductListReport } from "@/lib/actions/report.actions";
import { useReactToPrint } from 'react-to-print';

interface ProductUnit {
  buyPrice: number;
  sellPrice: number;
  unit: { name: string };
}

interface ProductData {
  id: string;
  code: string;
  name: string;
  description: string | null;
  currentStock: number;
  minStock: number;
  category: { name: string };
  subCategory: { name: string } | null;
  supplier: { name: string };
  productUnits: ProductUnit[];
  productImages: Array<{ imageUrl: string }>;
}

interface ProductsReportData {
  products: ProductData[];
}

export default function ProductsReportPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<ProductsReportData | null>(null);

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const result = await getProductListReport({});

      if (result.success && result.data) {
        setReportData(result.data as unknown as ProductsReportData);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Daftar-Produk-${new Date().toISOString().split('T')[0]}`,
    pageStyle: `
      @page { size: A4; margin: 10mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .break-inside-avoid { page-break-inside: avoid; }
      }
    `
  });

  return (
    <ReportLayout
      title="Daftar Produk"
      description="Katalog lengkap produk dengan harga dan stok"
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
              filename={`Daftar-Produk-${new Date().toISOString().split('T')[0]}`}
            />
          </div>

          <div ref={printRef}>
            <ProductsReportContent data={reportData} />
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Klik tombol di bawah untuk generate katalog produk</p>
          <button onClick={handleGenerateReport} className="btn-primary">
            Generate Katalog
          </button>
        </div>
      )}
    </ReportLayout>
  );
}