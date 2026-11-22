import ReportHeader from "../../_components/ReportHeader";
import ReportFooter from "../../_components/ReportFooter";
import ReportSummary, { ReportSectionTitle } from "../../_components/ReportSummary";
import { formatCurrency, formatDate } from "@/lib/utils/pdf-helpers";

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

interface SalesReportContentProps {
  data: {
    sales: SaleData[];
    summary: SalesSummary;
  };
  dateFrom: string;
  dateTo: string;
}

export default function SalesReportContent({ data, dateFrom, dateTo }: SalesReportContentProps) {
  const { sales, summary } = data;
  const period = `${formatDate(dateFrom)} - ${formatDate(dateTo)}`;

  return (
    <div id="print-content" className="bg-white p-8 min-h-[297mm] text-[#111111]">
      <ReportHeader title="Laporan Penjualan" period={period} />

      <ReportSummary
        title="Ringkasan"
        items={[
          { label: "Total Transaksi", value: String(summary.totalTransactions) },
          { label: "Total Pendapatan", value: formatCurrency(summary.totalRevenue) },
          { label: "Total Diskon", value: formatCurrency(summary.totalDiscount) },
          { label: "Total Pajak", value: formatCurrency(summary.totalTax) },
        ]}
      />

      <ReportSummary
        title="Metode Pembayaran"
        items={Object.entries(summary.paymentMethods).map(([method, amount]) => ({
          label: method,
          value: formatCurrency(amount),
        }))}
      />

      {/* Sales Table */}
      <div className="overflow-x-auto">
        <ReportSectionTitle>Detail Transaksi</ReportSectionTitle>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#111111]">
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">No</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">No. Invoice</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">Tanggal</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">Customer</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">Kasir</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">Metode</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-[#111111]">Total</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale, index) => (
              <tr key={sale.id} className="border-b border-gray-200 even:bg-[#FAFAFA]">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2 font-mono text-xs">{sale.invoiceNumber}</td>
                <td className="px-3 py-2">{formatDate(sale.saleDate)}</td>
                <td className="px-3 py-2">{sale.customer?.name || "Walk-in"}</td>
                <td className="px-3 py-2">{sale.cashier?.name}</td>
                <td className="px-3 py-2">{sale.paymentMethod}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {formatCurrency(Number(sale.grandTotal))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#111111] font-bold">
              <td colSpan={6} className="px-3 py-3 text-right">
                TOTAL
              </td>
              <td className="report-total-red px-3 py-3 text-right tabular-nums text-red-900">{formatCurrency(summary.totalRevenue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ReportFooter />
    </div>
  );
}
