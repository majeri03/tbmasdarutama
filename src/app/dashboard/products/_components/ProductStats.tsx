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
    },
    {
      label: "Produk Aktif",
      value: activeProducts,
      icon: TrendingUp,
    },
    {
      label: "Stok Menipis",
      value: lowStockProducts,
      icon: AlertTriangle,
      alert: lowStockProducts > 0,
    },
    {
      label: "Produk Nonaktif",
      value: inactiveProducts,
      icon: PowerOff,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={`glass-card p-6 ${stat.alert ? "animate-pulse-slow" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-stone-500 mb-1">
                  {stat.label}
                </p>
                <p className="text-3xl font-semibold tabular-nums text-stone-900">
                  {stat.value.toLocaleString("id-ID")}
                </p>
                {stat.alert && stat.value > 0 && (
                  <p className="text-xs text-amber-700 font-semibold mt-1">
                    ⚠️ Perlu perhatian!
                  </p>
                )}
              </div>
              <div
                className="bg-stone-100 p-4 rounded-xl border border-stone-200"
              >
                <Icon className="w-8 h-8 text-stone-600" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}