"use client";

import { useState } from "react";
import { X, DollarSign } from "lucide-react";
import { SupplierDebtData } from "@/types/supplier-debt";
import { PaymentMethod } from "@prisma/client";
import { addSupplierDebtPayment } from "@/lib/actions/supplier-debt.actions";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils/pos-helpers";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  debt: SupplierDebtData | null;
}

export function PaymentModal({
  isOpen,
  onClose,
  onSuccess,
  debt,
}: PaymentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("TRANSFER");
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
        showToast("Jumlah pembayaran melebihi sisa utang", "error");
        setIsLoading(false);
        return;
      }

      const result = await addSupplierDebtPayment({
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
    setPaymentMethod("TRANSFER");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setNotes("");
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1C1917] border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-stone-100">Bayar Utang Supplier</h2>
          <button
            onClick={onClose}
            className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-white/10 text-stone-400 hover:bg-white/15 hover:text-stone-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Debt Info */}
          <div className="glass-card p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-stone-400">Supplier:</span>
              <span className="font-semibold">{debt.supplier.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-stone-400">No. Utang:</span>
              <span className="font-semibold">{debt.debtNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-stone-400">Total Utang:</span>
              <span className="font-semibold">
                {formatCurrency(debt.totalDebt)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-stone-400">Sudah Dibayar:</span>
              <span className="text-green-400 font-semibold">
                {formatCurrency(debt.paidAmount)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-white/10">
              <span className="text-sm text-stone-400">Sisa Utang:</span>
              <span className="text-lg font-bold text-red-300">
                {formatCurrency(debt.remainingDebt)}
              </span>
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div>
            <label className="label mb-2">
              Pilih Cepat
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleQuickAmount(25)}
                className="px-4 py-2 border border-white/15 rounded-xl hover:bg-white/5 text-sm font-medium"
              >
                25%
              </button>
              <button
                type="button"
                onClick={() => handleQuickAmount(50)}
                className="px-4 py-2 border border-white/15 rounded-xl hover:bg-white/5 text-sm font-medium"
              >
                50%
              </button>
              <button
                type="button"
                onClick={() => handleQuickAmount(75)}
                className="px-4 py-2 border border-white/15 rounded-xl hover:bg-white/5 text-sm font-medium"
              >
                75%
              </button>
              <button
                type="button"
                onClick={() => handleQuickAmount(100)}
                className="px-4 py-2 border border-[#E5484D] bg-[#E5484D]/10 text-[#E5484D] rounded-xl hover:bg-[#E5484D]/15 text-sm font-medium"
              >
                Lunas
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="label mb-2">
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
            <label className="label mb-2">
              Metode Pembayaran <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="input-field [color-scheme:dark]"
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
            <label className="label mb-2">
              Tanggal Bayar <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="input-field [color-scheme:dark]"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="label mb-2">
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
          <div className="flex gap-3 pt-4 -mx-6 -mb-6 px-6 pb-6 bg-white/5 border-t border-white/10 rounded-b-3xl">
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