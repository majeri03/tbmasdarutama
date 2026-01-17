"use client";

import { CartItem as CartItemType } from "@/types/pos";
import { formatCurrency } from "@/lib/utils/pos-helpers";
import { Minus, Plus, Trash2 } from "lucide-react";

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (productId: string, unitId: string, quantity: number) => void;
  onUpdateDiscount: (productId: string, unitId: string, discount: number) => void;
  onRemove: (productId: string, unitId: string) => void;
  onUpdateUnit?: (itemId: string, newUnitId: string, newPrice: number) => void;
}

export function CartItem({ item, onUpdateQuantity, onUpdateDiscount, onRemove, onUpdateUnit}: CartItemProps) {
  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newUnitId = e.target.value;
    // Cari data unit yang dipilih dari availableUnits
    const selectedUnit = item.availableUnits.find(u => u.unitId === newUnitId);
    
    if (selectedUnit && onUpdateUnit) {
      // Panggil fungsi update di parent
      onUpdateUnit(item.id, selectedUnit.unitId, selectedUnit.price);
    }
  };
  return (
    <div className="p-3 bg-white/50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
      {/* Product Name */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 text-sm truncate">{item.productName}</h4>
          
          {/* LOGIC DROPDOWN DISINI */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">{item.productCode} •</span>
            
            {item.availableUnits && item.availableUnits.length > 1 ? (
              // Jika ada lebih dari 1 satuan, tampilkan Dropdown
              <select 
                className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                value={item.unitId}
                onChange={handleUnitChange}
              >
                {item.availableUnits.map((unit) => (
                  <option key={unit.unitId} value={unit.unitId}>
                    {unit.unitName}
                  </option>
                ))}
              </select>
            ) : (
              // Jika cuma 1 satuan, tampilkan teks biasa
              <span className="text-xs text-gray-500">{item.unitName}</span>
            )}
          </div>

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