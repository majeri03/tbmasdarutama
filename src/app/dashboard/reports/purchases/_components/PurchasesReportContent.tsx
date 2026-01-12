import ReportHeader from "../../_components/ReportHeader";
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
    <div id="print-content" className="bg-white p-8 min-h-[297mm]">
      <ReportHeader title="Laporan Pembelian" period={period} />

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="text-sm text-gray-600 mb-1">Total Pembelian</p>
          <p className="text-2xl font-bold text-gray-900">{summary.totalPurchases}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <p className="text-sm text-gray-600 mb-1">Total Nilai</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.totalAmount)}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <p className="text-sm text-gray-600 mb-1">Sudah Dibayar</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.totalPaid)}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <p className="text-sm text-gray-600 mb-1">Belum Dibayar</p>
          <p className="text-xl font-bold text-orange-600">{formatCurrency(summary.totalUnpaid)}</p>
        </div>
      </div>

      {/* Supplier Breakdown */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-3">Breakdown Supplier</h3>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(summary.supplierBreakdown).map(([supplier, amount]) => (
            <div key={supplier} className="bg-gray-50 p-3 rounded border border-gray-200">
              <p className="text-xs text-gray-600">{supplier}</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(amount)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Purchases Table */}
      <div className="overflow-x-auto">
        <h3 className="text-lg font-bold text-gray-900 mb-3">Detail Pembelian</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="px-3 py-2 text-left font-semibold">No</th>
              <th className="px-3 py-2 text-left font-semibold">No. Invoice</th>
              <th className="px-3 py-2 text-left font-semibold">Tanggal</th>
              <th className="px-3 py-2 text-left font-semibold">Supplier</th>
              <th className="px-3 py-2 text-left font-semibold">Admin</th>
              <th className="px-3 py-2 text-right font-semibold">Total</th>
              <th className="px-3 py-2 text-right font-semibold">Dibayar</th>
              <th className="px-3 py-2 text-right font-semibold">Sisa</th>
              <th className="px-3 py-2 text-center font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((purchase, index) => (
              <tr key={purchase.id} className="border-b border-gray-200">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2 font-mono text-xs">{purchase.invoiceNumber}</td>
                <td className="px-3 py-2">{formatDate(purchase.purchaseDate)}</td>
                <td className="px-3 py-2">{purchase.supplier.name}</td>
                <td className="px-3 py-2">{purchase.admin.name}</td>
                <td className="px-3 py-2 text-right font-semibold">
                  {formatCurrency(purchase.grandTotal)}
                </td>
                <td className="px-3 py-2 text-right text-green-600">
                  {formatCurrency(purchase.paidAmount)}
                </td>
                <td className="px-3 py-2 text-right text-orange-600">
                  {formatCurrency(purchase.grandTotal - purchase.paidAmount)}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`text-xs px-2 py-1 rounded ${
                    purchase.status === 'RECEIVED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {purchase.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
              <td colSpan={5} className="px-3 py-3 text-right">TOTAL</td>
              <td className="px-3 py-3 text-right">{formatCurrency(summary.totalAmount)}</td>
              <td className="px-3 py-3 text-right text-green-600">{formatCurrency(summary.totalPaid)}</td>
              <td className="px-3 py-3 text-right text-orange-600">{formatCurrency(summary.totalUnpaid)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}