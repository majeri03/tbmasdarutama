"use client";

import Link from "next/link";
import { 
  FileText, 
  Package, 
  ShoppingCart, 
  DollarSign, 
  Users, 
  TrendingUp,
  ClipboardList
} from "lucide-react";

const reportMenus = [
  {
    title: "Laporan Penjualan",
    description: "Laporan transaksi penjualan berdasarkan periode",
    icon: ShoppingCart,
    href: "/dashboard/reports/sales",
    color: "bg-blue-500",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600"
  },
  {
    title: "Laporan Pembelian",
    description: "Laporan pembelian dari supplier",
    icon: ClipboardList,
    href: "/dashboard/reports/purchases",
    color: "bg-purple-500",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600"
  },
  {
    title: "Laporan Inventory",
    description: "Laporan stok barang dan nilai inventory",
    icon: Package,
    href: "/dashboard/reports/inventory",
    color: "bg-green-500",
    iconBg: "bg-green-100",
    iconColor: "text-green-600"
  },
  {
    title: "Laporan Keuangan",
    description: "Laporan laba rugi dan analisis keuangan",
    icon: DollarSign,
    href: "/dashboard/reports/financial",
    color: "bg-yellow-500",
    iconBg: "bg-yellow-100",
    iconColor: "text-yellow-600"
  },
  {
    title: "Laporan Piutang & Hutang",
    description: "Laporan piutang customer dan hutang supplier",
    icon: Users,
    href: "/dashboard/reports/debts",
    color: "bg-red-500",
    iconBg: "bg-red-100",
    iconColor: "text-red-600"
  },
  {
    title: "Daftar Produk",
    description: "Katalog lengkap produk dengan harga",
    icon: FileText,
    href: "/dashboard/reports/products",
    color: "bg-indigo-500",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600"
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            Laporan
          </h1>
          <p className="text-gray-600 mt-2">
            Kelola dan cetak berbagai laporan bisnis Anda
          </p>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportMenus.map((menu) => {
          const Icon = menu.icon;
          
          return (
            <Link
              key={menu.href}
              href={menu.href}
              className="group glass-card p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              {/* Icon */}
              <div className={`${menu.iconBg} w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className={`w-7 h-7 ${menu.iconColor}`} />
              </div>

              {/* Content */}
              <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                {menu.title}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {menu.description}
              </p>

              {/* Arrow */}
              <div className="mt-4 flex items-center text-blue-600 font-semibold text-sm group-hover:gap-2 transition-all">
                <span>Lihat Laporan</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="glass-card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500">
        <div className="flex items-start gap-4">
          <div className="bg-blue-100 p-3 rounded-lg">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 mb-2">Tips Penggunaan Laporan</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Pilih periode tanggal untuk laporan yang lebih spesifik</li>
              <li>• Gunakan tombol <strong>Print</strong> untuk mencetak laporan</li>
              <li>• Gunakan tombol <strong>Download PDF</strong> untuk menyimpan laporan</li>
              <li>• Laporan dapat difilter berdasarkan kategori, customer, atau supplier</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}