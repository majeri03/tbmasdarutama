"use client";

import { CheckCircle, XCircle } from "lucide-react";

interface SupplierStatusBadgeProps {
  isActive: boolean;
  size?: "sm" | "md" | "lg";
}

export function SupplierStatusBadge({ isActive, size = "md" }: SupplierStatusBadgeProps) {
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

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${sizes[size]} ${
        isActive
          ? "bg-green-100 text-green-700 border border-green-200"
          : "bg-red-100 text-red-700 border border-red-200"
      }`}
    >
      {isActive ? (
        <CheckCircle className={iconSizes[size]} />
      ) : (
        <XCircle className={iconSizes[size]} />
      )}
      <span>{isActive ? "Aktif" : "Nonaktif"}</span>
    </span>
  );
}