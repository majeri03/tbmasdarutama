"use client";

import { ShoppingCart, Clock, CheckCircle, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils/pos-helpers";

interface PurchaseStatsProps {
  stats: {
    totalPurchases: number;
    pendingCount: number;
    totalThisMonth: number;
    totalValue: number;
  };
}

export function PurchaseStats({ stats }: PurchaseStatsProps) {
  const statCards = [
    {
      title: "Total Purchase Orders",
      value: stats.totalPurchases,
      icon: <ShoppingCart className="w-6 h-6" />,
      bgGradient: "from-blue-500 to-blue-600",
      textColor: "text-blue-600",
      bgLight: "bg-blue-50",
    },
    {
      title: "Pending PO",
      value: stats.pendingCount,
      icon: <Clock className="w-6 h-6" />,
      bgGradient: "from-yellow-500 to-yellow-600",
      textColor: "text-yellow-600",
      bgLight: "bg-yellow-50",
    },
    {
      title: "PO Bulan Ini",
      value: stats.totalThisMonth,
      icon: <CheckCircle className="w-6 h-6" />,
      bgGradient: "from-green-500 to-green-600",
      textColor: "text-green-600",
      bgLight: "bg-green-50",
    },
    {
      title: "Total Nilai (Bulan Ini)",
      value: formatCurrency(stats.totalValue),
      icon: <DollarSign className="w-6 h-6" />,
      bgGradient: "from-purple-500 to-purple-600",
      textColor: "text-purple-600",
      bgLight: "bg-purple-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {statCards.map((stat, index) => (
        <div key={index} className="glass-card p-4 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">{stat.title}</p>
              <p className={`text-2xl font-bold ${stat.textColor}`}>{stat.value}</p>
            </div>
            <div className={`p-3 rounded-lg bg-gradient-to-br ${stat.bgGradient} text-white`}>
              {stat.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}