"use client";

import { ReactNode } from "react";

interface POSLayoutProps {
  children: ReactNode;
  cart: ReactNode;
  customer: ReactNode;
}

export function POSLayout({ children, cart, customer }: POSLayoutProps) {
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="flex-shrink-0 h-16 glass-card border-b border-gray-200 flex items-center justify-between px-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
            Point of Sale
          </h1>
          <p className="text-xs text-gray-500">Sistem Kasir TB Masdar Utama</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-500">Tanggal</p>
            <p className="text-sm font-semibold text-gray-900">
              {new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Products */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Customer Selector */}
          <div className="flex-shrink-0 p-4">{customer}</div>

          {/* Products Area */}
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </div>

        {/* Right Side - Cart */}
        <div className="w-96 flex-shrink-0 glass-card border-l border-gray-200 flex flex-col">
          {cart}
        </div>
      </div>
    </div>
  );
}