// Lonceng notifikasi untuk layout/sidebar — badge jumlah belum dibaca dari
// GET /api/notifications?unread=true (bukan /api/notifications/count yang
// menghitung DO pending + hutang overdue, bukan notifikasi belum dibaca).
//
// SATU SUMBER HITUNGAN (batch 7 item 192 + temuan batch 1a): badge ini DAN
// header halaman /dashboard/notifications membaca angka yang sama — field
// `unreadCount` dari GET /api/notifications. Dulu keduanya mengambil dari
// endpoint yang sama tapi pada waktu yang berbeda: badge hanya refresh tiap
// 60 detik (polling), sementara halaman mengupdate angkanya sendiri setelah
// "Tandai Semua Dibaca" / "Hapus yang Dibaca" — jadi badge sempat tampil 11
// padahal header sudah "Semua sudah dibaca" (dan sebaliknya).
// Sekarang halaman notifikasi memanggil notifyNotificationsChanged() setiap
// kali selesai mengubah status notifikasi, dan hook ini langsung fetch ulang
// — polling 60 detik tinggal jadi jaring pengaman.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

/** Event yang disiarkan halaman notifikasi setelah mengubah status notifikasi. */
export const NOTIFICATIONS_CHANGED_EVENT = "masdar:notifications-changed";

/** Panggil ini setelah tandai-baca / hapus notifikasi supaya badge langsung sinkron. */
export function notifyNotificationsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }
}

export function useUnreadCount(pollMs = 60000): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/notifications?unread=true&limit=1");
        const json = await res.json();
        if (alive && json.success) setCount(json.data?.unreadCount ?? 0);
      } catch {
        // diam — badge hilang, halaman notifikasi tetap bisa dibuka
      }
    };
    fetchCount();
    const t = setInterval(fetchCount, pollMs);
    // Refresh seketika saat halaman notifikasi mengubah status (tandai
    // dibaca / hapus yang dibaca) — jangan tunggu polling berikutnya.
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, fetchCount);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, fetchCount);
    };
  }, [pollMs]);
  return count;
}

/** Lonceng lengkap (ikon + badge) untuk topbar.
    Redesain 26 Nov (WS-B): pil kaca putih + hairline, ikon stone-600,
    badge angka merah gelap solid #7F1D1D (red-900). Logika polling/klik
    TIDAK diubah. */
export function NotificationBell({ className = "" }: { className?: string }) {
  const unread = useUnreadCount();
  return (
    <Link
      href="/dashboard/notifications"
      className={`relative flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(28,25,23,0.08)] bg-white/70 shadow-sm backdrop-blur-md transition-colors hover:bg-white/90 ${className}`}
      aria-label={`Notifikasi${unread > 0 ? `, ${unread} belum dibaca` : ""}`}
      title="Notifikasi"
    >
      <Bell className="h-5 w-5 text-stone-600" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-900 text-white text-[11px] font-bold flex items-center justify-center ring-1 ring-white/70">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

/** Ikon lonceng ber-badge untuk dipakai sebagai ikon menu sidebar.
    Redesain 26 Nov (WS-B): ikon 18px (selaras dengan ikon menu lain —
    wrapper di Sidebar juga memaksa 18px), badge merah gelap solid
    #7F1D1D (red-900) + ring putih tipis supaya terbaca di atas kaca. */
export function NotificationBellIcon() {
  const unread = useUnreadCount();
  return (
    <span className="relative inline-flex">
      <Bell className="h-[18px] w-[18px]" />
      {unread > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-900 text-white text-[10px] font-bold flex items-center justify-center ring-1 ring-white/70">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </span>
  );
}
