"use client";

import { X, Calendar, User, Package, DollarSign, FileText } from "lucide-react";
import { PurchaseData } from "@/types/purchase";
import { PurchaseStatusBadge } from "./PurchaseStatusBadge";
import { formatCurrency } from "@/lib/utils/pos-helpers";

interface PurchaseViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: PurchaseData | null;
}

export function PurchaseViewModal({ isOpen, onClose, purchase }: PurchaseViewModalProps) {
  if (!isOpen || !purchase) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-200">
          <div>
            <h2 className="text-xl font-semibold text-stone-900">Detail Purchase Order</h2>
            <p className="text-sm text-stone-500 mt-1">{purchase.poNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* PO Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card p-4 bg-red-900/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-red-900 rounded-xl">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Tanggal PO</p>
                  <p className="font-semibold text-stone-900">
                    {new Date(purchase.purchaseDate).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-600">Status:</span>
                <PurchaseStatusBadge status={purchase.status} />
              </div>
            </div>

            <div className="glass-card p-4 bg-stone-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-red-900 rounded-xl">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Supplier</p>
                  <p className="font-semibold text-stone-900">{purchase.supplier.name}</p>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-stone-600">Code: {purchase.supplier.code}</p>
                {purchase.supplier.phone && (
                  <p className="text-stone-600">Phone: {purchase.supplier.phone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Admin & Received Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 glass-card">
              <User className="w-5 h-5 text-stone-400" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Dibuat oleh</p>
                <p className="font-medium text-stone-900">{purchase.admin.name}</p>
              </div>
            </div>

            {purchase.receivedDate && (
              <div className="flex items-center gap-3 p-3 glass-card bg-green-50">
                <Calendar className="w-5 h-5 text-green-700" />
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Diterima pada</p>
                  <p className="font-medium text-stone-900">
                    {new Date(purchase.receivedDate).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-5 h-5 text-stone-600" />
              <h3 className="font-semibold text-stone-900">Daftar Produk</h3>
            </div>
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-stone-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600">
                        Produk
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-stone-600">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-stone-600">
                        Satuan
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-stone-600">
                        Harga
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-stone-600">
                        Diskon
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-stone-600">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {purchase.purchaseItems.map((item, index) => (
                      <tr key={index} className="hover:bg-stone-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm text-stone-900">
                            {item.product?.name}
                          </div>
                          <div className="text-xs text-stone-500">{item.product?.code}</div>
                        </td>
                        <td className="px-4 py-3 text-center font-medium">{item.quantity}</td>
                        <td className="px-4 py-3 text-center text-sm text-stone-600">
                          {item.unit?.name}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-red-800">
                          {item.discount > 0 ? `-${formatCurrency(item.discount)}` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="glass-card p-4 bg-gradient-to-br from-stone-50 to-stone-100/50">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-5 h-5 text-stone-600" />
              <h3 className="font-semibold text-stone-900">Ringkasan Pembayaran</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-600">Total Barang:</span>
                <span className="font-medium">{formatCurrency(purchase.totalAmount)}</span>
              </div>
              {purchase.discount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-600">Diskon:</span>
                  <span className="font-medium text-red-800">
                    -{formatCurrency(purchase.discount)}
                  </span>
                </div>
              )}
              {purchase.tax > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-600">Pajak:</span>
                  <span className="font-medium">{formatCurrency(purchase.tax)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
                <span className="font-semibold text-stone-900">Grand Total:</span>
                <span className="text-xl font-bold text-red-900">
                  {formatCurrency(purchase.grandTotal)}
                </span>
              </div>

              {/* Payment Info */}
              <div className="pt-3 border-t border-stone-200 space-y-2">
                {purchase.paymentMethod && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-600">Metode Pembayaran:</span>
                    <span className="font-medium px-2 py-1 bg-red-900/10 text-red-800 rounded">
                      {purchase.paymentMethod}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-600">Dibayar:</span>
                  <span className="font-medium text-green-700">
                    {formatCurrency(purchase.paidAmount)}
                  </span>
                </div>
                {purchase.paidAmount < purchase.grandTotal && (
                  <div className="flex items-center justify-between p-2 bg-red-50 rounded-xl">
                    <span className="font-medium text-red-700">Sisa Utang:</span>
                    <span className="font-bold text-red-800">
                      {formatCurrency(purchase.grandTotal - purchase.paidAmount)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          {purchase.notes && (
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-stone-600" />
                <h3 className="font-semibold text-stone-900">Catatan</h3>
              </div>
              <p className="text-sm text-stone-600 whitespace-pre-wrap">{purchase.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 flex justify-end bg-stone-50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-red-900 text-white rounded-xl transition-all hover:bg-red-800"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}