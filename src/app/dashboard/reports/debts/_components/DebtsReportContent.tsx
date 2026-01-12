import ReportHeader from "../../_components/ReportHeader";
import { formatCurrency, formatDate } from "@/lib/utils/pdf-helpers";

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

interface DebtsReportContentProps {
  data: {
    customerDebts: CustomerDebt[];
    supplierDebts: SupplierDebt[];
    customerDebtSummary: DebtSummary;
    supplierDebtSummary: DebtSummary;
  };
}

export default function DebtsReportContent({ data }: DebtsReportContentProps) {
  const { customerDebts, supplierDebts, customerDebtSummary, supplierDebtSummary } = data;

  return (
    <div id="print-content" className="bg-white p-8 min-h-[297mm]">
      <ReportHeader title="Laporan Piutang & Hutang" />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Customer Debts (Piutang) */}
        <div className="border-2 border-green-300 rounded-lg p-4 bg-green-50">
          <h3 className="text-lg font-bold text-green-700 mb-3">💰 PIUTANG (Dari Customer)</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Piutang:</span>
              <span className="font-bold text-green-700">{formatCurrency(customerDebtSummary.totalDebt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Sudah Dibayar:</span>
              <span className="font-semibold text-gray-700">{formatCurrency(customerDebtSummary.totalPaid)}</span>
            </div>
            <div className="flex justify-between border-t-2 border-green-300 pt-2">
              <span className="font-bold text-gray-700">Sisa Piutang:</span>
              <span className="font-bold text-green-600 text-xl">{formatCurrency(customerDebtSummary.totalRemaining)}</span>
            </div>
            <div className="text-xs text-gray-500 text-right">{customerDebtSummary.count} transaksi</div>
          </div>
        </div>

        {/* Supplier Debts (Hutang) */}
        <div className="border-2 border-red-300 rounded-lg p-4 bg-red-50">
          <h3 className="text-lg font-bold text-red-700 mb-3">📋 HUTANG (Ke Supplier)</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Hutang:</span>
              <span className="font-bold text-red-700">{formatCurrency(supplierDebtSummary.totalDebt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Sudah Dibayar:</span>
              <span className="font-semibold text-gray-700">{formatCurrency(supplierDebtSummary.totalPaid)}</span>
            </div>
            <div className="flex justify-between border-t-2 border-red-300 pt-2">
              <span className="font-bold text-gray-700">Sisa Hutang:</span>
              <span className="font-bold text-red-600 text-xl">{formatCurrency(supplierDebtSummary.totalRemaining)}</span>
            </div>
            <div className="text-xs text-gray-500 text-right">{supplierDebtSummary.count} transaksi</div>
          </div>
        </div>
      </div>

      {/* Customer Debts Table */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-3 bg-green-100 p-2 rounded">
          💰 Detail Piutang Customer
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-green-50 border-b-2 border-green-300">
              <th className="px-3 py-2 text-left font-semibold">No</th>
              <th className="px-3 py-2 text-left font-semibold">Customer</th>
              <th className="px-3 py-2 text-left font-semibold">Invoice</th>
              <th className="px-3 py-2 text-left font-semibold">Jatuh Tempo</th>
              <th className="px-3 py-2 text-right font-semibold">Total</th>
              <th className="px-3 py-2 text-right font-semibold">Dibayar</th>
              <th className="px-3 py-2 text-right font-semibold">Sisa</th>
              <th className="px-3 py-2 text-center font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {customerDebts.map((debt, index) => (
              <tr key={debt.id} className="border-b border-gray-200">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2">
                  <div className="font-semibold">{debt.customer.name}</div>
                  <div className="text-xs text-gray-500">{debt.customer.phone}</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{debt.sale.invoiceNumber}</td>
                <td className="px-3 py-2">{formatDate(debt.dueDate)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(debt.totalDebt)}</td>
                <td className="px-3 py-2 text-right text-green-600">{formatCurrency(debt.paidAmount)}</td>
                <td className="px-3 py-2 text-right font-semibold text-orange-600">{formatCurrency(debt.remainingDebt)}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`text-xs px-2 py-1 rounded ${
                    debt.status === 'PAID' ? 'bg-green-100 text-green-700' : 
                    debt.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' : 
                    'bg-red-100 text-red-700'
                  }`}>
                    {debt.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-green-100 font-bold border-t-2 border-green-300">
              <td colSpan={4} className="px-3 py-3 text-right">TOTAL PIUTANG</td>
              <td className="px-3 py-3 text-right">{formatCurrency(customerDebtSummary.totalDebt)}</td>
              <td className="px-3 py-3 text-right text-green-600">{formatCurrency(customerDebtSummary.totalPaid)}</td>
              <td className="px-3 py-3 text-right text-orange-600">{formatCurrency(customerDebtSummary.totalRemaining)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Supplier Debts Table */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-3 bg-red-100 p-2 rounded">
          📋 Detail Hutang Supplier
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-red-50 border-b-2 border-red-300">
              <th className="px-3 py-2 text-left font-semibold">No</th>
              <th className="px-3 py-2 text-left font-semibold">Supplier</th>
              <th className="px-3 py-2 text-left font-semibold">Invoice</th>
              <th className="px-3 py-2 text-left font-semibold">Jatuh Tempo</th>
              <th className="px-3 py-2 text-right font-semibold">Total</th>
              <th className="px-3 py-2 text-right font-semibold">Dibayar</th>
              <th className="px-3 py-2 text-right font-semibold">Sisa</th>
              <th className="px-3 py-2 text-center font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {supplierDebts.map((debt, index) => (
              <tr key={debt.id} className="border-b border-gray-200">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2">
                  <div className="font-semibold">{debt.supplier.name}</div>
                  <div className="text-xs text-gray-500">{debt.supplier.phone}</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{debt.purchase.invoiceNumber}</td>
                <td className="px-3 py-2">{formatDate(debt.dueDate)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(debt.totalDebt)}</td>
                <td className="px-3 py-2 text-right text-green-600">{formatCurrency(debt.paidAmount)}</td>
                <td className="px-3 py-2 text-right font-semibold text-orange-600">{formatCurrency(debt.remainingDebt)}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`text-xs px-2 py-1 rounded ${
                    debt.status === 'PAID' ? 'bg-green-100 text-green-700' : 
                    debt.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' : 
                    'bg-red-100 text-red-700'
                  }`}>
                    {debt.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-red-100 font-bold border-t-2 border-red-300">
              <td colSpan={4} className="px-3 py-3 text-right">TOTAL HUTANG</td>
              <td className="px-3 py-3 text-right">{formatCurrency(supplierDebtSummary.totalDebt)}</td>
              <td className="px-3 py-3 text-right text-green-600">{formatCurrency(supplierDebtSummary.totalPaid)}</td>
              <td className="px-3 py-3 text-right text-orange-600">{formatCurrency(supplierDebtSummary.totalRemaining)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}