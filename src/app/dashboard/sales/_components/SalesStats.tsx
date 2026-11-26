"use client";

import { useEffect, useState } from "react";
import { getTodaySalesStats } from "@/lib/actions/sale.actions";
import { ShoppingCart, TrendingUp, Clock, DollarSign } from "lucide-react";

export function SalesStats({ refreshKey = 0 }: { refreshKey?: number }) {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    todaySales: 0,
    pendingSales: 0,
  });
  const [loading, setLoading] = useState(true);

  // WS-D item 46: dulu useEffect([]) — kartu hanya dimuat sekali saat
  // halaman dibuka, sehingga setelah penjualan baru dibuat/dibatalkan kartu
  // tampil stale. Halaman induk menaikkan refreshKey setiap kali daftar
  // berhasil dimuat ulang, supaya kartu ikut termuat ulang.
  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

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
    },
    {
      title: "Total Pendapatan",
      value: `Rp ${stats.totalRevenue.toLocaleString("id-ID")}`,
      icon: DollarSign,
    },
    {
      title: "Penjualan Hari Ini",
      value: stats.todaySales,
      icon: TrendingUp,
    },
    {
      title: "Pending",
      value: stats.pendingSales,
      icon: Clock,
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-6 animate-pulse">
            <div className="h-4 bg-white/10 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-white/10 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
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
                <h3 className="text-sm font-medium text-stone-400">{stat.title}</h3>
                <div
                  className="w-12 h-12 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center"
                >
                  <Icon className="w-6 h-6 text-stone-400" />
                </div>
              </div>
              <p className="text-2xl font-semibold tabular-nums text-stone-100">{stat.value}</p>
            </div>
          );
        })}
      </div>
      {/* WS-D item 46 + 57: jelaskan apa yang dihitung kartu ini, supaya
          angkanya bisa dicocokkan dengan daftar di bawahnya. */}
      <p className="text-xs text-stone-400 -mt-4 mb-2">
        Total &amp; pendapatan hanya menghitung penjualan aktif (Selesai +
        Pending). Penjualan yang Dibatalkan atau di-Retur tidak dihitung.
        &ldquo;Hari Ini&rdquo; memakai waktu WITA.
      </p>
    </>
  );
}