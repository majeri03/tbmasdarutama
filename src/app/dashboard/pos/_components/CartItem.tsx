"use client";

import { CartItem as CartItemType } from "@/types/pos";
import { formatCurrency } from "@/lib/utils/pos-helpers";
import { Minus, Plus, Trash2 } from "lucide-react";

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (productId: string, unitId: string, quantity: number) => void;
  onUpdateDiscount: (productId: string, unitId: string, discount: number) => void;
  onRemove: (productId: string, unitId: string) => void;
}

export function CartItem({ item, onUpdateQuantity, onUpdateDiscount, onRemove }: CartItemProps) {
  return (
    <div className="p-3 bg-white/50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
      {/* Product Name */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 text-sm truncate">{item.productName}</h4>
          <p className="text-xs text-gray-500">
            {item.productCode} • {item.unitName}
          </p>
        </div>
        <button
          onClick={() => onRemove(item.productId, item.unitId)}
          className="text-red-500 hover:text-red-700 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Price */}
      <div className="text-sm text-gray-700 mb-2">
        {formatCurrency(item.unitPrice)} x {item.quantity} = {formatCurrency(item.unitPrice * item.quantity)}
      </div>

      {/* Quantity Controls */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-500 w-16">Jumlah:</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onUpdateQuantity(item.productId, item.unitId, item.quantity - 1)}
            disabled={item.quantity <= 1}
            className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Minus className="w-3 h-3" />
          </button>
          <input
            type="number"
            value={item.quantity}
            onChange={(e) => {
              const qty = parseInt(e.target.value) || 1;
              onUpdateQuantity(item.productId, item.unitId, qty);
            }}
            className="w-14 h-7 text-center border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            min="1"
          />
          <button
            onClick={() => onUpdateQuantity(item.productId, item.unitId, item.quantity + 1)}
            className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Discount */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-16">Diskon:</span>
        <div className="flex items-center gap-1 flex-1">
          <span className="text-xs text-gray-500">Rp</span>
          <input
            type="number"
            value={item.discount}
            onChange={(e) => {
              const discount = parseFloat(e.target.value) || 0;
              onUpdateDiscount(item.productId, item.unitId, discount);
            }}
            className="flex-1 h-7 px-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            min="0"
            placeholder="0"
          />
        </div>
      </div>

      {/* Subtotal */}
      <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between items-center">
        <span className="text-xs text-gray-500">Subtotal:</span>
        <span className="font-semibold text-blue-600">{formatCurrency(item.subtotal)}</span>
      </div>
    </div>
  );
}