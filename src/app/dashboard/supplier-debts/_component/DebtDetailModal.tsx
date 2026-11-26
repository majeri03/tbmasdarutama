"use client";

import { useState, useEffect } from "react";
import { X, FileText, Clock } from "lucide-react";
import { DebtStatus } from "@prisma/client";
import { getSupplierDebtById } from "@/lib/actions/supplier-debt.actions";
import { DebtStatusBadge } from "../../customer-debts/_components/DebtStatusBadge";
import { formatCurrency } from "@/lib/utils/pos-helpers";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface DebtDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  debtId: string | null;
}

interface DebtDetail {
  id: string;
  debtNumber: string;
  status: DebtStatus;
  createdAt: Date;
  dueDate: Date;
  totalDebt: number;
  paidAmount: number;
  remainingDebt: number;
  notes?: string | null;
  supplier: {
    code: string;
    name: string;
    phone: string | null;
    address: string | null;
  };
  purchase: {
    poNumber: string;
    purchaseDate: Date;
    grandTotal: number;
    purchaseItems: Array<{
      id: string;
      quantity: number;
      subtotal: number;
      product: { name: string };
      unit: { name: string };
    }>;
  };
  payments: Array<{
    id: string;
    amount: number;
    paymentDate: Date;
    paymentMethod: string;
    notes: string | null;
    admin?: { name: string };
  }>;
}

export function DebtDetailModal({
  isOpen,
  onClose,
  debtId,
}: DebtDetailModalProps) {
  const [debt, setDebt] = useState<DebtDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDebt = async () => {
      if (!debtId) return;

      setIsLoading(true);
      try {
        const result = await getSupplierDebtById(debtId);
        if (result.success && result.data) {
          setDebt(result.data);
        }
      } catch (error) {
        console.error("Error loading debt:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen && debtId) {
      loadDebt();
    }
  }, [isOpen, debtId]);

  if (!isOpen) return null;

  const paymentMethodLabels: Record<string, string> = {
    CASH: "Tunai",
    TRANSFER: "Transfer Bank",
    DEBIT_CARD: "Kartu Debit",
    CREDIT_CARD: "Kartu Kredit",
    QRIS: "QRIS",
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1C1917] border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-stone-100">Detail Utang Supplier</h2>
          <button
            onClick={onClose}
            className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-white/10 text-stone-400 hover:bg-white/15 hover:text-stone-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E5484D] mx-auto"></div>
            <p className="mt-4 text-stone-400">Memuat data...</p>
          </div>
        ) : debt ? (
          <div className="p-6 space-y-6">
            {/* Debt Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card p-4 space-y-3">
                <h3 className="font-semibold text-stone-100 mb-3">
                  Informasi Utang
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-stone-400">No. Utang:</span>
                    <span className="font-semibold">{debt.debtNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-stone-400">Status:</span>
                    <DebtStatusBadge status={debt.status} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-stone-400">Dibuat:</span>
                    <span className="text-sm">
                      {format(new Date(debt.createdAt), "dd MMM yyyy HH:mm", {
                        locale: id,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-stone-400">Jatuh Tempo:</span>
                    <span className="text-sm font-semibold text-red-300">
                      {format(new Date(debt.dueDate), "dd MMM yyyy", {
                        locale: id,
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="glass-card p-4 space-y-3">
                <h3 className="font-semibold text-stone-100 mb-3">
                  Informasi Supplier
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-stone-400">Kode:</span>
                    <span className="font-semibold">{debt.supplier.code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-stone-400">Nama:</span>
                    <span className="font-semibold">{debt.supplier.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-stone-400">Telepon:</span>
                    <span className="text-sm">
                      {debt.supplier.phone || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-stone-400">Alamat:</span>
                    <span className="text-sm text-right max-w-[200px]">
                      {debt.supplier.address || "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="glass-card p-4">
              <h3 className="font-semibold text-stone-100 mb-3">
                Ringkasan Keuangan
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-stone-400">
                    Total Utang Awal:
                  </span>
                  <span className="font-semibold">
                    {formatCurrency(debt.totalDebt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-stone-400">
                    Total Terbayar:
                  </span>
                  <span className="text-green-400 font-semibold">
                    {formatCurrency(debt.paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-white/10">
                  <span className="text-base font-semibold text-stone-100">
                    Sisa Utang:
                  </span>
                  <span className="text-xl font-bold text-red-300">
                    {formatCurrency(debt.remainingDebt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Purchase Info */}
            <div className="glass-card p-4">
              <h3 className="font-semibold text-stone-100 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Informasi Pembelian
              </h3>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-sm text-stone-400">PO Number:</span>
                  <span className="font-semibold">
                    {debt.purchase.poNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-stone-400">Tanggal:</span>
                  <span className="text-sm">
                    {format(new Date(debt.purchase.purchaseDate), "dd MMM yyyy", {
                      locale: id,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-stone-400">Grand Total:</span>
                  <span className="font-bold">
                    {formatCurrency(debt.purchase.grandTotal)}
                  </span>
                </div>
              </div>

              {/* Purchase Items */}
              {debt.purchase.purchaseItems && debt.purchase.purchaseItems.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-stone-300 mb-2">
                    Produk Dibeli:
                  </h4>
                  <div className="space-y-2">
                    {debt.purchase.purchaseItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between text-sm p-2 bg-white/5 rounded"
                      >
                        <span className="text-stone-300">
                          {item.product.name} ({item.quantity} {item.unit.name})
                        </span>
                        <span className="font-semibold">
                          {formatCurrency(item.subtotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Payment History */}
            {debt.payments && debt.payments.length > 0 && (
              <div className="glass-card p-4">
                <h3 className="font-semibold text-stone-100 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Riwayat Pembayaran ({debt.payments.length})
                </h3>
                <div className="space-y-3">
                  {debt.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="border border-white/10 rounded-xl p-3"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-green-400">
                            {formatCurrency(payment.amount)}
                          </p>
                          <p className="text-xs text-stone-400">
                            {format(
                              new Date(payment.paymentDate),
                              "dd MMM yyyy HH:mm",
                              { locale: id }
                            )}
                          </p>
                        </div>
                        <span className="text-xs bg-white/10 px-2 py-1 rounded">
                          {paymentMethodLabels[payment.paymentMethod] ||
                            payment.paymentMethod}
                        </span>
                      </div>
                      {payment.notes && (
                        <p className="text-sm text-stone-400 mt-2">
                          {payment.notes}
                        </p>
                      )}
                      {payment.admin && (
                        <p className="text-xs text-stone-400 mt-1">
                          Dicatat oleh: {payment.admin.name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {debt.notes && (
              <div className="glass-card p-4">
                <h3 className="font-semibold text-stone-100 mb-2">Catatan</h3>
                <p className="text-sm text-stone-400">{debt.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="text-stone-400">Data tidak ditemukan</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-white/10 px-6 py-4 bg-white/5">
          <button onClick={onClose} className="btn-secondary w-full">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}