"use client";

import { ReactNode } from "react";

interface POSLayoutProps {
  children: ReactNode;
  cart: ReactNode;
  customer: ReactNode;
  cartItemsCount: number; 
}

export function POSLayout({ children, cart, customer, cartItemsCount }: POSLayoutProps) {
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 space-y-2 p-6">
      {/* Header */}
      <div className="flex-shrink-0 h-14 md:h-16 glass-card border-b border-gray-200 flex items-center justify-between px-3 md:px-6">
        <div>
          <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
            Point of Sale
          </h1>
          <p className="text-[10px] md:text-xs text-gray-500 hidden md:block">Sistem Kasir TB Masdar Utama</p>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <div className="text-right">
            <p className="text-[10px] text-gray-500 hidden md:block">Tanggal</p>
            <p className="text-xs md:text-sm font-semibold text-gray-900">
              {new Date().toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content - RESPONSIVE */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Side - Products (Mobile: Full Width, Desktop: Flex-1) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Customer Selector */}
          <div className="flex-shrink-0 p-2 md:p-4">{customer}</div>

          {/* Products Area */}
          <div className="flex-1 overflow-y-auto p-2 md:p-4 pb-20 md:pb-4">{children}</div>
        </div>

        {/* Right Side - Cart (Mobile: Hidden, Desktop: Sidebar) */}
        <div className="hidden md:flex md:w-96 flex-shrink-0 glass-card border-l border-gray-200 flex-col mb-2">
          {cart}
        </div>
      </div>

      {/* Mobile Cart Button (Fixed Bottom) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 glass-card border-t border-gray-200 z-50">
        <button
          onClick={() => {
            // Akan ditambahkan fungsi untuk buka cart modal
            const event = new CustomEvent('openMobileCart');
            window.dispatchEvent(event);
          }}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
        >
          <span>Lihat Keranjang ({cartItemsCount})</span>
        </button>
      </div>
    </div>
  );
}