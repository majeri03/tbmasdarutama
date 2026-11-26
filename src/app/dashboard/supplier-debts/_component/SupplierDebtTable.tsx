"use client";

import { Eye, DollarSign, Trash2 } from "lucide-react";
import { DebtStatusBadge } from "../../customer-debts/_components/DebtStatusBadge";
import { SupplierDebtData } from "@/types/supplier-debt";
import { formatCurrency } from "@/lib/utils/pos-helpers";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface SupplierDebtTableProps {
  debts: SupplierDebtData[];
  onView: (debt: SupplierDebtData) => void;
  onPay: (debt: SupplierDebtData) => void;
  onDelete: (debt: SupplierDebtData) => void;
}

export function SupplierDebtTable({
  debts,
  onView,
  onPay,
  onDelete,
}: SupplierDebtTableProps) {
  if (debts.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-stone-400">Tidak ada data utang supplier</p>
      </div>
    );
  }

  const isOverdue = (dueDate: Date) => {
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="glass-card overflow-hidden bg-white/15 border-white/10">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                No. Utang
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Supplier
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                PO Number
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Total Utang
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Terbayar
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Sisa
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Jatuh Tempo
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {debts.map((debt) => (
              <tr key={debt.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-stone-100">
                    {debt.debtNumber}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm">
                    <p className="font-medium text-stone-100">
                      {debt.supplier.name}
                    </p>
                    <p className="text-stone-400">{debt.supplier.code}</p>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-stone-100 tabular-nums">
                    {debt.purchase.poNumber}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-semibold text-stone-100">
                    {formatCurrency(debt.totalDebt)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-green-300 tabular-nums">
                    {formatCurrency(debt.paidAmount)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-semibold text-red-300">
                    {formatCurrency(debt.remainingDebt)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm">
                    <p className={isOverdue(debt.dueDate) ? "text-red-300 font-semibold" : "text-stone-100"}>
                      {format(new Date(debt.dueDate), "dd MMM yyyy", {
                        locale: id,
                      })}
                    </p>
                    {isOverdue(debt.dueDate) && debt.status !== "PAID" && (
                      <p className="text-xs text-red-300">Lewat jatuh tempo</p>
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
                      className="p-2 text-stone-400 hover:bg-white/10 rounded-lg transition-colors"
                      title="Lihat Detail"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {debt.status !== "PAID" && (
                      <button
                        onClick={() => onPay(debt)}
                        className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                        title="Bayar"
                      >
                        <DollarSign className="w-4 h-4" />
                      </button>
                    )}
                    {debt.status === "UNPAID" && debt._count?.payments === 0 && (
                      <button
                        onClick={() => onDelete(debt)}
                        className="p-2 text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
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