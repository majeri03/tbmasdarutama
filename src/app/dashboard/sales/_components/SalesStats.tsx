"use client";

import { useEffect, useState } from "react";
import { getTodaySalesStats } from "@/lib/actions/sale.actions";
import { ShoppingCart, TrendingUp, Clock, DollarSign } from "lucide-react";

export function SalesStats() {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    todaySales: 0,
    pendingSales: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const result = await getTodaySalesStats();
      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Penjualan",
      value: stats.totalSales,
      icon: ShoppingCart,
      gradient: "from-blue-500 to-blue-600",
    },
    {
      title: "Total Pendapatan",
      value: `Rp ${stats.totalRevenue.toLocaleString("id-ID")}`,
      icon: DollarSign,
      gradient: "from-green-500 to-green-600",
    },
    {
      title: "Penjualan Hari Ini",
      value: stats.todaySales,
      icon: TrendingUp,
      gradient: "from-purple-500 to-purple-600",
    },
    {
      title: "Pending",
      value: stats.pendingSales,
      icon: Clock,
      gradient: "from-orange-500 to-orange-600",
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-6 animate-pulse">
            <div className="h-4 bg-gray-300 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-300 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className="glass-card-hover p-6 animate-slide-up"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">{stat.title}</h3>
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}
              >
                <Icon className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
          </div>
        );
      })}
    </div>
  );
}