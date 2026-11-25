import ReportHeader from "../../_components/ReportHeader";
import ReportFooter from "../../_components/ReportFooter";
import ReportSummary, { ReportSectionTitle } from "../../_components/ReportSummary";
import type { ReportStoreInfo } from "../../_components/report-types";
import { formatDateWita } from "../../_components/report-datetime";
import { formatCurrency } from "@/lib/utils/pdf-helpers";

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
    store?: ReportStoreInfo | null;
  };
}

export default function DebtsReportContent({ data }: DebtsReportContentProps) {
  const { customerDebts, supplierDebts, customerDebtSummary, supplierDebtSummary, store } = data;

  return (
    <div id="print-content" className="bg-white p-8 min-h-[297mm] text-[#111111]">
      <ReportHeader
        title="Laporan Piutang & Hutang"
        storeName={store?.name}
        storeAddress={store?.address}
        storePhone={store?.phone}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <ReportSummary
          title="Piutang"
          items={[
            { label: "Total Piutang", value: formatCurrency(customerDebtSummary.totalDebt) },
            { label: "Sudah Dibayar", value: formatCurrency(customerDebtSummary.totalPaid) },
            {
              label: "Sisa Piutang",
              value: formatCurrency(customerDebtSummary.totalRemaining),
              note: `${customerDebtSummary.count} transaksi`,
              strong: true,
            },
          ]}
        />
        <ReportSummary
          title="Hutang"
          items={[
            { label: "Total Hutang", value: formatCurrency(supplierDebtSummary.totalDebt) },
            { label: "Sudah Dibayar", value: formatCurrency(supplierDebtSummary.totalPaid) },
            {
              label: "Sisa Hutang",
              value: formatCurrency(supplierDebtSummary.totalRemaining),
              note: `${supplierDebtSummary.count} transaksi`,
              strong: true,
            },
          ]}
        />
      </div>

      {/* Customer Debts Table */}
      <div className="mb-8">
        <ReportSectionTitle>Detail Piutang Customer</ReportSectionTitle>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#111111]">
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">No</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">Customer</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">Invoice</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">Jatuh Tempo</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-[#111111]">Total</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-[#111111]">Dibayar</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-[#111111]">Sisa</th>
              <th className="px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-[#111111]">Status</th>
            </tr>
          </thead>
          <tbody>
            {customerDebts.map((debt, index) => (
              <tr key={debt.id} className="border-b border-gray-200 even:bg-[#FAFAFA]">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2">
                  <div className="font-semibold">{debt.customer.name}</div>
                  <div className="text-xs text-[#6B7280]">{debt.customer.phone}</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{debt.sale.invoiceNumber}</td>
                <td className="px-3 py-2">{formatDateWita(debt.dueDate)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(debt.totalDebt)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(debt.paidAmount)}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(debt.remainingDebt)}</td>
                <td className="px-3 py-2 text-center">{debt.status}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#111111] font-bold">
              <td colSpan={4} className="px-3 py-3 text-right">TOTAL PIUTANG</td>
              <td className="report-total-red px-3 py-3 text-right tabular-nums text-red-900">{formatCurrency(customerDebtSummary.totalDebt)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(customerDebtSummary.totalPaid)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(customerDebtSummary.totalRemaining)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Supplier Debts Table */}
      <div className="mb-8">
        <ReportSectionTitle>Detail Hutang Supplier</ReportSectionTitle>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#111111]">
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">No</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">Supplier</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">Invoice</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#111111]">Jatuh Tempo</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-[#111111]">Total</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-[#111111]">Dibayar</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-[#111111]">Sisa</th>
              <th className="px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-[#111111]">Status</th>
            </tr>
          </thead>
          <tbody>
            {supplierDebts.map((debt, index) => (
              <tr key={debt.id} className="border-b border-gray-200 even:bg-[#FAFAFA]">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2">
                  <div className="font-semibold">{debt.supplier.name}</div>
                  <div className="text-xs text-[#6B7280]">{debt.supplier.phone}</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{debt.purchase.invoiceNumber}</td>
                <td className="px-3 py-2">{formatDateWita(debt.dueDate)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(debt.totalDebt)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(debt.paidAmount)}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(debt.remainingDebt)}</td>
                <td className="px-3 py-2 text-center">{debt.status}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#111111] font-bold">
              <td colSpan={4} className="px-3 py-3 text-right">TOTAL HUTANG</td>
              <td className="report-total-red px-3 py-3 text-right tabular-nums text-red-900">{formatCurrency(supplierDebtSummary.totalDebt)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(supplierDebtSummary.totalPaid)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(supplierDebtSummary.totalRemaining)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ReportFooter storeName={store?.name ?? undefined} />
    </div>
  );
}
