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
  Activity,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

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
              <p className="text-gray-400">
                Selamat datang kembali, <span className="text-white font-semibold">{session.user.name}</span>
              </p>
              <div className="flex items-center gap-2 mt-2">
                <div className="badge badge-info">
                  {session.user.role.replace('_', ' ')}
                </div>
                <span className="text-gray-500 text-sm">•</span>
                <span className="text-gray-400 text-sm flex items-center gap-1">
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
              <div className="absolute inset-0 bg-gradient-to-br from-accent-blue to-accent-purple rounded-xl blur-lg group-hover:blur-xl transition-all opacity-50"></div>
              <div className="relative glass-card p-4">
                <Store className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Penjualan */}
          <div className="stat-card group animate-slide-up">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl" style={{
                background: 'rgba(96, 165, 250, 0.1)',
                border: '1px solid rgba(96, 165, 250, 0.2)'
              }}>
                <TrendingUp className="w-6 h-6 text-accent-blue" />
              </div>
              <div className="flex items-center gap-1 text-green-400 text-sm">
                <ArrowUpRight className="w-4 h-4" />
                <span className="font-semibold">12.5%</span>
              </div>
            </div>
            <h3 className="text-gray-400 text-sm font-semibold mb-1">Total Penjualan</h3>
            <p className="text-3xl font-bold text-white mb-1">Rp 45.2M</p>
            <p className="text-gray-500 text-xs">+Rp 5.2M dari bulan lalu</p>
          </div>

          {/* Total Produk */}
          <div className="stat-card group animate-slide-up animation-delay-200">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl" style={{
                background: 'rgba(167, 139, 250, 0.1)',
                border: '1px solid rgba(167, 139, 250, 0.2)'
              }}>
                <Package className="w-6 h-6 text-accent-purple" />
              </div>
              <div className="flex items-center gap-1 text-green-400 text-sm">
                <ArrowUpRight className="w-4 h-4" />
                <span className="font-semibold">8.2%</span>
              </div>
            </div>
            <h3 className="text-gray-400 text-sm font-semibold mb-1">Total Produk</h3>
            <p className="text-3xl font-bold text-white mb-1">1,248</p>
            <p className="text-gray-500 text-xs">+94 produk baru</p>
          </div>

          {/* Total Customer */}
          <div className="stat-card group animate-slide-up animation-delay-400">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl" style={{
                background: 'rgba(244, 114, 182, 0.1)',
                border: '1px solid rgba(244, 114, 182, 0.2)'
              }}>
                <Users className="w-6 h-6 text-accent-pink" />
              </div>
              <div className="flex items-center gap-1 text-green-400 text-sm">
                <ArrowUpRight className="w-4 h-4" />
                <span className="font-semibold">15.3%</span>
              </div>
            </div>
            <h3 className="text-gray-400 text-sm font-semibold mb-1">Total Customer</h3>
            <p className="text-3xl font-bold text-white mb-1">324</p>
            <p className="text-gray-500 text-xs">+43 customer baru</p>
          </div>

          {/* Utang Customer */}
          <div className="stat-card group animate-slide-up animation-delay-600">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl" style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}>
                <DollarSign className="w-6 h-6 text-red-400" />
              </div>
              <div className="flex items-center gap-1 text-red-400 text-sm">
                <ArrowDownRight className="w-4 h-4" />
                <span className="font-semibold">3.8%</span>
              </div>
            </div>
            <h3 className="text-gray-400 text-sm font-semibold mb-1">Utang Customer</h3>
            <p className="text-3xl font-bold text-white mb-1">Rp 8.5M</p>
            <p className="text-gray-500 text-xs">-Rp 320K dari bulan lalu</p>
          </div>
        </div>

        {/* Charts & Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <div className="lg:col-span-2 glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Grafik Penjualan</h2>
                <p className="text-gray-400 text-sm">Performa penjualan 7 hari terakhir</p>
              </div>
              <BarChart3 className="w-6 h-6 text-accent-blue" />
            </div>
            <div className="h-64 flex items-end justify-between gap-4">
              {[65, 45, 78, 52, 90, 67, 82].map((height, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div 
                    className="w-full rounded-t-lg transition-all duration-500 hover:opacity-80 relative group"
                    style={{
                      height: `${height}%`,
                      background: `linear-gradient(180deg, rgba(96, 165, 250, 0.8) 0%, rgba(96, 165, 250, 0.3) 100%)`
                    }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="glass-card px-2 py-1 text-xs text-white whitespace-nowrap">
                        Rp {(height * 100000).toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>
                  <span className="text-gray-400 text-xs">
                    {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activities */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="w-5 h-5 text-accent-blue" />
              <h2 className="text-lg font-bold text-white">Aktivitas Terbaru</h2>
            </div>
            <div className="space-y-4">
              {[
                { icon: ShoppingCart, text: 'Transaksi baru #TRX-1234', time: '5 menit lalu', color: 'accent-blue' },
                { icon: Package, text: 'Produk baru ditambahkan', time: '15 menit lalu', color: 'accent-purple' },
                { icon: Users, text: 'Customer baru terdaftar', time: '1 jam lalu', color: 'accent-pink' },
                { icon: AlertCircle, text: 'Stock rendah: Semen 50kg', time: '2 jam lalu', color: 'red-400' },
              ].map((activity, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl transition-all hover:bg-white/5">
                  <div className={`p-2 rounded-lg`} style={{
                    background: `rgba(96, 165, 250, 0.1)`,
                    border: `1px solid rgba(96, 165, 250, 0.2)`
                  }}>
                    <activity.icon className={`w-4 h-4 text-${activity.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{activity.text}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: ShoppingCart, label: 'Buat Transaksi', color: 'accent-blue' },
              { icon: Package, label: 'Tambah Produk', color: 'accent-purple' },
              { icon: Users, label: 'Data Customer', color: 'accent-pink' },
              { icon: BarChart3, label: 'Laporan', color: 'accent-blue' },
            ].map((action, i) => (
              <button
                key={i}
                className="glass-card-hover p-4 text-center group"
              >
                <div className={`inline-flex p-3 rounded-xl mb-3`} style={{
                  background: `rgba(96, 165, 250, 0.1)`,
                  border: `1px solid rgba(96, 165, 250, 0.2)`
                }}>
                  <action.icon className={`w-6 h-6 text-${action.color}`} />
                </div>
                <p className="text-white text-sm font-medium">{action.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}