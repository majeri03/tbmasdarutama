import ReportHeader from "../../_components/ReportHeader";
import ReportFooter from "../../_components/ReportFooter";
import ReportSummary, { ReportSectionTitle } from "../../_components/ReportSummary";
import { formatCurrency, formatDate } from "@/lib/utils/pdf-helpers";

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

interface PurchasesReportContentProps {
  data: {
    purchases: PurchaseData[];
    summary: PurchasesSummary;
  };
  dateFrom: string;
  dateTo: string;
}

export default function PurchasesReportContent({ data, dateFrom, dateTo }: PurchasesReportContentProps) {
  const { purchases, summary } = data;
  const period = `${formatDate(dateFrom)} - ${formatDate(dateTo)}`;

  return (
    <div id="print-content" className="bg-white p-8 min-h-[297mm] text-[#111111]">
      <ReportHeader title="Laporan Pembelian" period={period} />

      <ReportSummary
        title="Ringkasan"
        items={[
          { label: "Total Pembelian", value: String(summary.totalPurchases) },
          { label: "Total Nilai", value: formatCurrency(summary.totalAmount) },
          { label: "Sudah Dibayar", value: formatCurrency(summary.totalPaid) },
          { label: "Belum Dibayar", value: formatCurrency(summary.totalUnpaid) },
        ]}
      />

      <ReportSummary
        title="Supplier"
        items={Object.entries(summary.supplierBreakdown).map(([supplier, amount]) => ({
          label: supplier,
          value: formatCurrency(amount),
        }))}
      />

      {/* Purchases Table */}
      <div className="overflow-x-auto">
        <ReportSectionTitle>Detail Pembelian</ReportSectionTitle>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#111111]">
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">No</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">No. Invoice</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">Tanggal</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">Supplier</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">Admin</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-[#111111]">Total</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-[#111111]">Dibayar</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-[#111111]">Sisa</th>
              <th className="px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-[#111111]">Status</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((purchase, index) => (
              <tr key={purchase.id} className="border-b border-gray-200 even:bg-[#FAFAFA]">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2 font-mono text-xs">{purchase.invoiceNumber}</td>
                <td className="px-3 py-2">{formatDate(purchase.purchaseDate)}</td>
                <td className="px-3 py-2">{purchase.supplier.name}</td>
                <td className="px-3 py-2">{purchase.admin.name}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {formatCurrency(purchase.grandTotal)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(purchase.paidAmount)}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {formatCurrency(purchase.grandTotal - purchase.paidAmount)}
                </td>
                <td className="px-3 py-2 text-center">{purchase.status}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#111111] font-bold">
              <td colSpan={5} className="px-3 py-3 text-right">TOTAL</td>
              <td className="report-total-red px-3 py-3 text-right tabular-nums text-red-900">{formatCurrency(summary.totalAmount)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(summary.totalPaid)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(summary.totalUnpaid)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ReportFooter />
    </div>
  );
}
