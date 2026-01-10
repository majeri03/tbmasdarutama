"use client";

import { Package, AlertTriangle, XCircle } from "lucide-react";

interface ProductStockBadgeProps {
  currentStock: number;
  minStock: number;
  size?: "sm" | "md" | "lg";
}

export function ProductStockBadge({
  currentStock,
  minStock,
  size = "md",
}: ProductStockBadgeProps) {
  const sizes = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  // Determine stock status
  const getStockStatus = () => {
    if (currentStock === 0) {
      return {
        label: "Habis",
        className: "bg-red-100 text-red-700 border border-red-200",
        icon: <XCircle className={iconSizes[size]} />,
      };
    } else if (currentStock <= minStock) {
      return {
        label: "Menipis",
        className: "bg-orange-100 text-orange-700 border border-orange-200",
        icon: <AlertTriangle className={iconSizes[size]} />,
      };
    } else {
      return {
        label: "Tersedia",
        className: "bg-green-100 text-green-700 border border-green-200",
        icon: <Package className={iconSizes[size]} />,
      };
    }
  };

  const status = getStockStatus();

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${sizes[size]} ${status.className}`}
    >
      {status.icon}
      <span>{status.label}</span>
    </span>
  );
}