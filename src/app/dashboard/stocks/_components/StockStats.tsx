"use client";

import {
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Activity,
} from "lucide-react";

interface StockStatsProps {
  totalProducts: number;
  totalBuyValue: number;
  totalSellValue: number;
  lowStockCount: number;
  movementsToday: number;
  stockInMonth: number;
  stockOutMonth: number;
}

export function StockStats({
  totalProducts,
  totalBuyValue,
  totalSellValue,
  lowStockCount,
  movementsToday,
  stockInMonth,
  stockOutMonth,
}: StockStatsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const stats = [
    {
      title: "Total Produk",
      value: totalProducts.toLocaleString("id-ID"),
      icon: Package,
    },
    {
      title: "Nilai Modal Stock",
      value: formatCurrency(totalBuyValue),
      icon: DollarSign,
      subtitle: `Jual: ${formatCurrency(totalSellValue)}`,
    },
    {
      title: "Stock Masuk (Bulan Ini)",
      value: stockInMonth.toLocaleString("id-ID"),
      icon: TrendingUp,
      subtitle: "unit",
    },
    {
      title: "Stock Keluar (Bulan Ini)",
      value: stockOutMonth.toLocaleString("id-ID"),
      icon: TrendingDown,
      subtitle: "unit",
    },
    {
      title: "Stock Rendah",
      value: lowStockCount.toLocaleString("id-ID"),
      icon: AlertTriangle,
      subtitle: "produk perlu restock",
    },
    {
      title: "Pergerakan Hari Ini",
      value: movementsToday.toLocaleString("id-ID"),
      icon: Activity,
      subtitle: "transaksi",
    },
  ];

  return (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className="glass-card hover:shadow-lg transition-all duration-200"
          >
            <div className="flex items-start justify-between p-6">
              <div className="flex-1">
                <p className="text-sm font-medium text-stone-400 mb-1">
                  {stat.title}
                </p>
                <p className="text-2xl font-semibold tabular-nums text-stone-100 mb-1">
                  {stat.value}
                </p>
                {stat.subtitle && (
                  <p className="text-xs text-stone-400">{stat.subtitle}</p>
                )}
              </div>
              <div
                className="bg-white/10 text-stone-400 p-3 rounded-xl border border-white/10"
              >
                <Icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}