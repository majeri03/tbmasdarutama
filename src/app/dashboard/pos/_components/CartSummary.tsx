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
    <div className="glass-card p-4 space-y-3">
      {/* Subtotal */}
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Subtotal</span>
        <span className="font-medium">{formatCurrency(calculation.subtotal)}</span>
      </div>

      {/* Item Discount */}
      {calculation.itemDiscount > 0 && (
        <div className="flex justify-between text-sm text-orange-600">
          <span>Diskon Item</span>
          <span>- {formatCurrency(calculation.itemDiscount)}</span>
        </div>
      )}

      {/* Additional Discount */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600 whitespace-nowrap">Diskon Total:</span>
        <div className="flex items-center gap-1 flex-1">
          <span className="text-xs text-gray-500">Rp</span>
          <input
            type="number"
            value={discount}
            onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
            className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            min="0"
            placeholder="0"
          />
        </div>
      </div>

      {/* Customer Discount */}
      {customer && calculation.customerDiscount > 0 && (
        <div className="flex justify-between text-sm text-green-600">
          <span>Diskon Customer ({customer.type})</span>
          <span>- {formatCurrency(calculation.customerDiscount)}</span>
        </div>
      )}

      {/* Tax (if any) */}
      {calculation.tax > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Pajak</span>
          <span className="font-medium">{formatCurrency(calculation.tax)}</span>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-gray-300 pt-3">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-gray-900">TOTAL</span>
          <span className="text-2xl font-bold text-blue-600">
            {formatCurrency(calculation.grandTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}