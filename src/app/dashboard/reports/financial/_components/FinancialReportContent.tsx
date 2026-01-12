import ReportHeader from "../../_components/ReportHeader";
import { formatCurrency, formatDate } from "@/lib/utils/pdf-helpers";

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
  };
  dateFrom: string;
  dateTo: string;
}

export default function FinancialReportContent({ data, dateFrom, dateTo }: FinancialReportContentProps) {
  const { summary } = data;
  const period = `${formatDate(dateFrom)} - ${formatDate(dateTo)}`;

  return (
    <div id="print-content" className="bg-white p-8 min-h-[297mm]">
      <ReportHeader title="Laporan Keuangan" period={period} />

      {/* Revenue Section */}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4 border-b-2 border-blue-500 pb-2">
          📊 Pendapatan
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
            <p className="text-sm text-gray-600 mb-1">Total Penjualan</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(summary.totalRevenue)}</p>
            <p className="text-xs text-gray-500 mt-1">{summary.transactionCount} transaksi</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
            <p className="text-sm text-gray-600 mb-1">Total Diskon</p>
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(summary.totalDiscount)}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
            <p className="text-sm text-gray-600 mb-1">Pendapatan Bersih</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.netRevenue)}</p>
          </div>
        </div>
      </div>

      {/* Cost & Profit Section */}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4 border-b-2 border-purple-500 pb-2">
          💰 Biaya & Laba
        </h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200">
            <p className="text-sm text-gray-600 mb-1">HPP (COGS)</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(summary.totalCOGS)}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
            <p className="text-sm text-gray-600 mb-1">Laba Kotor</p>
            <p className="text-xl font-bold text-purple-600">{formatCurrency(summary.grossProfit)}</p>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg border-2 border-indigo-200">
            <p className="text-sm text-gray-600 mb-1">Margin Laba</p>
            <p className="text-2xl font-bold text-indigo-600">{summary.grossProfitMargin.toFixed(2)}%</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
            <p className="text-sm text-gray-600 mb-1">Laba Bersih</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(summary.netProfit)}</p>
          </div>
        </div>
      </div>

      {/* Purchases Section */}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4 border-b-2 border-orange-500 pb-2">
          🛒 Pembelian
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-orange-50 p-6 rounded-lg border-2 border-orange-200">
            <p className="text-sm text-gray-600 mb-1">Total Pembelian</p>
            <p className="text-3xl font-bold text-orange-600">{formatCurrency(summary.totalPurchases)}</p>
            <p className="text-xs text-gray-500 mt-1">{summary.purchaseCount} transaksi</p>
          </div>
          <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
            <p className="text-sm text-gray-600 mb-1">Selisih (Revenue - Purchase)</p>
            <p className={`text-3xl font-bold ${summary.totalRevenue - summary.totalPurchases >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.totalRevenue - summary.totalPurchases)}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="mt-8 border-t-4 border-gray-300 pt-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">📋 Ringkasan Keuangan</h3>
        <table className="w-full">
          <tbody className="text-base">
            <tr className="border-b border-gray-200">
              <td className="py-3 px-4 font-semibold">Total Pendapatan Kotor</td>
              <td className="py-3 px-4 text-right font-bold text-blue-600">{formatCurrency(summary.totalRevenue)}</td>
            </tr>
            <tr className="border-b border-gray-200 bg-gray-50">
              <td className="py-3 px-4 pl-8 text-gray-600">- Diskon</td>
              <td className="py-3 px-4 text-right text-orange-600">({formatCurrency(summary.totalDiscount)})</td>
            </tr>
            <tr className="border-b border-gray-200 font-semibold bg-blue-50">
              <td className="py-3 px-4">Pendapatan Bersih</td>
              <td className="py-3 px-4 text-right text-blue-700">{formatCurrency(summary.netRevenue)}</td>
            </tr>
            <tr className="border-b border-gray-200 bg-gray-50">
              <td className="py-3 px-4 pl-8 text-gray-600">- HPP (COGS)</td>
              <td className="py-3 px-4 text-right text-red-600">({formatCurrency(summary.totalCOGS)})</td>
            </tr>
            <tr className="border-b-2 border-gray-300 font-semibold bg-purple-50">
              <td className="py-3 px-4">Laba Kotor</td>
              <td className="py-3 px-4 text-right text-purple-700">{formatCurrency(summary.grossProfit)}</td>
            </tr>
            <tr className="border-b-2 border-gray-300 font-bold text-lg bg-green-100">
              <td className="py-4 px-4">LABA BERSIH</td>
              <td className="py-4 px-4 text-right text-green-700">{formatCurrency(summary.netProfit)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}