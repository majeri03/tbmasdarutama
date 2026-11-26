"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { hasMinimumRole } from "@/lib/utils/role";

interface PageGuardProps {
  pageKey: "pos" | "reports_settings" | "po" | "invoice_layout" | "stock_opname" | "salesmen" | "points";
  children: React.ReactNode;
}

// Halaman yang aksesnya ditentukan LANGSUNG oleh role, bukan oleh matriks
// "Akses Halaman" (SUPER_ADMIN yang mengatur). Matriks itu default-nya
// nonaktif untuk ADMIN/KASIR, jadi kalau "salesmen"/"points" masuk matriks,
// KASIR akan terblokir padahal aturannya KASIR+ boleh baca. Karena itu dua
// halaman baru ini dicek dengan hasMinimumRole(KASIR) di bawah —
// SUPER_ADMIN tetap lolos seperti biasa, dan tidak ada baris matriks baru
// yang perlu di-seed di database.
const ROLE_GATED_PAGE_KEYS: Record<string, "KASIR"> = {
  salesmen: "KASIR",
  points: "KASIR",
};

export default function PageGuard({ pageKey, children }: PageGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  const normalizeRole = (role?: string) => (role || "").toUpperCase().replace(/[\s-]+/g, "_");
  const isSuperAdmin = normalizeRole(session?.user?.role) === "SUPER_ADMIN";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && !isSuperAdmin) {
      // Halaman berbasis role (salesmen/points): tanpa matriks Akses Halaman.
      const minRole = ROLE_GATED_PAGE_KEYS[pageKey];
      if (minRole) {
        setAllowed(hasMinimumRole(session, minRole));
        return;
      }
      fetch("/api/page-access")
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data?.allowedPages) {
            setAllowed(res.data.allowedPages.includes(pageKey));
          } else {
            setAllowed(false);
          }
        })
        .catch(() => setAllowed(false));
    }
  }, [status, isSuperAdmin, pageKey, router, session]);

  // Derived effective permission
  const isEffectiveAllowed = isSuperAdmin ? true : allowed;

  if (status === "loading" || (!isSuperAdmin && isEffectiveAllowed === null)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-900"></div>
        <p className="text-gray-500 text-sm">Memverifikasi hak akses halaman...</p>
      </div>
    );
  }

  if (!isEffectiveAllowed) {
    return (
      <div className="max-w-md mx-auto mt-16 p-8 bg-white border border-gray-150 rounded-2xl text-center shadow-lg">
        <div className="text-5xl mb-4">🚫</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Halaman Tidak Tersedia</h2>
        <p className="text-gray-600 text-sm">
          Akses ke halaman ini belum dibuka oleh Superadmin untuk Peran Anda saat ini.
        </p>
        <button
          onClick={() => router.replace("/dashboard")}
          className="mt-6 px-5 py-2.5 bg-red-900 hover:bg-red-800 text-white font-semibold rounded-lg transition shadow"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

