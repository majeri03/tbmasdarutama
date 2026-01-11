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
      color: "bg-blue-500",
      textColor: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Sedang Dikirim",
      value: stats.inTransit.toString(),
      icon: <Truck className="w-5 h-5" />,
      color: "bg-orange-500",
      textColor: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Terkirim Hari Ini",
      value: stats.deliveredToday.toString(),
      icon: <CheckCircle className="w-5 h-5" />,
      color: "bg-green-500",
      textColor: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Menunggu Dikirim",
      value: stats.pendingCount.toString(),
      icon: <Clock className="w-5 h-5" />,
      color: "bg-gray-500",
      textColor: "text-gray-600",
      bgColor: "bg-gray-50",
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