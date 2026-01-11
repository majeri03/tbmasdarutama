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
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Belum ada Purchase Order</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                PO Number
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Tanggal
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Supplier
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Items
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Total
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {purchases.map((purchase) => (
              <tr key={purchase.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-900">{purchase.poNumber}</div>
                  <div className="text-xs text-gray-500">by {purchase.admin.name}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {new Date(purchase.purchaseDate).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{purchase.supplier.name}</div>
                  <div className="text-xs text-gray-500">{purchase.supplier.code}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {purchase._count?.purchaseItems || purchase.purchaseItems.length} item(s)
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="font-semibold text-gray-900">
                    {formatCurrency(purchase.grandTotal)}
                  </div>
                  {purchase.paidAmount < purchase.grandTotal && (
                    <div className="text-xs text-red-600">
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
                      className="p-2 hover:bg-blue-50 rounded-lg transition-colors group"
                      title="Lihat Detail"
                    >
                      <Eye className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                    </button>

                    {purchase.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => onReceive(purchase)}
                          className="p-2 hover:bg-green-50 rounded-lg transition-colors group"
                          title="Terima Barang"
                        >
                          <CheckCircle className="w-4 h-4 text-gray-400 group-hover:text-green-600" />
                        </button>
                        <button
                          onClick={() => onEdit(purchase)}
                          className="p-2 hover:bg-yellow-50 rounded-lg transition-colors group"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-gray-400 group-hover:text-yellow-600" />
                        </button>
                      </>
                    )}

                    {purchase.status !== "RECEIVED" && (
                      <button
                        onClick={() => onDelete(purchase)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-red-600" />
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