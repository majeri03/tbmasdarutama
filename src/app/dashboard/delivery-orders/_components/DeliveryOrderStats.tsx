"use client";

import { Package, Truck, CheckCircle, Clock } from "lucide-react";

interface DeliveryOrderStatsProps {
  stats: {
    totalDeliveries: number;
    inTransit: number;
    deliveredToday: number;
    pendingCount: number;
  };
}

export function DeliveryOrderStats({ stats }: DeliveryOrderStatsProps) {
  const cards = [
    {
      title: "Total Pengiriman",
      value: stats.totalDeliveries.toString(),
      icon: <Package className="w-5 h-5" />,
    },
    {
      title: "Sedang Dikirim",
      value: stats.inTransit.toString(),
      icon: <Truck className="w-5 h-5" />,
    },
    {
      title: "Terkirim Hari Ini",
      value: stats.deliveredToday.toString(),
      icon: <CheckCircle className="w-5 h-5" />,
    },
    {
      title: "Menunggu Dikirim",
      value: stats.pendingCount.toString(),
      icon: <Clock className="w-5 h-5" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <div key={index} className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-500 mb-1">{card.title}</p>
              <p className="text-2xl font-semibold tabular-nums text-stone-900">
                {card.value}
              </p>
            </div>
            <div className="bg-stone-100 border border-stone-200 p-3 rounded-lg">
              <div className="text-stone-600">{card.icon}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}