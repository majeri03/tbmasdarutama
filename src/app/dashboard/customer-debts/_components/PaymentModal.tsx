"use client";

import { useState } from "react";
import { X, DollarSign } from "lucide-react";
import { CustomerDebtData } from "@/types/customer-debt";
import { PaymentMethod } from "@prisma/client";
import { addCustomerDebtPayment } from "@/lib/actions/customer-debt.actions";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils/pos-helpers";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  debt: CustomerDebtData | null;
}

export function PaymentModal({
  isOpen,
  onClose,
  onSuccess,
  debt,
}: PaymentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const { showToast } = useToast();

  if (!isOpen || !debt) return null;

  const handleQuickAmount = (percentage: number) => {
    const calculatedAmount = (debt.remainingDebt * percentage) / 100;
    setAmount(calculatedAmount.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const amountNum = parseFloat(amount);

      if (amountNum <= 0) {
        showToast("Jumlah pembayaran harus lebih dari 0", "error");
        setIsLoading(false);
        return;
      }

      if (amountNum > debt.remainingDebt) {
        showToast("Jumlah pembayaran melebihi sisa piutang", "error");
        setIsLoading(false);
        return;
      }

      const result = await addCustomerDebtPayment({
        debtId: debt.id,
        amount: amountNum,
        paymentMethod,
        paymentDate: new Date(paymentDate),
        notes: notes || undefined,
      });

      if (result.success) {
        showToast(result.message || "Pembayaran berhasil dicatat", "success");
        onSuccess();
        onClose();
        resetForm();
      } else {
        showToast(result.error || "Gagal mencatat pembayaran", "error");
      }
    } catch (error) {
      console.error("Error adding payment:", error);
      showToast("Terjadi kesalahan", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setAmount("");
    setPaymentMethod("CASH");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setNotes("");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Bayar Piutang</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Debt Info */}
          <div className="glass-card p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Customer:</span>
              <span className="font-semibold">{debt.customer.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">No. Piutang:</span>
              <span className="font-semibold">{debt.debtNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Piutang:</span>
              <span className="font-semibold">
                {formatCurrency(debt.totalDebt)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Sudah Dibayar:</span>
              <span className="text-green-600 font-semibold">
                {formatCurrency(debt.paidAmount)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-sm text-gray-600">Sisa Piutang:</span>
              <span className="text-lg font-bold text-red-600">
                {formatCurrency(debt.remainingDebt)}
              </span>
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pilih Cepat
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleQuickAmount(25)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                25%
              </button>
              <button
                type="button"
                onClick={() => handleQuickAmount(50)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                50%
              </button>
              <button
                type="button"
                onClick={() => handleQuickAmount(75)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                75%
              </button>
              <button
                type="button"
                onClick={() => handleQuickAmount(100)}
                className="px-4 py-2 border border-blue-500 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm font-medium"
              >
                Lunas
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Jumlah Bayar <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-field"
              placeholder="Masukkan jumlah bayar"
              required
              min="0"
              step="0.01"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Metode Pembayaran <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="input-field"
              required
            >
              <option value="CASH">Cash</option>
              <option value="TRANSFER">Transfer</option>
              <option value="DEBIT_CARD">Debit Card</option>
              <option value="QRIS">QRIS</option>
            </select>
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tanggal Bayar <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="input-field"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Catatan
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field"
              rows={3}
              placeholder="Catatan pembayaran (opsional)"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={isLoading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                "Memproses..."
              ) : (
                <>
                  <DollarSign className="w-4 h-4" />
                  Bayar Sekarang
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}