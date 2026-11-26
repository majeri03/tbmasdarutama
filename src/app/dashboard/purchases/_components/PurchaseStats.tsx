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
    },
    {
      title: "Pending PO",
      value: stats.pendingCount,
      icon: <Clock className="w-6 h-6" />,
    },
    {
      title: "PO Bulan Ini",
      value: stats.totalThisMonth,
      icon: <CheckCircle className="w-6 h-6" />,
    },
    {
      title: "Total Nilai (Bulan Ini)",
      value: formatCurrency(stats.totalValue),
      icon: <DollarSign className="w-6 h-6" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {statCards.map((stat, index) => (
        <div key={index} className="glass-card p-4 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-400 mb-1">{stat.title}</p>
              <p className="text-2xl font-semibold tabular-nums text-stone-100">{stat.value}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/10 border border-white/10 text-stone-400">
              {stat.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}