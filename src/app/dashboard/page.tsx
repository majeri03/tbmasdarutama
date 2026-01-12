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
              <div className="p-2.5 rounded-lg" style={{
                background: 'rgba(96, 165, 250, 0.1)',
                border: '1px solid rgba(96, 165, 250, 0.2)'
              }}>
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
            </div>

            {/* Chart Container */}
            <div className="relative h-80">
              {(stats?.chart ?? []).length === 0 ? (
                // Empty State
                <div className="flex flex-col items-center justify-center h-full">
                  <BarChart3 className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="text-gray-500 text-sm">Belum ada data penjualan</p>
                  <p className="text-gray-400 text-xs mt-1">Data akan muncul setelah ada transaksi</p>
                </div>
              ) : (
                <>
                  {/* Trend Line SVG */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                    <defs>
                      <linearGradient id="trendGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(96, 165, 250, 0.8)" />
                        <stop offset="100%" stopColor="rgba(167, 139, 250, 0.8)" />
                      </linearGradient>
                      <filter id="glow">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                          <feMergeNode in="coloredBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    {stats?.chart && stats.chart.length > 1 && (() => {
                      const chartData = stats.chart;
                      const maxValue = Math.max(...chartData.map(d => d.total), 1);
                      const padding = 40;
                      const width = 100;
                      const height = 320 - padding * 2;

                      const points = chartData.map((data, i) => {
                        const x = (i / (chartData.length - 1)) * (width - 10) + 5;
                        const y = padding + height - (data.total / maxValue) * height;
                        return `${x}%,${y}`;
                      }).join(' ');

                      return (
                        <>
                          {/* Gradient Fill */}
                          <path
                            d={`M ${chartData.map((data, i) => {
                              const x = (i / (chartData.length - 1)) * (width - 10) + 5;
                              const y = padding + height - (data.total / maxValue) * height;
                              return `${x}% ${y}`;
                            }).join(' L ')} L ${width - 5}% ${padding + height} L 5% ${padding + height} Z`}
                            fill="url(#trendGradient)"
                            opacity="0.1"
                          />

                          {/* Trend Line */}
                          <polyline
                            points={points}
                            fill="none"
                            stroke="url(#trendGradient)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            filter="url(#glow)"
                          />

                          {/* Data Points */}
                          {chartData.map((data, i) => {
                            const x = (i / (chartData.length - 1)) * (width - 10) + 5;
                            const y = padding + height - (data.total / maxValue) * height;
                            return (
                              <g key={i}>
                                <circle
                                  cx={`${x}%`}
                                  cy={y}
                                  r="6"
                                  fill="white"
                                  stroke="url(#trendGradient)"
                                  strokeWidth="3"
                                  filter="url(#glow)"
                                />
                                <circle
                                  cx={`${x}%`}
                                  cy={y}
                                  r="3"
                                  fill="url(#trendGradient)"
                                />
                              </g>
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>

                  {/* Bar Chart */}
                  <div className="relative h-full flex items-end justify-around gap-2 px-4" style={{ zIndex: 0 }}>
                    {(stats?.chart ?? []).map((data, i) => {
                      const maxValue = Math.max(...(stats?.chart ?? []).map(d => d.total), 1);
                      const height = (data.total / maxValue) * 100;
                      const minHeight = data.total > 0 ? Math.max(height, 5) : 0;

                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-3 max-w-[120px]">
                          <div
                            className="w-full rounded-t-xl transition-all duration-500 hover:opacity-80 relative group cursor-pointer"
                            style={{
                              minHeight: data.total > 0 ? '20px' : '0',
                              height: `${minHeight}%`,
                              background: data.total > 0
                                ? `linear-gradient(180deg, rgba(96, 165, 250, 0.3) 0%, rgba(96, 165, 250, 0.1) 100%)`
                                : 'rgba(229, 231, 235, 0.3)',
                              border: data.total > 0
                                ? '2px solid rgba(96, 165, 250, 0.3)'
                                : '2px solid rgba(209, 213, 219, 0.3)',
                              boxShadow: data.total > 0
                                ? '0 -4px 12px rgba(96, 165, 250, 0.15)'
                                : 'none'
                            }}
                          >
                            {/* Tooltip */}
                            <div className="absolute -top-16 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              <div className="glass-card px-4 py-2 text-center whitespace-nowrap">
                                <p className="text-xs text-gray-600 mb-0.5">
                                  {new Date(data.date).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'short'
                                  })}
                                </p>
                                <p className="text-sm text-gray-900 font-bold">
                                  Rp {(data.total / 1000000).toFixed(1)}M
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Day Label */}
                          <span className="text-gray-600 text-sm font-medium">
                            {new Date(data.date).toLocaleDateString('id-ID', { weekday: 'short' })}
                          </span>
                        </div>
                      );
                    })}
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