// Lonceng notifikasi untuk layout/sidebar — badge jumlah belum dibaca dari
// GET /api/notifications?unread=true (bukan /api/notifications/count yang
// menghitung DO pending + hutang overdue, bukan notifikasi belum dibaca).

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

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
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pollMs]);
  return count;
}

/** Lonceng lengkap (ikon + badge) untuk topbar. */
export function NotificationBell({ className = "" }: { className?: string }) {
  const unread = useUnreadCount();
  return (
    <Link
      href="/dashboard/notifications"
      className={`relative p-2 rounded-lg hover:bg-white/60 transition-colors ${className}`}
      aria-label={`Notifikasi${unread > 0 ? `, ${unread} belum dibaca` : ""}`}
      title="Notifikasi"
    >
      <Bell className="w-6 h-6 text-gray-700" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

/** Ikon lonceng ber-badge untuk dipakai sebagai ikon menu sidebar. */
export function NotificationBellIcon() {
  const unread = useUnreadCount();
  return (
    <span className="relative inline-flex">
      <Bell className="w-5 h-5" />
      {unread > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </span>
  );
}
