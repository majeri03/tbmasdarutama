"use client";

import { Eye, Edit, Trash2, CheckCircle, Package } from "lucide-react";
import { PurchaseData } from "@/types/purchase";
import { PurchaseStatusBadge } from "./PurchaseStatusBadge";
import { formatCurrency } from "@/lib/utils/pos-helpers";

interface PurchaseTableProps {
  purchases: PurchaseData[];
  onView: (purchase: PurchaseData) => void;
  onEdit: (purchase: PurchaseData) => void;
  onDelete: (purchase: PurchaseData) => void;
  onReceive: (purchase: PurchaseData) => void;
}

export function PurchaseTable({ purchases, onView, onEdit, onDelete, onReceive }: PurchaseTableProps) {
  if (purchases.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <Package className="w-16 h-16 text-stone-300 mx-auto mb-4" />
        <p className="text-stone-400">Belum ada Purchase Order</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden bg-white/15 border-white/10">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-white/10">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                PO Number
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Tanggal
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Supplier
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Items
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Total
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {purchases.map((purchase) => (
              <tr key={purchase.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-semibold text-stone-100">{purchase.poNumber}</div>
                  <div className="text-xs text-stone-400">by {purchase.admin.name}</div>
                </td>
                <td className="px-4 py-3 text-sm text-stone-400">
                  {new Date(purchase.purchaseDate).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-stone-100">{purchase.supplier.name}</div>
                  <div className="text-xs text-stone-400">{purchase.supplier.code}</div>
                </td>
                <td className="px-4 py-3 text-sm text-stone-400">
                  {purchase._count?.purchaseItems || purchase.purchaseItems.length} item(s)
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="font-semibold text-stone-100">
                    {formatCurrency(purchase.grandTotal)}
                  </div>
                  {purchase.paidAmount < purchase.grandTotal && (
                    <div className="text-xs text-red-300">
                      Debt: {formatCurrency(purchase.grandTotal - purchase.paidAmount)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <PurchaseStatusBadge status={purchase.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onView(purchase)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors group"
                      title="Lihat Detail"
                    >
                      <Eye className="w-4 h-4 text-stone-400 group-hover:text-stone-200" />
                    </button>

                    {purchase.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => onReceive(purchase)}
                          className="p-2 hover:bg-green-500/10 rounded-lg transition-colors group"
                          title="Terima Barang"
                        >
                          <CheckCircle className="w-4 h-4 text-stone-400 group-hover:text-green-400" />
                        </button>
                        <button
                          onClick={() => onEdit(purchase)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors group"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-stone-400 group-hover:text-stone-200" />
                        </button>
                      </>
                    )}

                    {purchase.status !== "RECEIVED" && (
                      <button
                        onClick={() => onDelete(purchase)}
                        className="p-2 hover:bg-red-500/10 rounded-lg transition-colors group"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4 text-stone-400 group-hover:text-red-300" />
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