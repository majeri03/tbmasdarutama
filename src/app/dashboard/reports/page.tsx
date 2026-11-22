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
          <h1 className="text-3xl font-bold text-[#111111] flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-[#111111]" />
            Laporan
          </h1>
          <p className="text-[#6B7280] mt-2">
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
              className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-[#111111] hover:shadow-md"
            >
              {/* Icon */}
              <div className="w-14 h-14 rounded-xl border border-[#111111] bg-white flex items-center justify-center mb-4">
                <Icon className="w-7 h-7 text-[#111111]" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-bold text-[#111111] mb-2">
                {menu.title}
              </h3>
              <p className="text-[#6B7280] text-sm leading-relaxed">
                {menu.description}
              </p>

              {/* Arrow */}
              <div className="mt-4 flex items-center gap-1 text-[#111111] font-semibold text-sm group-hover:text-red-900 transition-colors">
                <span>Lihat Laporan</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg border border-[#111111] bg-white p-3">
            <FileText className="w-6 h-6 text-[#111111]" />
          </div>
          <div>
            <h3 className="font-bold text-[#111111] mb-2">Tips Penggunaan Laporan</h3>
            <ul className="text-sm text-[#6B7280] space-y-1">
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
