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
  ArrowDownRight,
  Sparkles
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
                <span>12.5%</span>
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-semibold mb-1">Total Penjualan</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">Rp 45.2M</p>
            <p className="text-gray-500 text-xs">+Rp 5.2M dari bulan lalu</p>
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
                <span>8.2%</span>
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-semibold mb-1">Total Produk</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">1,248</p>
            <p className="text-gray-500 text-xs">+94 produk baru</p>
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
                <span>15.3%</span>
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-semibold mb-1">Total Customer</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">324</p>
            <p className="text-gray-500 text-xs">+43 customer baru</p>
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
              <div className="flex items-center gap-1 text-red-600 text-sm font-semibold">
                <ArrowDownRight className="w-4 h-4" />
                <span>3.8%</span>
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-semibold mb-1">Utang Customer</h3>
            <p className="text-3xl font-bold text-gray-900 mb-1">Rp 8.5M</p>
            <p className="text-gray-500 text-xs">-Rp 320K dari bulan lalu</p>
          </div>
        </div>

        {/* Charts & Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <div className="lg:col-span-2 glass-card p-6">
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
            <div className="h-64 flex items-end justify-between gap-4">
              {[
                { height: 65, value: 6.5 },
                { height: 45, value: 4.5 },
                { height: 78, value: 7.8 },
                { height: 52, value: 5.2 },
                { height: 90, value: 9.0 },
                { height: 67, value: 6.7 },
                { height: 82, value: 8.2 }
              ].map((data, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div 
                    className="w-full rounded-t-xl transition-all duration-500 hover:opacity-80 relative group cursor-pointer"
                    style={{
                      height: `${data.height}%`,
                      background: `linear-gradient(180deg, rgba(96, 165, 250, 0.9) 0%, rgba(96, 165, 250, 0.5) 100%)`,
                      boxShadow: '0 -4px 12px rgba(96, 165, 250, 0.2)'
                    }}
                  >
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="glass-card px-3 py-1.5 text-xs text-gray-900 font-semibold whitespace-nowrap">
                        Rp {data.value}M
                      </div>
                    </div>
                  </div>
                  <span className="text-gray-600 text-xs font-medium">
                    {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activities */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg" style={{
                background: 'rgba(96, 165, 250, 0.1)',
                border: '1px solid rgba(96, 165, 250, 0.2)'
              }}>
                <Activity className="w-4 h-4 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Aktivitas Terbaru</h2>
            </div>
            <div className="space-y-3">
              {[
                { icon: ShoppingCart, text: 'Transaksi baru #TRX-1234', time: '5 menit lalu', color: 'blue' },
                { icon: Package, text: 'Produk baru ditambahkan', time: '15 menit lalu', color: 'purple' },
                { icon: Users, text: 'Customer baru terdaftar', time: '1 jam lalu', color: 'pink' },
                { icon: AlertCircle, text: 'Stock rendah: Semen 50kg', time: '2 jam lalu', color: 'red' },
              ].map((activity, i) => (
                <div 
                  key={i} 
                  className="flex items-start gap-3 p-3 rounded-xl transition-all hover:bg-white/60 cursor-pointer group"
                >
                  <div 
                    className={`p-2 rounded-lg transition-all group-hover:scale-110`} 
                    style={{
                      background: `rgba(${activity.color === 'blue' ? '96, 165, 250' : activity.color === 'purple' ? '167, 139, 250' : activity.color === 'pink' ? '244, 114, 182' : '239, 68, 68'}, 0.15)`,
                      border: `1px solid rgba(${activity.color === 'blue' ? '96, 165, 250' : activity.color === 'purple' ? '167, 139, 250' : activity.color === 'pink' ? '244, 114, 182' : '239, 68, 68'}, 0.3)`
                    }}
                  >
                    <activity.icon className={`w-4 h-4 ${
                      activity.color === 'blue' ? 'text-blue-600' :
                      activity.color === 'purple' ? 'text-purple-600' :
                      activity.color === 'pink' ? 'text-pink-600' :
                      'text-red-600'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 text-sm font-medium">{activity.text}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{activity.time}</p>
                  </div>
                </div>
              ))}
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
              { icon: ShoppingCart, label: 'Buat Transaksi', color: 'blue', gradient: 'from-blue-500 to-blue-600' },
              { icon: Package, label: 'Tambah Produk', color: 'purple', gradient: 'from-purple-500 to-purple-600' },
              { icon: Users, label: 'Data Customer', color: 'pink', gradient: 'from-pink-500 to-pink-600' },
              { icon: BarChart3, label: 'Laporan', color: 'blue', gradient: 'from-blue-500 to-indigo-600' },
            ].map((action, i) => (
              <button
                key={i}
                className="glass-card-hover p-5 text-center group relative overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                <div 
                  className={`inline-flex p-3.5 rounded-xl mb-3 transition-all group-hover:scale-110`} 
                  style={{
                    background: `rgba(${action.color === 'blue' ? '96, 165, 250' : action.color === 'purple' ? '167, 139, 250' : '244, 114, 182'}, 0.15)`,
                    border: `1px solid rgba(${action.color === 'blue' ? '96, 165, 250' : action.color === 'purple' ? '167, 139, 250' : '244, 114, 182'}, 0.3)`
                  }}
                >
                  <action.icon className={`w-6 h-6 ${
                    action.color === 'blue' ? 'text-blue-600' :
                    action.color === 'purple' ? 'text-purple-600' :
                    'text-pink-600'
                  }`} />
                </div>
                <p className="text-gray-900 text-sm font-semibold">{action.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Stock Alert */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-bold text-gray-900">Peringatan Stock Rendah</h2>
            <span className="badge badge-danger ml-auto">5 Item</span>
          </div>
          <div className="space-y-3">
            {[
              { name: 'Semen Gresik 50kg', stock: 12, min: 50, unit: 'Sak' },
              { name: 'Cat Tembok Putih 5L', stock: 8, min: 20, unit: 'Pcs' },
              { name: 'Pipa PVC 3 inch', stock: 15, min: 30, unit: 'Batang' },
            ].map((item, i) => (
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
                    <p className="text-gray-500 text-xs mt-0.5">Min. stock: {item.min} {item.unit}</p>
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