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
  },
  {
    title: "Laporan Pembelian",
    description: "Laporan pembelian dari supplier",
    icon: ClipboardList,
    href: "/dashboard/reports/purchases",
  },
  {
    title: "Laporan Inventory",
    description: "Laporan stok barang dan nilai inventory",
    icon: Package,
    href: "/dashboard/reports/inventory",
  },
  {
    title: "Laporan Keuangan",
    description: "Laporan laba rugi dan analisis keuangan",
    icon: DollarSign,
    href: "/dashboard/reports/financial",
  },
  {
    title: "Laporan Piutang & Hutang",
    description: "Laporan piutang customer dan hutang supplier",
    icon: Users,
    href: "/dashboard/reports/debts",
  },
  {
    title: "Daftar Produk",
    description: "Katalog lengkap produk dengan harga",
    icon: FileText,
    href: "/dashboard/reports/products",
  },
];

import PageGuard from "@/components/PageGuard";

export default function ReportsPage() {
  return (
    <PageGuard pageKey="reports_settings">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1C1917] flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-[#1C1917]" />
            Laporan
          </h1>
          <p className="text-[#57534E] mt-2">
            Pilih laporan yang ingin dilihat atau dicetak.
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
              className="group glass-card p-6 transition-all hover:shadow-md"
            >
              {/* Icon */}
              <div className="w-14 h-14 rounded-xl border border-[rgba(28,25,23,0.08)] bg-stone-100 flex items-center justify-center mb-4">
                <Icon className="w-7 h-7 text-[#1C1917]" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-bold text-[#1C1917] mb-2">
                {menu.title}
              </h3>
              <p className="text-[#57534E] text-sm leading-relaxed">
                {menu.description}
              </p>

              {/* Arrow */}
              <div className="mt-4 flex items-center gap-1 text-[#1C1917] font-semibold text-sm group-hover:text-[#7F1D1D] transition-colors">
                <span>Lihat Laporan</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg border border-[rgba(28,25,23,0.08)] bg-stone-100 p-3">
            <FileText className="w-6 h-6 text-[#1C1917]" />
          </div>
          <div>
            <h3 className="font-bold text-[#1C1917] mb-2">Tips Penggunaan Laporan</h3>
            <ul className="text-sm text-[#57534E] space-y-1">
              <li>• Pilih periode tanggal untuk laporan yang lebih spesifik</li>
              <li>• Gunakan tombol <strong>Print</strong> untuk mencetak laporan</li>
              <li>• Gunakan tombol <strong>Download PDF</strong> untuk menyimpan laporan</li>
              <li>• Laporan dapat difilter berdasarkan kategori, customer, atau supplier</li>
            </ul>
          </div>
        </div>
      </div>
      </div>
    </PageGuard>
  );
}
