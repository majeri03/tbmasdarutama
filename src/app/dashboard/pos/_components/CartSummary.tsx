"use client";

import { CartCalculation, POSCustomer } from "@/types/pos";
import { formatCurrency } from "@/lib/utils/pos-helpers";

interface CartSummaryProps {
  calculation: CartCalculation;
  customer: POSCustomer | null;
  discount: number;
  onDiscountChange: (discount: number) => void;
}

export function CartSummary({ calculation, customer, discount, onDiscountChange }: CartSummaryProps) {
  return (
    <div className="glass-panel-strong rounded-2xl p-4 space-y-3">
      {/* Subtotal */}
      <div className="flex justify-between text-sm">
        <span className="text-stone-600">Subtotal</span>
        <span className="font-medium">{formatCurrency(calculation.subtotal)}</span>
      </div>

      {/* Item Discount */}
      {calculation.itemDiscount > 0 && (
        <div className="flex justify-between text-sm text-[#B45309]">
          <span>Diskon Item</span>
          <span>- {formatCurrency(calculation.itemDiscount)}</span>
        </div>
      )}

      {/* Additional Discount */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-stone-600 whitespace-nowrap">Diskon Total:</span>
        <div className="flex items-center gap-1 flex-1">
          <span className="text-xs text-stone-500">Rp</span>
          <input
            type="number"
            value={discount}
            onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
            className="flex-1 px-2 py-1 text-sm border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-[#7F1D1D]"
            min="0"
            placeholder="0"
          />
        </div>
      </div>

      {/* Customer Discount */}
      {customer && calculation.customerDiscount > 0 && (
        <div className="flex justify-between text-sm text-[#15803D]">
          <span>Diskon Customer ({customer.type})</span>
          <span>- {formatCurrency(calculation.customerDiscount)}</span>
        </div>
      )}

      {/* Tax (if any) */}
      {calculation.tax > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-stone-600">Pajak</span>
          <span className="font-medium">{formatCurrency(calculation.tax)}</span>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-stone-300 pt-3">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-stone-900">TOTAL</span>
          <span className="text-2xl font-bold tabular-nums text-[#7F1D1D]">
            {formatCurrency(calculation.grandTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}