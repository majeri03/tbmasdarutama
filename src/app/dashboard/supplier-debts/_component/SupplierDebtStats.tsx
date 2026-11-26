"use client";

import { DollarSign, Users, AlertCircle, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils/pos-helpers";

interface SupplierDebtStatsProps {
  stats: {
    activeDebts: number;
    overdueCount: number;
    paidThisMonth: number;
    totalActive: number;
  };
}

export function SupplierDebtStats({ stats }: SupplierDebtStatsProps) {
  const cards = [
    {
      title: "Total Utang Aktif",
      value: formatCurrency(stats.totalActive),
      icon: <DollarSign className="w-5 h-5" />,
    },
    {
      title: "Utang Berjalan",
      value: stats.activeDebts.toString(),
      icon: <Users className="w-5 h-5" />,
    },
    {
      title: "Jatuh Tempo",
      value: stats.overdueCount.toString(),
      icon: <AlertCircle className="w-5 h-5" />,
    },
    {
      title: "Pembayaran Bulan Ini",
      value: formatCurrency(stats.paidThisMonth),
      icon: <TrendingDown className="w-5 h-5" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <div key={index} className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-400 mb-1">{card.title}</p>
              <p className="text-2xl font-semibold tabular-nums text-stone-100">
                {card.value}
              </p>
            </div>
            <div className="bg-white/10 border border-white/10 p-3 rounded-lg">
              <div className="text-stone-400">{card.icon}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}