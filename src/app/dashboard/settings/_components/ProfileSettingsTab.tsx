"use client";

import { useSession } from "next-auth/react";

/**
 * Tab Profil Akun — tampilan minimalis: daftar baris label + nilai saja,
 * tanpa kotak input dan dekorasi. Data nama/email/role berasal dari sesi
 * (diisi callback jwt/session di src/lib/auth.ts).
 */
export default function ProfileSettingsTab() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="max-w-2xl">
        <h2 className="text-lg font-semibold text-gray-900">Profil Akun</h2>
        <p className="mt-1 text-sm text-gray-500">Memuat data akun…</p>
        <div className="mt-6 space-y-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="border-b border-gray-100 pb-4">
              <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
              <div className="mt-2 h-4 w-56 animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (status === "unauthenticated" || !session?.user) {
    return (
      <div className="max-w-2xl">
        <h2 className="text-lg font-semibold text-gray-900">Profil Akun</h2>
        <p className="mt-1 text-sm text-gray-500">
          Sesi tidak ditemukan. Silakan login ulang untuk melihat profil Anda.
        </p>
      </div>
    );
  }

  const rows: Array<{ label: string; value: string }> = [
    { label: "Nama Lengkap", value: session.user.name || "—" },
    { label: "Alamat Email", value: session.user.email || "—" },
    { label: "Peran (Role)", value: session.user.role || "—" },
  ];

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-gray-900">Profil Akun</h2>
      <p className="mt-1 text-sm text-gray-500">
        Informasi akun Anda. Data ini hanya untuk dilihat.
      </p>

      <dl className="mt-6 divide-y divide-gray-100 border-y border-gray-100">
        {rows.map((row) => (
          <div key={row.label} className="py-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
              {row.label}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{row.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-xs text-gray-400">
        Untuk mengubah nama atau email, hubungi admin toko.
      </p>
    </div>
  );
}
