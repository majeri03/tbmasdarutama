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

// Badge pertumbuhan yang jujur:
// - growth null = tidak terdefinisi (bulan lalu 0, bulan ini > 0) -> "—"
//   tanpa panah, bukan placeholder "+100%".
// - growth negatif -> panah bawah merah (sebelumnya selalu panah naik hijau
//   walau nilainya negatif).
// - growth undefined (data gagal dimuat) -> "0%" seperti perilaku lama.
function GrowthBadge({ growth }: { growth: number | null | undefined }) {
  if (growth === null) {
    return (
      <div className="flex items-center gap-1 text-stone-400 text-sm font-semibold">
        <span>—</span>
      </div>
    );
  }
  const value = growth ?? 0;
  if (value === 0) {
    return (
      <div className="flex items-center gap-1 text-stone-400 text-sm font-semibold">
        <span>0%</span>
      </div>
    );
  }
  const up = value > 0;
  return (
    <div className={`flex items-center gap-1 text-sm font-semibold ${up ? 'text-[#4ADE80]' : 'text-[#E5484D]'}`}>
      {up ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
      <span>{value}%</span>
    </div>
  );
}

// Subteks kartu: bila growth null, tulis nilai bulan lalu apa adanya
// ("bulan lalu Rp0") alih-alih "null% dari bulan lalu".
function growthSubtext(growth: number | null | undefined, zeroText: string): string {
  if (growth === null) return zeroText;
  return `${growth ?? 0}% dari bulan lalu`;
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }
  const statsResult = await getDashboardStats();
  const stats = statsResult.success ? statsResult.data : null;
  // Perubahan utang (dipakai kartu Utang Customer; null = bulan lalu Rp0).
  const debtChange = stats?.debt?.change;
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="glass-card p-6 animate-slide-up">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-stone-100 mb-2">
                Dashboard
              </h1>
              <p className="text-stone-400">
                Selamat datang kembali, <span className="text-stone-100 font-semibold">{session.user.name}</span>
              </p>
              <div className="flex items-center gap-2 mt-3">
                <div className="badge badge-info">
                  {session.user.role.replace('_', ' ')}
                </div>
                <span className="text-stone-400 text-sm">•</span>
                <span className="text-stone-400 text-sm flex items-center gap-1">
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
            <div className="glass-card p-4">
              <Store className="w-8 h-8 text-[#E5484D]" />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Penjualan */}
          <div className="stat-card group animate-slide-up">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-white/[0.08] border border-white/10 transition-all group-hover:scale-110">
                <TrendingUp className="w-6 h-6 text-stone-300" />
              </div>
              <GrowthBadge growth={stats?.sales?.growth} />
            </div>
            <h3 className="text-stone-400 text-sm font-semibold mb-1">Total Penjualan</h3>
            <p className="text-3xl font-bold tabular-nums text-stone-100 mb-1">
              Rp {stats?.sales?.total ? (stats.sales.total / 1000000).toFixed(1) : '0'}M
            </p>
            <p className="text-stone-500 text-xs">
              {growthSubtext(stats?.sales?.growth, 'bulan lalu Rp0')}
            </p>
          </div>

          {/* Total Produk */}
          <div className="stat-card group animate-slide-up animation-delay-200">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-white/[0.08] border border-white/10 transition-all group-hover:scale-110">
                <Package className="w-6 h-6 text-stone-300" />
              </div>
              <GrowthBadge growth={stats?.products?.growth} />
            </div>
            <h3 className="text-stone-400 text-sm font-semibold mb-1">Total Produk</h3>
            <p className="text-3xl font-bold tabular-nums text-stone-100 mb-1">
              {stats?.products?.total.toLocaleString('id-ID') ?? '0'}
            </p>
            <p className="text-stone-500 text-xs">
              +{stats?.products?.newThisMonth ?? 0} produk baru
            </p>
          </div>

          {/* Total Customer */}
          <div className="stat-card group animate-slide-up animation-delay-400">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-white/[0.08] border border-white/10 transition-all group-hover:scale-110">
                <Users className="w-6 h-6 text-stone-300" />
              </div>
              <GrowthBadge growth={stats?.customers?.growth} />
            </div>
            <h3 className="text-stone-400 text-sm font-semibold mb-1">Total Customer</h3>
            <p className="text-3xl font-bold tabular-nums text-stone-100 mb-1">
              {stats?.customers?.total.toLocaleString('id-ID') ?? '0'}
            </p>
            <p className="text-stone-500 text-xs">
              +{stats?.customers?.newThisMonth ?? 0} customer baru
            </p>
          </div>

          {/* Utang Customer */}
          <div className="stat-card group animate-slide-up animation-delay-600">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-white/[0.08] border border-white/10 transition-all group-hover:scale-110">
                <DollarSign className="w-6 h-6 text-[#E5484D]" />
              </div>
              <div className={`flex items-center gap-1 text-sm font-semibold ${debtChange === null || debtChange === undefined
                  ? 'text-stone-400'
                  : debtChange < 0 ? 'text-[#4ADE80]' : debtChange > 0 ? 'text-[#E5484D]' : 'text-stone-400'
                }`}>
                {debtChange === null ? (
                  <span>—</span>
                ) : (debtChange ?? 0) === 0 ? (
                  <span>0%</span>
                ) : (
                  <>
                    {(debtChange ?? 0) < 0 ? (
                      <ArrowDownRight className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                    <span>{Math.abs(debtChange ?? 0)}%</span>
                  </>
                )}
              </div>
            </div>
            <h3 className="text-stone-400 text-sm font-semibold mb-1">Utang Customer</h3>
            <p className="text-3xl font-bold tabular-nums text-stone-100 mb-1">
              Rp {stats?.debt?.total ? (stats.debt.total / 1000000).toFixed(1) : '0'}M
            </p>
            <p className="text-stone-500 text-xs">
              {growthSubtext(stats?.debt?.change, 'bulan lalu Rp0')}
            </p>
          </div>
        </div>

        {/* Charts & Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          {/* Chart */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-stone-100 mb-1">Grafik Penjualan</h2>
                <p className="text-stone-400 text-sm">Performa penjualan 7 hari terakhir</p>
              </div>
              {/* Icon BarChart3 sudah dihapus sepenuhnya */}
            </div>

            {/* Chart Container */}
            <div className="relative h-80 bg-white/[0.05] rounded-xl p-6">
              {(!stats?.chart || stats.chart.length === 0) ? (
                // Empty State - Safety check untuk error 'stats is possibly null'
                <div className="flex flex-col items-center justify-center h-full">
                  <p className="text-stone-400 text-sm">Belum ada data penjualan</p>
                  <p className="text-stone-400 text-xs mt-1">Data akan muncul setelah ada transaksi</p>
                </div>
              ) : (
                <>
                  {/* Y-Axis Labels */}
                  <div className="absolute left-0 top-0 bottom-12 flex flex-col justify-between py-6 pr-4">
                    {[100, 75, 50, 25, 0].map((percent) => {
                      // Fix error TS: pastikan stats?.chart tersedia sebelum dimap
                      const chartData = stats?.chart ?? [];
                      const maxValue = Math.max(...chartData.map(d => d.total), 1);
                      const value = (maxValue * percent) / 100;
                      return (
                        <div key={percent} className="text-xs text-stone-400 font-medium">
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
                          borderColor: 'rgba(255, 255, 255, 0.08)'
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
                          <stop offset="0%" stopColor="#7F1D1D" />
                          <stop offset="100%" stopColor="#7F1D1D" />
                        </linearGradient>

                        <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="rgba(127, 29, 29, 0.22)" />
                          <stop offset="100%" stopColor="rgba(127, 29, 29, 0)" />
                        </linearGradient>
                      </defs>

                      {(() => {
                        const chartData = stats?.chart ?? [];
                        if (chartData.length < 2) return null;

                        const maxValue = Math.max(...chartData.map(d => d.total), 1);

                        // Kalkulasi Titik
                        const points = chartData.map((data, i) => ({
                          x: (i / (chartData.length - 1)) * 100,
                          y: 100 - (data.total / maxValue) * 100
                        }));

                        // Garis LURUS antar titik (tanpa smoothing): kurva
                        // Bezier sebelumnya membulatkan sudut sehingga hari
                        // bernilai 0 tidak jatuh ke garis dasar dan tampak
                        // seperti masih ada penjualan. Segmen lurus membuat
                        // hari Rp0 terlihat jujur menyentuh baseline.
                        let pathData = `M ${points[0].x} ${points[0].y}`;

                        for (let i = 1; i < points.length; i++) {
                          pathData += ` L ${points[i].x} ${points[i].y}`;
                        }

                        // 3. Gabungkan untuk area pengisian (fill)
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

                    {/* Titik data per hari (HTML, bukan <circle> SVG: lingkaran
                        SVG terdistorsi jadi elips karena preserveAspectRatio="none").
                        Overlay ini sejajar persis dengan viewport SVG (py-6 = top-6/bottom-6).
                        Titik MERAH = hari tanpa penjualan (Rp0) agar langsung kelihatan. */}
                    <div className="absolute inset-x-0 top-6 bottom-6 pointer-events-none">
                      {(() => {
                        const chartData = stats?.chart ?? [];
                        if (chartData.length < 2) return null;
                        const maxValue = Math.max(...chartData.map(d => d.total), 1);
                        return chartData.map((data, i) => {
                          const x = (i / (chartData.length - 1)) * 100;
                          const y = (data.total / maxValue) * 100;
                          const isZero = data.total === 0;
                          return (
                            <div
                              key={i}
                              title={`Rp ${data.total.toLocaleString('id-ID')} — ${new Date(data.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`}
                              className={`absolute w-2.5 h-2.5 rounded-full border-2 border-white shadow ${isZero ? 'bg-[#991B1B]' : 'bg-[#7F1D1D]'}`}
                              style={{ left: `${x}%`, bottom: `${y}%`, transform: 'translate(-50%, 50%)' }}
                            />
                          );
                        });
                      })()}
                    </div>

                    {/* Interactive hover areas */}
                    <div className="absolute inset-0 flex items-end justify-between">
                      {(stats?.chart ?? []).map((data, i) => (
                        <div
                          key={i}
                          className="flex-1 h-full relative group cursor-pointer"
                        >
                          {/* Garis vertikal saat hover */}
                          <div className="absolute inset-x-0 top-0 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-px h-full mx-auto bg-white/25" />
                          </div>

                          {/* Tooltip minimalis */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-10">
                            <div className="bg-white text-stone-900 px-3 py-1.5 rounded text-xs shadow-xl whitespace-nowrap">
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

                  {/* X-Axis Labels: diposisikan tepat di bawah titik datanya.
                      Sebelumnya flex-1 + text-center menggeser label pertama/
                      terakhir ke dalam kolomnya sehingga tidak sejajar titik dan
                      tampak terpotong di tepi ("Min"/"Sen" saja). Label pertama
                      rata kiri, terakhir rata kanan, tengah rata tengah; dua
                      baris (hari + tanggal) supaya tidak ambigu. */}
                  <div className="absolute left-12 right-0 bottom-0 h-8">
                    {(stats?.chart ?? []).map((data, i) => {
                      const chartData = stats?.chart ?? [];
                      const x = chartData.length > 1 ? (i / (chartData.length - 1)) * 100 : 50;
                      const transform = i === 0
                        ? 'translateX(0)'
                        : i === chartData.length - 1
                          ? 'translateX(-100%)'
                          : 'translateX(-50%)';
                      return (
                        <div
                          key={i}
                          className="absolute top-0 text-center whitespace-nowrap"
                          style={{ left: `${x}%`, transform }}
                        >
                          <p className="text-[10px] font-semibold text-stone-400 leading-tight">
                            {new Date(data.date).toLocaleDateString('id-ID', { weekday: 'short' })}
                          </p>
                          <p className="text-[10px] text-stone-400 leading-tight">
                            {new Date(data.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </p>
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
            <Sparkles className="w-5 h-5 text-[#E5484D]" />
            <h2 className="text-lg font-bold text-stone-100">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: ShoppingCart, label: 'Buat Transaksi', href: '/dashboard/pos' },
              { icon: Package, label: 'Tambah Produk', href: '/dashboard/products' },
              { icon: Users, label: 'Data Customer', href: '/dashboard/customers' },
              { icon: BarChart3, label: 'Laporan', href: '/dashboard/reports' },
            ].map((action, i) => (
              <Link
                key={i}
                href={action.href}
                className="glass-card-hover p-5 text-center group relative overflow-hidden block"
              >
                <div className="inline-flex p-3.5 rounded-xl mb-3 bg-white/[0.08] border border-white/10 transition-all group-hover:scale-110">
                  <action.icon className={`w-6 h-6 ${i === 0 ? 'text-[#E5484D]' : 'text-stone-300'}`} />
                </div>
                <p className="text-stone-100 text-sm font-semibold">{action.label}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Stock Alert */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <AlertCircle className="w-5 h-5 text-[#E5484D]" />
            <h2 className="text-lg font-bold text-stone-100">Peringatan Stock Rendah</h2>
            <span className="badge badge-danger ml-auto">
              {stats?.lowStock.length ?? 0} Item
            </span>
          </div>
          <div className="space-y-3">
            {(stats?.lowStock ?? []).map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-[rgba(127,29,29,0.08)] transition-all hover:bg-white/[0.07]"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[rgba(127,29,29,0.08)] border border-[rgba(127,29,29,0.2)]">
                    <Package className="w-4 h-4 text-[#E5484D]" />
                  </div>
                  <div>
                    <p className="text-stone-100 text-sm font-semibold">{item.name}</p>
                    <p className="text-stone-500 text-xs mt-0.5">
                      Min. stock: {item.minStock} {item.unit}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[#E5484D] text-lg font-bold">{item.stock}</p>
                  <p className="text-stone-500 text-xs">{item.unit}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}