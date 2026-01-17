"use client";

import { CartItem as CartItemType, POSCustomer } from "@/types/pos";
import { CartItem } from "./CartItem";
import { CartSummary } from "./CartSummary";
import { calculateCart } from "@/lib/utils/pos-helpers";
import { ShoppingCart as CartIcon, X } from "lucide-react";

interface ShoppingCartProps {
  items: CartItemType[];
  customer: POSCustomer | null;
  discount: number;
  onUpdateQuantity: (productId: string, unitId: string, quantity: number) => void;
  onUpdateDiscount: (productId: string, unitId: string, discount: number) => void;
  onRemoveItem: (productId: string, unitId: string) => void;
  onDiscountChange: (discount: number) => void;
  onClear: () => void;
  onUpdateUnit: (itemId: string, newUnitId: string, newPrice: number) => void;
}

export function ShoppingCart({
  items,
  customer,
  discount,
  onUpdateQuantity,
  onUpdateDiscount,
  onRemoveItem,
  onDiscountChange,
  onClear,
  onUpdateUnit,
}: ShoppingCartProps) {
  const calculation = calculateCart(items, customer, discount);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <CartIcon className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Keranjang ({items.length})
          </h2>
        </div>
        {items.length > 0 && (
          <button
            onClick={onClear}
            className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Kosongkan
          </button>
        )}
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <CartIcon className="w-16 h-16 mb-4" />
            <p className="text-sm">Keranjang masih kosong</p>
            <p className="text-xs">Tambahkan produk untuk mulai transaksi</p>
          </div>
        ) : (
          items.map((item) => (
            <CartItem
              key={`${item.productId}-${item.unitId}`}
              item={item}
              onUpdateQuantity={onUpdateQuantity}
              onUpdateDiscount={onUpdateDiscount}
              onRemove={onRemoveItem}
              onUpdateUnit={onUpdateUnit}
            />
          ))
        )}
      </div>

      {/* Summary */}
      {items.length > 0 && (
        <div className="border-t border-gray-200 p-4">
          <CartSummary
            calculation={calculation}
            customer={customer}
            discount={discount}
            onDiscountChange={onDiscountChange}
          />
        </div>
      )}
    </div>
  );
}