import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Store,
  Package,
  Users,
  TrendingUp,
  AlertCircle,
  ShoppingCart,
  DollarSign,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from "lucide-react";
import { getDashboardStats } from "@/lib/actions/dashboard.actions";
import Link from "next/link";
export default async function DashboardPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }
  const statsResult = await getDashboardStats();
  const stats = statsResult.success ? statsResult.data : null;
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="glass-card p-6 animate-slide-up">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gradient mb-2">
                Dashboard
              </h1>
              <p className="text-gray-600">
                Selamat datang kembali, <span className="text-gray-900 font-semibold">{session.user.name}</span>
              </p>
              <div className="flex items-center gap-2 mt-3">
                <div className="badge badge-info">
                  {session.user.role.replace('_', ' ')}
                </div>
                <span className="text-gray-400 text-sm">•</span>
                <span className="text-gray-600 text-sm flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date().toLocaleDateString('id-ID', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-accent-blue to-accent-purple rounded-xl blur-xl opacity-50 group-hover:opacity-70 transition-all"></div>
              <div className="relative glass-card p-4">
                <Store className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Penjualan */}
          <div className="stat-card group animate-slide-up">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl transition-all group-hover:scale-110" style={{
                background: 'rgba(96, 165, 250, 0.15)',
                border: '1px solid rgba(96, 165, 250, 0.3)'
              }}>
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex items-center gap-1 text-green-600 text-sm font-semibold">
                <ArrowUpRight className="w-4 h-4" />
                <span>{stats?.sales.growth ?? 0}%</span>
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-semibold mb-1">Total Penjualan</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              Rp {stats?.sales.total ? (stats.sales.total / 1000000).toFixed(1) : '0'}M
            </p>
            <p className="text-gray-500 text-xs">
              {stats?.sales.growth ?? 0}% dari bulan lalu
            </p>
          </div>

          {/* Total Produk */}
          <div className="stat-card group animate-slide-up animation-delay-200">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl transition-all group-hover:scale-110" style={{
                background: 'rgba(167, 139, 250, 0.15)',
                border: '1px solid rgba(167, 139, 250, 0.3)'
              }}>
                <Package className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex items-center gap-1 text-green-600 text-sm font-semibold">
                <ArrowUpRight className="w-4 h-4" />
                <span>{stats?.products.growth ?? 0}%</span>
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-semibold mb-1">Total Produk</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {stats?.products.total.toLocaleString('id-ID') ?? '0'}
            </p>
            <p className="text-gray-500 text-xs">
              +{stats?.products.newThisMonth ?? 0} produk baru
            </p>
          </div>

          {/* Total Customer */}
          <div className="stat-card group animate-slide-up animation-delay-400">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl transition-all group-hover:scale-110" style={{
                background: 'rgba(244, 114, 182, 0.15)',
                border: '1px solid rgba(244, 114, 182, 0.3)'
              }}>
                <Users className="w-6 h-6 text-pink-600" />
              </div>
              <div className="flex items-center gap-1 text-green-600 text-sm font-semibold">
                <ArrowUpRight className="w-4 h-4" />
                <span>{stats?.customers.growth ?? 0}%</span>
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-semibold mb-1">Total Customer</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {stats?.customers.total.toLocaleString('id-ID') ?? '0'}
            </p>
            <p className="text-gray-500 text-xs">
              +{stats?.customers.newThisMonth ?? 0} customer baru
            </p>
          </div>

          {/* Utang Customer */}
          <div className="stat-card group animate-slide-up animation-delay-600">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl transition-all group-hover:scale-110" style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)'
              }}>
                <DollarSign className="w-6 h-6 text-red-600" />
              </div>
              <div className={`flex items-center gap-1 text-sm font-semibold ${(stats?.debt.change ?? 0) < 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                {(stats?.debt.change ?? 0) < 0 ? (
                  <ArrowDownRight className="w-4 h-4" />
                ) : (
                  <ArrowUpRight className="w-4 h-4" />
                )}
                <span>{Math.abs(stats?.debt.change ?? 0)}%</span>
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-semibold mb-1">Utang Customer</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              Rp {stats?.debt.total ? (stats.debt.total / 1000000).toFixed(1) : '0'}M
            </p>
            <p className="text-gray-500 text-xs">
              {stats?.debt.change ?? 0}% dari bulan lalu
            </p>
          </div>
        </div>

        {/* Charts & Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          {/* Chart */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Grafik Penjualan</h2>
                <p className="text-gray-600 text-sm">Performa penjualan 7 hari terakhir</p>
              </div>
              {/* Icon BarChart3 sudah dihapus sepenuhnya */}
            </div>

            {/* Chart Container */}
            <div className="relative h-80 bg-gradient-to-b from-blue-50/20 to-transparent rounded-xl p-6">
              {(!stats?.chart || stats.chart.length === 0) ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <p className="text-gray-500 text-sm">Belum ada data penjualan</p>
                  <p className="text-gray-400 text-xs mt-1">Data akan muncul setelah ada transaksi</p>
                </div>
              ) : (
                <>
                  {/* Y-Axis Labels */}
                  <div className="absolute left-0 top-0 bottom-12 flex flex-col justify-between py-6 pr-4">
                    {[100, 75, 50, 25, 0].map((percent) => {
                      const chartData = stats?.chart ?? [];
                      const maxValue = Math.max(...chartData.map(d => d.total), 1);
                      const value = (maxValue * percent) / 100;
                      return (
                        <div key={percent} className="text-xs text-gray-400 font-medium">
                          {value >= 1000000
                            ? `${(value / 1000000).toFixed(1)}M`
                            : value >= 1000
                              ? `${(value / 1000).toFixed(0)}K`
                              : value.toFixed(0)
                          }
                        </div>
                      );
                    })}
                  </div>

                  {/* Grid Lines */}
                  <div className="absolute left-12 right-0 top-0 bottom-12 py-6">
                    {[0, 25, 50, 75, 100].map((percent) => (
                      <div
                        key={percent}
                        className="absolute w-full border-t border-dashed"
                        style={{
                          top: `${percent}%`,
                          borderColor: 'rgba(156, 163, 175, 0.1)'
                        }}
                      />
                    ))}
                  </div>

                  {/* Chart Area */}
                  <div className="absolute left-12 right-0 top-0 bottom-12 py-6">
                    <svg
                      className="w-full h-full"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>

                        <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="rgba(59, 130, 246, 0.2)" />
                          <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
                        </linearGradient>
                      </defs>

                      {(() => {
                        const chartData = stats?.chart ?? [];
                        if (chartData.length < 2) return null;

                        const maxValue = Math.max(...chartData.map(d => d.total), 1);


                        const points = chartData.map((data, i) => ({
                          x: (i / (chartData.length - 1)) * 100,
                          y: 100 - (data.total / maxValue) * 100
                        }));

                 
                        let pathData = `M ${points[0].x} ${points[0].y}`;


                        for (let i = 0; i < points.length - 1; i++) {
                          const curr = points[i];
                          const next = points[i + 1];

                       
                          const cp1x = curr.x + (next.x - curr.x) / 2;
                          const cp2x = curr.x + (next.x - curr.x) / 2;

                          pathData += ` C ${cp1x} ${curr.y}, ${cp2x} ${next.y}, ${next.x} ${next.y}`;
                        }

              
                        const areaPath = `${pathData} L 100 100 L 0 100 Z`;

                        return (
                          <>
                            {/* Area di bawah garis */}
                            <path d={areaPath} fill="url(#areaGradient)" />

                            {/* Garis Utama - strokeWidth diperkecil jadi 2 */}
                            <path
                              d={pathData}
                              fill="none"
                              stroke="url(#lineGradient)"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />

                            {/* SEMUA <circle> ATAU ICON BUNDAR DI SINI SUDAH DIHAPUS */}
                          </>
                        );
                      })()}
                    </svg>

                    {/* Interactive hover areas */}
                    <div className="absolute inset-0 flex items-end justify-between">
                      {(stats?.chart ?? []).map((data, i) => (
                        <div
                          key={i}
                          className="flex-1 h-full relative group cursor-pointer"
                        >
                          {/* Garis vertikal saat hover */}
                          <div className="absolute inset-x-0 top-0 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-px h-full mx-auto bg-blue-200" />
                          </div>

                          {/* Tooltip minimalis */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-10">
                            <div className="bg-gray-900 text-white px-3 py-1.5 rounded text-xs shadow-xl whitespace-nowrap">
                              <p className="font-bold">Rp {data.total.toLocaleString('id-ID')}</p>
                              <p className="text-[10px] opacity-70">
                                {new Date(data.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* X-Axis Labels */}
                  <div className="absolute left-12 right-0 bottom-0 flex justify-between">
                    {(stats?.chart ?? []).map((data, i) => (
                      <div key={i} className="flex-1 text-center">
                        <p className="text-[10px] font-semibold text-gray-500">
                          {new Date(data.date).toLocaleDateString('id-ID', { weekday: 'short' })}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>



        {/* Quick Actions */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: ShoppingCart, label: 'Buat Transaksi', color: 'blue', gradient: 'from-blue-500 to-blue-600', href: '/dashboard/pos' },
              { icon: Package, label: 'Tambah Produk', color: 'purple', gradient: 'from-purple-500 to-purple-600', href: '/dashboard/products' },
              { icon: Users, label: 'Data Customer', color: 'pink', gradient: 'from-pink-500 to-pink-600', href: '/dashboard/customers' },
              { icon: BarChart3, label: 'Laporan', color: 'blue', gradient: 'from-blue-500 to-indigo-600', href: '/dashboard/sales' },
            ].map((action, i) => (
              <Link
                key={i}
                href={action.href}
                className="glass-card-hover p-5 text-center group relative overflow-hidden block"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                <div
                  className={`inline-flex p-3.5 rounded-xl mb-3 transition-all group-hover:scale-110`}
                  style={{
                    background: `rgba(${action.color === 'blue' ? '96, 165, 250' : action.color === 'purple' ? '167, 139, 250' : '244, 114, 182'}, 0.15)`,
                    border: `1px solid rgba(${action.color === 'blue' ? '96, 165, 250' : action.color === 'purple' ? '167, 139, 250' : '244, 114, 182'}, 0.3)`
                  }}
                >
                  <action.icon className={`w-6 h-6 ${action.color === 'blue' ? 'text-blue-600' :
                    action.color === 'purple' ? 'text-purple-600' :
                      'text-pink-600'
                    }`} />
                </div>
                <p className="text-gray-900 text-sm font-semibold">{action.label}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Stock Alert */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-bold text-gray-900">Peringatan Stock Rendah</h2>
            <span className="badge badge-danger ml-auto">
              {stats?.lowStock.length ?? 0} Item
            </span>
          </div>
          <div className="space-y-3">
            {(stats?.lowStock ?? []).map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-xl transition-all hover:bg-white/60"
                style={{
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.1)'
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}>
                    <Package className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-gray-900 text-sm font-semibold">{item.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      Min. stock: {item.minStock} {item.unit}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-red-600 text-lg font-bold">{item.stock}</p>
                  <p className="text-gray-500 text-xs">{item.unit}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}