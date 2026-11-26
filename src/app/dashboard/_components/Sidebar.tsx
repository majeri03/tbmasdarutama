"use client";

import Link from "next/link";
import Image from "next/image";
import { getStoreSetting } from "@/lib/actions/store-setting.actions";
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
  Shield,
  MapPin,
  ClipboardCheck,
  HardDrive,
  Star,
  Wallet,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/utils/role";
import { NotificationBellIcon } from "@/app/dashboard/notifications/_components/NotificationBell";
const menuGroups = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", icon: <Home />, label: "Dashboard", permission: "VIEW_MENU_DASHBOARD" as const },
      // Tanpa permission — semua role yang login bisa melihat notifikasi
      // miliknya (API sudah memfilter per user/role).
      { href: "/dashboard/notifications", icon: <NotificationBellIcon />, label: "Notifikasi" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/dashboard/products", icon: <Package />, label: "Produk", permission: "VIEW_MENU_PRODUCTS" as const },
      { href: "/dashboard/categories", icon: <Box />, label: "Kategori", permission: "VIEW_CATEGORIES" as const },
      { href: "/dashboard/units", icon: <Layers />, label: "Satuan", permission: "VIEW_UNITS" as const },
      { href: "/dashboard/suppliers", icon: <Truck />, label: "Supplier", permission: "VIEW_SUPPLIERS" as const },
      { href: "/dashboard/customers", icon: <Users />, label: "Customer", permission: "VIEW_CUSTOMERS" as const },
      { href: "/dashboard/stocks", icon: <ShoppingCart />, label: "Stock", permission: "VIEW_MENU_STOCK" as const, pageKey: "stock_opname" },
      { href: "/dashboard/stocks/opname", icon: <ClipboardCheck />, label: "Stock Opname", permission: "VIEW_MENU_STOCK" as const, pageKey: "stock_opname" },
    ],
  },
  {
    label: "Transactions",
    items: [
      { href: "/dashboard/delivery-orders", icon: <Send />, label: "Pengiriman", permission: "VIEW_DELIVERY_ORDERS" as const, },
      { href: "/dashboard/fleet", icon: <MapPin />, label: "Armada & GPS", permission: "VIEW_DELIVERY_ORDERS" as const, },
      { href: "/dashboard/purchases", icon: <ShoppingBag />, label: "Purchase Orders", permission: "VIEW_PURCHASES" as const, pageKey: "po" },
      { href: "/dashboard/sales", icon: <DollarSign />, label: "Penjualan", permission: "VIEW_MENU_SALES" as const },
      { href: "/dashboard/salesmen", icon: <Users />, label: "Salesman", permission: "VIEW_SALESMEN" as const },
      { href: "/dashboard/points", icon: <Star />, label: "Poin Loyalitas", permission: "VIEW_POINTS" as const },
      { href: "/dashboard/pos", icon: <CreditCard />, label: "Point of Sale", permission: "ACCESS_POS" as const, pageKey: "pos" },
      // FIX (25 Nov 2026, batch 8 item 233): menu Kas — sebelumnya API
      // /api/cash-movements sudah ada tapi tidak ada halaman/menu/tombol
      // yang memakainya. Permission VIEW_REPORTS (SUPER_ADMIN + ADMIN)
      // dipakai karena belum ada permission khusus kas dan gate API-nya
      // memang ADMIN+; halaman /dashboard/cash mengecek role yang sama.
      { href: "/dashboard/cash", icon: <Wallet />, label: "Kas", permission: "VIEW_REPORTS" as const },
    ],
  },
  {
    label: "Debts & Receivables",
    items: [
      { href: "/dashboard/supplier-debts", icon: <TrendingDown />, label: "Utang Supplier", permission: "VIEW_SUPPLIER_DEBTS" as const },
      { href: "/dashboard/customer-debts", icon: <TrendingUp />, label: "Piutang Customer", permission: "VIEW_MENU_CUSTOMERS_DEBTS" as const },
    ],
  },
  {
    label: "Others",
    items: [
      { href: "/dashboard/reports", icon: <BarChart3 />, label: "Laporan", permission: "VIEW_REPORTS" as const, pageKey: "reports_settings" },
      { href: "/dashboard/users", icon: <Shield />, label: "Manajemen Akun", permission: "MANAGE_USERS" as const },
      { href: "/dashboard/page-access", icon: <Shield />, label: "Akses Halaman", role: "SUPER_ADMIN" as const },
      { href: "/dashboard/settings", icon: <Settings />, label: "Pengaturan", permission: "VIEW_MENU_SETTINGS" as const, pageKey: "reports_settings" },
      { href: "/dashboard/storage", icon: <HardDrive />, label: "Penyimpanan", permission: "VIEW_MENU_SETTINGS" as const },
    ],
  },
];


