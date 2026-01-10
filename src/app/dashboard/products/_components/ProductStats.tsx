"use client";

import { Package, TrendingUp, AlertTriangle, PowerOff } from "lucide-react";

interface ProductStatsProps {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  lowStockProducts: number;
}

export function ProductStats({
  totalProducts,
  activeProducts,
  inactiveProducts,
  lowStockProducts,
}: ProductStatsProps) {
  const stats = [
    {
      label: "Total Produk",
      value: totalProducts,
      icon: Package,
      color: "blue",
      bgColor: "bg-blue-100",
      textColor: "text-blue-600",
      borderColor: "border-blue-200",
    },
    {
      label: "Produk Aktif",
      value: activeProducts,
      icon: TrendingUp,
      color: "green",
      bgColor: "bg-green-100",
      textColor: "text-green-600",
      borderColor: "border-green-200",
    },
    {
      label: "Stok Menipis",
      value: lowStockProducts,
      icon: AlertTriangle,
      color: "orange",
      bgColor: "bg-orange-100",
      textColor: "text-orange-600",
      borderColor: "border-orange-200",
      alert: lowStockProducts > 0,
    },
    {
      label: "Produk Nonaktif",
      value: inactiveProducts,
      icon: PowerOff,
      color: "gray",
      bgColor: "bg-gray-100",
      textColor: "text-gray-600",
      borderColor: "border-gray-200",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={`glass-card p-6 border-2 ${stat.borderColor} ${
              stat.alert ? "animate-pulse-slow" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {stat.label}
                </p>
                <p className={`text-3xl font-bold ${stat.textColor}`}>
                  {stat.value.toLocaleString("id-ID")}
                </p>
                {stat.alert && stat.value > 0 && (
                  <p className="text-xs text-orange-600 font-semibold mt-1">
                    ⚠️ Perlu perhatian!
                  </p>
                )}
              </div>
              <div
                className={`${stat.bgColor} p-4 rounded-xl border-2 ${stat.borderColor}`}
              >
                <Icon className={`w-8 h-8 ${stat.textColor}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}