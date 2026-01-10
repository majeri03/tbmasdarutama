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
      color: "blue",
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
      borderColor: "border-blue-200",
    },
    {
      title: "Nilai Modal Stock",
      value: formatCurrency(totalBuyValue),
      icon: DollarSign,
      color: "green",
      bgColor: "bg-green-50",
      iconColor: "text-green-600",
      borderColor: "border-green-200",
      subtitle: `Jual: ${formatCurrency(totalSellValue)}`,
    },
    {
      title: "Stock Masuk (Bulan Ini)",
      value: stockInMonth.toLocaleString("id-ID"),
      icon: TrendingUp,
      color: "emerald",
      bgColor: "bg-emerald-50",
      iconColor: "text-emerald-600",
      borderColor: "border-emerald-200",
      subtitle: "unit",
    },
    {
      title: "Stock Keluar (Bulan Ini)",
      value: stockOutMonth.toLocaleString("id-ID"),
      icon: TrendingDown,
      color: "orange",
      bgColor: "bg-orange-50",
      iconColor: "text-orange-600",
      borderColor: "border-orange-200",
      subtitle: "unit",
    },
    {
      title: "Stock Rendah",
      value: lowStockCount.toLocaleString("id-ID"),
      icon: AlertTriangle,
      color: "red",
      bgColor: "bg-red-50",
      iconColor: "text-red-600",
      borderColor: "border-red-200",
      subtitle: "produk perlu restock",
    },
    {
      title: "Pergerakan Hari Ini",
      value: movementsToday.toLocaleString("id-ID"),
      icon: Activity,
      color: "purple",
      bgColor: "bg-purple-50",
      iconColor: "text-purple-600",
      borderColor: "border-purple-200",
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
            className={`glass-card border-2 ${stat.borderColor} hover:shadow-lg transition-all duration-200`}
          >
            <div className="flex items-start justify-between p-6">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {stat.title}
                </p>
                <p className="text-2xl font-bold text-gray-900 mb-1">
                  {stat.value}
                </p>
                {stat.subtitle && (
                  <p className="text-xs text-gray-500">{stat.subtitle}</p>
                )}
              </div>
              <div
                className={`${stat.bgColor} ${stat.iconColor} p-3 rounded-xl`}
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