"use client";
import { useState } from "react";
import Sidebar from "./_components/Sidebar";
import { SessionProvider } from "next-auth/react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SessionProvider>
      <div className="flex min-h-screen bg-gradient-to-br from-blue-100/60 to-white/80 overflow-x-hidden">
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
                <rect y="5" width="24" height="2" rx="1" fill="#2563eb" />
                <rect y="11" width="24" height="2" rx="1" fill="#2563eb" />
                <rect y="17" width="24" height="2" rx="1" fill="#2563eb" />
              </svg>
            </button>
          </div>
          <main className="p-4 md:p-6 lg:p-8 max-w-full">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}