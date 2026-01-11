"use client";

import { DollarSign, Users, AlertCircle, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils/pos-helpers";

interface CustomerDebtStatsProps {
  stats: {
    activeDebts: number;
    overdueCount: number;
    paidThisMonth: number;
    totalActive: number;
  };
}

export function CustomerDebtStats({ stats }: CustomerDebtStatsProps) {
  const cards = [
    {
      title: "Total Piutang Aktif",
      value: formatCurrency(stats.totalActive),
      icon: <DollarSign className="w-5 h-5" />,
      color: "bg-blue-500",
      textColor: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Piutang Berjalan",
      value: stats.activeDebts.toString(),
      icon: <Users className="w-5 h-5" />,
      color: "bg-green-500",
      textColor: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Jatuh Tempo",
      value: stats.overdueCount.toString(),
      icon: <AlertCircle className="w-5 h-5" />,
      color: "bg-red-500",
      textColor: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Pembayaran Bulan Ini",
      value: formatCurrency(stats.paidThisMonth),
      icon: <TrendingUp className="w-5 h-5" />,
      color: "bg-purple-500",
      textColor: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <div key={index} className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">{card.title}</p>
              <p className={`text-2xl font-bold ${card.textColor}`}>
                {card.value}
              </p>
            </div>
            <div className={`${card.bgColor} p-3 rounded-lg`}>
              <div className={`${card.textColor}`}>{card.icon}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}