export default function Sidebar({
  open,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: session, status } = useSession();
  const [storeLogo, setStoreLogo] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("TB Masdar Utama");
  // WS-F (temuan WS-B) — dulu tidak ada state loading logo: storeLogo
  // berawal null dan baru diisi getStoreSetting() setelah mount, jadi
  // selama fetch berlangsung fallback huruf "T" tampil padahal logo toko
  // sebenarnya ada (hanya belum dimuat). Sekarang loading dibedakan dari
  // "tidak ada logo": huruf fallback hanya tampil setelah fetch selesai
  // dan terbukti tidak ada logo; selama memuat tampil skeleton netral.
  const [storeLogoLoaded, setStoreLogoLoaded] = useState(false);

  // Debugging log client-side to trace sidebar visibility issues
  useEffect(() => {
    console.log("[Sidebar] Client Session Status:", status, "Session Data:", session);
  }, [session, status]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await getStoreSetting();
        if (res.success && res.data) {
          if (res.data.logoUrl) setStoreLogo(res.data.logoUrl);
          if (res.data.name) setStoreName(res.data.name);
        }
      } catch (error) {
        console.error("Gagal memuat setting toko di sidebar", error);
      } finally {
        setStoreLogoLoaded(true);
      }
    };
    fetchSettings();
  }, []);
  const [allowedPages, setAllowedPages] = useState<string[]>([]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/page-access")
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data?.allowedPages) {
            setAllowedPages(res.data.allowedPages);
          }
        })
        .catch((err) => console.error("Error loading page access:", err));
    }
  }, [status]);

  const filteredMenuGroups = menuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // 1. Filter by target role specifically (e.g. SUPER_ADMIN menu)
      if ('role' in item && item.role) {
        const currentRole = (session?.user?.role || "").toUpperCase().replace(/[\s-]+/g, "_");
        const targetRole = (item.role as string).toUpperCase().replace(/[\s-]+/g, "_");
        return currentRole === targetRole;
      }
      // 2. Filter by SUPERADMIN-managed Page Access Visibility
      if ('pageKey' in item && item.pageKey) {
        if (!allowedPages.includes(item.pageKey)) {
          return false;
        }
      }
      // 3. Fallback to normal permission logic
      if (!item.permission) return true;
      return hasPermission(session, item.permission);
    })
  })).filter(group => group.items.length > 0);

  // Sidebar content
  const sidebarContent = (
    <div className="flex flex-col h-full relative">
      {/* Kilau kaca (glassmorphism) — MODE GELAP 26 Nov (WS-B gelap):
          sheen putih jauh diredupkan supaya tidak menyala di atas
          background gelap; hanya kilau atas tipis + cahaya lembut. */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04) 35%, rgba(255,255,255,0.01) 70%, transparent), radial-gradient(ellipse 90% 28% at 50% 0%, rgba(255,255,255,0.14), transparent 70%)",
        }}
      />
      {/* Logo */}
      <div className="h-16 flex items-center px-6">
        <Link href="/dashboard" className="flex items-center gap-3 group w-full">
          {storeLogo ? (
            // TAMPILKAN LOGO GAMBAR
            <div className="relative w-8 h-8 flex-shrink-0 transition-transform group-hover:scale-110">
              <Image
                src={storeLogo}
                alt="Logo"
                fill
                className="object-contain"
                sizes="32px"
              />
            </div>
          ) : !storeLogoLoaded ? (
            // MASIH MEMUAT — skeleton netral, bukan huruf fallback, supaya
            // tidak tampil "T" biru padahal logo sebenarnya ada.
            <div
              aria-hidden
              className="w-8 h-8 rounded-lg bg-white/10 animate-pulse flex-shrink-0"
            />
          ) : (
            // FALLBACK JIKA TIDAK ADA LOGO (Inisial Huruf) — hanya tampil
            // setelah fetch selesai dan terbukti tidak ada logo.
            // Redesain 26 Nov (WS-B): merah gelap #7F1D1D (red-900),
            // bukan gradien biru→ungu.
            <div className="w-8 h-8 rounded-lg bg-red-900 flex items-center justify-center text-white shadow-md shadow-red-900/25 flex-shrink-0 transition-transform group-hover:scale-110">
              <span className="font-bold text-sm">{storeName.charAt(0)}</span>
            </div>
          )}

          {/* NAMA TOKO — mode gelap 26 Nov (WS-B gelap): teks stone-100
              (#F5F5F4) supaya terbaca di atas kaca gelap. */}
          <span className="text-lg font-bold text-stone-100 truncate">
            {storeName}
          </span>
        </Link>
      </div>
      {/* Menu Groups — scrollbar disembunyikan (tetap bisa di-scroll):
          scrollbar-width:none (Firefox) + ::-webkit-scrollbar:hidden
          (Chrome/Safari/Edge). */}
      <nav className="flex-1 overflow-y-auto px-2 pb-6 relative z-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {status === "loading" ? (
          <div className="space-y-6 animate-pulse px-3 mt-4">
            {[1, 2, 3].map((g) => (
              <div key={g} className="space-y-3">
                <div className="h-3 w-16 bg-white/[0.08] rounded" />
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 h-10 px-3 rounded-lg bg-white/[0.05]" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filteredMenuGroups.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-stone-400 bg-red-900/[0.06] rounded-xl border border-red-900/10 m-2">
            Tidak ada akses menu.<br/>Coba <button className="underline text-[#E5484D] font-bold" onClick={async () => {
              const { logout } = await import("@/lib/actions/auth.actions");
              await logout();
            }}>Logout</button> dan login kembali.
          </div>
        ) : (
          filteredMenuGroups.map((group) => (
            <div key={group.label} className="mb-4">
              {/* Label grup — mode gelap 26 Nov (WS-B gelap): 10px,
                  uppercase, tracking lebar, stone-500 (#78716C). */}
              <div className="px-3 py-1 text-[10px] font-semibold text-stone-500 uppercase tracking-wider select-none">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    // MODE GELAP 26 Nov (WS-B gelap): warna menu ditulis
                    // eksplisit di sini (utility Tailwind) supaya menang
                    // atas .sidebar-link di globals.css (milik WS-A) —
                    // layer utilities Tailwind v3 berada setelah layer
                    // components, jadi utility menang walau spesifisitas
                    // .sidebar-link.active sama. Aktif: pil kaca putih
                    // 12% + teks merah terang #E5484D + ring putih tipis
                    // + highlight atas. Biasa: stone-300, hover pil kaca
                    // redup + teks stone-100.
                    className={`sidebar-link ${pathname === item.href ? "active" : ""
                      } ${pathname === item.href
                        ? "bg-white/[0.12] text-[#E5484D] font-semibold ring-1 ring-white/10 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]"
                        : "text-stone-300 hover:bg-white/[0.07] hover:text-stone-100"
                      }`}
                    onClick={() => {
                      setDrawerOpen(false);
                      onClose?.();
                    }}
                  >
                    {/* Ikon diseragamkan 18px + stroke tipis (1.75) lewat
                        CSS — berlaku untuk semua ikon lucide termasuk
                        NotificationBellIcon, tanpa mengubah data menu. */}
                    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:[stroke-width:1.75]">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </nav>
      {/* Logout Button — mode gelap 26 Nov (WS-B gelap): netral
          (stone-300), hover latar merah gelap sangat lembut + teks merah
          terang #E5484D. */}
      <div className="px-4 pb-4 relative z-10">
        <button
          onClick={async () => {
            const { logout } = await import("@/lib/actions/auth.actions");
            await logout();
          }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-stone-300 hover:bg-red-900/20 hover:text-[#E5484D] transition-all"
        >
          <LogOut className="h-[18px] w-[18px]" />
          <span>Logout</span>
        </button>
      </div>
      {/* Footer */}
      <div className="px-6 py-4 text-xs text-stone-500 relative z-10">
        &copy; {new Date().getFullYear()} TB Masdar Utama
      </div>
    </div>
  );

  // Desktop sidebar
  return (
    <>
      {/* Desktop */}
      {/* Kaca gelap (mode gelap 26 Nov, WS-B gelap): isi putih 8%,
          blur 20px, hairline putih 10% di tepi kanan, bayangan lembut.
          JANGAN pakai class glass-card di aside ini (alasan sama seperti
          versi terang: position:relative + overflow:hidden + rounded-2xl
          melawan `fixed` + membuat sidebar docking terlihat seperti
          kartu mengambang). */}
      <aside className="fixed z-30 top-0 left-0 h-screen w-64 hidden md:flex flex-col overflow-hidden border-r border-white/10 bg-white/[0.08] backdrop-blur-[20px] backdrop-saturate-150 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
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
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
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
              {/* Panel drawer kaca gelap — sama seperti sidebar desktop
                  tapi sedikit lebih pekat (putih 12%) karena mengambang
                  di atas konten: blur 20px + hairline kanan putih 10%.
                  `relative` + `overflow-hidden` ditulis eksplisit karena
                  sebelumnya datang dari class glass-card. */}
              <Dialog.Panel className="relative w-64 h-full overflow-hidden rounded-r-2xl border-r border-white/10 bg-white/[0.12] backdrop-blur-[20px] backdrop-saturate-150 shadow-2xl flex flex-col">
                {/* Close button — mode gelap 26 Nov (WS-B gelap): pil kaca
                    gelap (putih 10%) + border putih 15% + ikon stone-300. */}
                <button
                  className="absolute top-4 right-4 bg-white/10 backdrop-blur-md border border-white/15 p-2 rounded-full shadow-sm z-20"
                  onClick={() => { setDrawerOpen(false); onClose?.(); }}
                  aria-label="Tutup menu"
                >
                  <X className="h-5 w-5 text-stone-300" />
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