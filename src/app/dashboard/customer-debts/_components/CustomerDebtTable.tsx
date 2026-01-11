"use client";

import { Eye, DollarSign, Trash2 } from "lucide-react";
import { DebtStatusBadge } from "./DebtStatusBadge";
import { CustomerDebtData } from "@/types/customer-debt";
import { formatCurrency } from "@/lib/utils/pos-helpers";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface CustomerDebtTableProps {
  debts: CustomerDebtData[];
  onView: (debt: CustomerDebtData) => void;
  onPay: (debt: CustomerDebtData) => void;
  onDelete: (debt: CustomerDebtData) => void;
}

export function CustomerDebtTable({
  debts,
  onView,
  onPay,
  onDelete,
}: CustomerDebtTableProps) {
  if (debts.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-gray-500">Tidak ada data piutang</p>
      </div>
    );
  }

  const isOverdue = (dueDate: Date) => {
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                No. Piutang
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invoice
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Piutang
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Terbayar
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sisa
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Jatuh Tempo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {debts.map((debt) => (
              <tr key={debt.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-900">
                    {debt.debtNumber}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">
                      {debt.customer.name}
                    </p>
                    <p className="text-gray-500">{debt.customer.code}</p>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">
                    {debt.sale.invoiceNumber}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(debt.totalDebt)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-green-600">
                    {formatCurrency(debt.paidAmount)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-semibold text-red-600">
                    {formatCurrency(debt.remainingDebt)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm">
                    <p className={isOverdue(debt.dueDate) ? "text-red-600 font-semibold" : "text-gray-900"}>
                      {format(new Date(debt.dueDate), "dd MMM yyyy", {
                        locale: id,
                      })}
                    </p>
                    {isOverdue(debt.dueDate) && debt.status !== "PAID" && (
                      <p className="text-xs text-red-600">Lewat jatuh tempo</p>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <DebtStatusBadge status={debt.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onView(debt)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Lihat Detail"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {debt.status !== "PAID" && (
                      <button
                        onClick={() => onPay(debt)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Bayar"
                      >
                        <DollarSign className="w-4 h-4" />
                      </button>
                    )}
                    {debt.status === "UNPAID" && debt._count?.payments === 0 && (
                      <button
                        onClick={() => onDelete(debt)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}