import ReportHeader from "../../_components/ReportHeader";
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
    <div id="print-content" className="bg-white p-8 min-h-[297mm]">
      <ReportHeader title="Laporan Penjualan" period={period} />

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="text-sm text-gray-600 mb-1">Total Transaksi</p>
          <p className="text-2xl font-bold text-gray-900">{summary.totalTransactions}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <p className="text-sm text-gray-600 mb-1">Total Pendapatan</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.totalRevenue)}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <p className="text-sm text-gray-600 mb-1">Total Diskon</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.totalDiscount)}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <p className="text-sm text-gray-600 mb-1">Total Pajak</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.totalTax)}</p>
        </div>
      </div>

      {/* Payment Methods Breakdown */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-3">Metode Pembayaran</h3>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(summary.paymentMethods).map(([method, amount]) => (
            <div key={method} className="bg-gray-50 p-3 rounded border border-gray-200">
              <p className="text-xs text-gray-600">{method}</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(amount)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sales Table */}
      <div className="overflow-x-auto">
        <h3 className="text-lg font-bold text-gray-900 mb-3">Detail Transaksi</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="px-3 py-2 text-left font-semibold">No</th>
              <th className="px-3 py-2 text-left font-semibold">No. Invoice</th>
              <th className="px-3 py-2 text-left font-semibold">Tanggal</th>
              <th className="px-3 py-2 text-left font-semibold">Customer</th>
              <th className="px-3 py-2 text-left font-semibold">Kasir</th>
              <th className="px-3 py-2 text-left font-semibold">Metode</th>
              <th className="px-3 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale, index) => (
              <tr key={sale.id} className="border-b border-gray-200">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2 font-mono text-xs">{sale.invoiceNumber}</td>
                <td className="px-3 py-2">{formatDate(sale.saleDate)}</td>
                <td className="px-3 py-2">{sale.customer?.name || "Walk-in"}</td>
                <td className="px-3 py-2">{sale.cashier?.name}</td>
                <td className="px-3 py-2">
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    {sale.paymentMethod}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {formatCurrency(Number(sale.grandTotal))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
              <td colSpan={6} className="px-3 py-3 text-right">
                TOTAL
              </td>
              <td className="px-3 py-3 text-right">{formatCurrency(summary.totalRevenue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}