"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Package,
  Layers,
  Truck,
  Users,
  Box,
  Settings,
  LogOut,
  ShoppingCart,
  CreditCard,
  X,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Send,
  DollarSign,
  BarChart3,
} from "lucide-react";
import { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/utils/role";
const menuGroups = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", icon: <Home />, label: "Dashboard", permission: "VIEW_DASHBOARD" as const },
    ],
  },
  {
    label: "Manajemen Data",
    items: [
      { href: "/dashboard/products", icon: <Package />, label: "Produk", permission: "VIEW_PRODUCTS" as const },
      { href: "/dashboard/categories", icon: <Box />, label: "Kategori", permission: "VIEW_CATEGORIES" as const },
      { href: "/dashboard/units", icon: <Layers />, label: "Satuan", permission: "VIEW_UNITS" as const },
      { href: "/dashboard/suppliers", icon: <Truck />, label: "Supplier", permission: "VIEW_SUPPLIERS" as const },
      { href: "/dashboard/customers", icon: <Users />, label: "Customer", permission: "VIEW_CUSTOMERS" as const },
      { href: "/dashboard/stocks", icon: <ShoppingCart />, label: "Stock", permission: "VIEW_STOCK" as const },
    ],
  },
  {
    label: "Transaksi",
    items: [
      { href: "/dashboard/delivery-orders", icon: <Send />, label: "Pengiriman", permission: "VIEW_DELIVERY_ORDERS" as const, },
      { href: "/dashboard/purchases", icon: <ShoppingBag />, label: "Purchase Orders", permission: "VIEW_PURCHASES" as const },
      { href: "/dashboard/sales", icon: <DollarSign />, label: "Penjualan", permission: "VIEW_SALES" as const },
      { href: "/dashboard/pos", icon: <CreditCard />, label: "Point of Sale", permission: "ACCESS_POS" as const },
    ],
  },
  {
    label: "Utang & Piutang",
    items: [
      { href: "/dashboard/supplier-debts", icon: <TrendingDown />, label: "Utang Supplier", permission: "VIEW_SUPPLIER_DEBTS" as const},
      { href: "/dashboard/customer-debts", icon: <TrendingUp />, label: "Piutang Customer", permission: "VIEW_CUSTOMER_DEBTS" as const },
    ],
  },
  {
    label: "Lainnya",
    items: [
      { href: "/dashboard/reports", icon: <BarChart3 />, label: "Laporan", permission: "VIEW_REPORTS" as const },
      { href: "/dashboard/settings", icon: <Settings />, label: "Pengaturan",  permission: "VIEW_SETTINGS" as const },
    ],
  },
];

import { useState } from "react";

export default function Sidebar({
  open,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: session } = useSession();

  const filteredMenuGroups = menuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // If no permission specified, show to all
      if (!item.permission) return true;
      // Check if user has permission
      return hasPermission(session, item.permission);
    })
  })).filter(group => group.items.length > 0);

  // Sidebar content
  const sidebarContent = (
    <div className="flex flex-col h-full relative">
      {/* Abstrak background */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 70% 10%,rgba(59,130,246,0.13),transparent 80%),radial-gradient(ellipse 60% 40% at 0% 100%,rgba(16,185,129,0.10),transparent 80%)",
        }}
      />
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 md:px-6 py-4 md:py-6 relative z-10 flex-shrink-0">
        <span className="inline-block w-8 h-8 bg-blue-600 rounded-lg shadow-lg" />
        <span className="font-bold text-xl text-gray-900 tracking-wide">Masdar Utama</span>
      </div>
      {/* Menu Groups */}
      <nav className="flex-1 overflow-y-auto px-2 pb-6 relative z-10 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {filteredMenuGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <div className="px-3 py-1 text-xs font-bold text-gray-500 uppercase tracking-wider select-none">
              {group.label}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link ${pathname === item.href ? "active" : ""
                    }`}
                  onClick={() => {
                    setDrawerOpen(false);
                    onClose?.();
                  }}
                >
                  <span className="w-5 h-5">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
      {/* Logout Button */}
      <div className="px-4 pb-4 relative z-10">
        <button
          onClick={async () => {
            const { logout } = await import("@/lib/actions/auth.actions");
            await logout();
          }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-red-600 hover:bg-red-50 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
      {/* Footer */}
      <div className="px-6 py-4 text-xs text-gray-400 relative z-10">
        &copy; {new Date().getFullYear()} TB Masdar Utama
      </div>
    </div>
  );

  // Desktop sidebar
  return (
    <>
      {/* Desktop */}
      <aside className="fixed z-30 top-0 left-0 h-screen w-64 glass-card shadow-2xl border-r border-white/30 hidden md:flex flex-col backdrop-blur-xl overflow-y-auto">
        {sidebarContent}
      </aside>
      {/* Mobile Drawer */}
      <Transition show={open ?? drawerOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 md:hidden" onClose={() => { setDrawerOpen(false); onClose?.(); }}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition-transform ease-in-out duration-300"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition-transform ease-in-out duration-300"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative w-64 h-full glass-card shadow-2xl border-r border-white/30 flex flex-col backdrop-blur-xl">
                {/* Close button */}
                <button
                  className="absolute top-4 right-4 glass-card p-2 rounded-full shadow border border-white/30 z-20"
                  onClick={() => { setDrawerOpen(false); onClose?.(); }}
                  aria-label="Tutup menu"
                >
                  <X className="w-6 h-6 text-blue-600" />
                </button>
                {sidebarContent}
              </Dialog.Panel>
            </Transition.Child>
            {/* Click outside to close */}
            <div className="flex-1" onClick={() => { setDrawerOpen(false); onClose?.(); }} />
          </div>
        </Dialog>
      </Transition>
    </>
  );
}