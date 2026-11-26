"use client";
import { useState } from "react";
import Sidebar from "./_components/Sidebar";
import { SessionProvider } from "next-auth/react";
import { NotificationBell } from "./notifications/_components/NotificationBell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SessionProvider>
      {/* Latar body (paper hangat + dot grid + cahaya lembut) sudah diatur
          di globals.css — div ini transparan supaya tekstur itu terlihat. */}
      <div className="flex min-h-screen overflow-x-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 w-full md:ml-64 transition-all duration-300">
          {/* Topbar mobile */}
          <div className="md:hidden flex items-center justify-between p-4">
            <button
              className="glass-card p-2 rounded-lg shadow-md border border-white/30"
              onClick={() => setSidebarOpen(true)}
              aria-label="Buka menu"
            >
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
                <rect y="5" width="24" height="2" rx="1" fill="#7F1D1D" />
                <rect y="11" width="24" height="2" rx="1" fill="#7F1D1D" />
                <rect y="17" width="24" height="2" rx="1" fill="#7F1D1D" />
              </svg>
            </button>
            <NotificationBell />
          </div>
          <main className="p-4 md:p-6 lg:p-8 max-w-full">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}