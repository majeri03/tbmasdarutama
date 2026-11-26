import ReportHeader from "../../_components/ReportHeader";
import ReportFooter from "../../_components/ReportFooter";
import ReportSummary, { ReportSectionTitle } from "../../_components/ReportSummary";
import type { ReportStoreInfo } from "../../_components/report-types";
import { formatDateWita } from "../../_components/report-datetime";
import { formatCurrency } from "@/lib/utils/pdf-helpers";

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

interface FinancialReportContentProps {
  data: {
    summary: FinancialSummary;
    store?: ReportStoreInfo | null;
  };
  dateFrom: string;
  dateTo: string;
}

export default function FinancialReportContent({ data, dateFrom, dateTo }: FinancialReportContentProps) {
  const { summary, store } = data;
  const period = `${formatDateWita(dateFrom)} - ${formatDateWita(dateTo)}`;

  return (
    <div id="print-content" className="bg-[#1C1917] print:bg-white p-8 min-h-[297mm] text-stone-100 print:text-stone-100 print:text-[#111111]">
      <ReportHeader
        title="Laporan Keuangan"
        period={period}
        storeName={store?.name}
        storeAddress={store?.address}
        storePhone={store?.phone}
      />

      <ReportSummary
        title="Pendapatan"
        items={[
          {
            label: "Total Penjualan",
            value: formatCurrency(summary.totalRevenue),
            note: `${summary.transactionCount} transaksi`,
          },
          { label: "Total Diskon", value: formatCurrency(summary.totalDiscount) },
          { label: "Pendapatan Bersih", value: formatCurrency(summary.netRevenue), strong: true },
        ]}
      />

      <ReportSummary
        title="Biaya & Laba"
        items={[
          { label: "HPP (COGS)", value: formatCurrency(summary.totalCOGS) },
          { label: "Laba Kotor", value: formatCurrency(summary.grossProfit) },
          { label: "Margin Laba", value: `${summary.grossProfitMargin.toFixed(2)}%` },
          { label: "Laba Bersih", value: formatCurrency(summary.netProfit) },
        ]}
      />

      <ReportSummary
        title="Pembelian"
        items={[
          {
            label: "Total Pembelian",
            value: formatCurrency(summary.totalPurchases),
            note: `${summary.purchaseCount} transaksi`,
          },
          {
            label: "Selisih (Revenue - Purchase)",
            value: formatCurrency(summary.totalRevenue - summary.totalPurchases),
          },
        ]}
      />

      {/* Summary Table */}
      <div className="mt-8 border-t-2 border-white/40 print:border-[#111111] pt-6">
        <ReportSectionTitle>Ringkasan Keuangan</ReportSectionTitle>
        <table className="w-full">
          <tbody className="text-base">
            <tr className="border-b border-white/10 print:border-gray-200 even:bg-white/[0.04] print:even:bg-[#FAFAFA]">
              <td className="py-3 px-4 font-semibold">Total Pendapatan Kotor</td>
              <td className="py-3 px-4 text-right font-bold tabular-nums">{formatCurrency(summary.totalRevenue)}</td>
            </tr>
            <tr className="border-b border-white/10 print:border-gray-200 even:bg-white/[0.04] print:even:bg-[#FAFAFA]">
              <td className="py-3 px-4 pl-8 text-stone-400 print:text-[#6B7280]">- Diskon</td>
              <td className="py-3 px-4 text-right tabular-nums">({formatCurrency(summary.totalDiscount)})</td>
            </tr>
            <tr className="border-b border-white/10 print:border-gray-200 font-semibold even:bg-white/[0.04] print:even:bg-[#FAFAFA]">
              <td className="py-3 px-4">Pendapatan Bersih</td>
              <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(summary.netRevenue)}</td>
            </tr>
            <tr className="border-b border-white/10 print:border-gray-200 even:bg-white/[0.04] print:even:bg-[#FAFAFA]">
              <td className="py-3 px-4 pl-8 text-stone-400 print:text-[#6B7280]">- HPP (COGS)</td>
              <td className="py-3 px-4 text-right tabular-nums">({formatCurrency(summary.totalCOGS)})</td>
            </tr>
            <tr className="border-b-2 border-white/40 print:border-[#111111] font-semibold even:bg-[#FAFAFA]">
              <td className="py-3 px-4">Laba Kotor</td>
              <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(summary.grossProfit)}</td>
            </tr>
            <tr className="border-t-2 border-white/40 print:border-[#111111] font-bold text-lg">
              <td className="py-4 px-4">LABA BERSIH</td>
              <td className="report-total-red py-4 px-4 text-right tabular-nums text-[#E5484D] print:text-red-900">{formatCurrency(summary.netProfit)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <ReportFooter storeName={store?.name ?? undefined} />
    </div>
  );
}
