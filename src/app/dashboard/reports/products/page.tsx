"use client";

import { useState, useRef } from "react";
import ReportLayout from "../_components/ReportLayout";
import ReportDownloadButton from "../_components/ReportDownloadButton";
import ProductsReportContent from "./_components/ProductsReportContent";
import { getProductListReport } from "@/lib/actions/report.actions";
import type { ReportStoreInfo } from "../_components/report-types";
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
  category: { name: string } | null;
  subCategory: { name: string } | null;
  supplier: { name: string } | null;
  productUnits: ProductUnit[];
  productImages: Array<{ imageUrl: string }>;
}

interface ProductsReportData {
  products: ProductData[];
  store?: ReportStoreInfo | null;
}

export default function ProductsReportPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<ProductsReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getProductListReport({});

      if (result.success && result.data) {
        setReportData(result.data as unknown as ProductsReportData);
      } else {
        setError(result.error || "Gagal mengambil data daftar produk");
      }
    } catch (error) {
      console.error(error);
      setError("Terjadi kesalahan saat mengambil data katalog");
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
            <button onClick={handleGenerateReport} className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-stone-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
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
          <p className="text-stone-400 mb-4">Klik tombol di bawah untuk generate katalog produk</p>
          <button onClick={handleGenerateReport} className="inline-flex items-center gap-2 rounded-lg bg-[#7F1D1D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#991B1B] disabled:cursor-not-allowed disabled:opacity-50">
            Generate Katalog
          </button>
          {error && (
            <p className="mt-4 text-sm text-[#E5484D]">{error}</p>
          )}
        </div>
      )}
    </ReportLayout>
  );
}