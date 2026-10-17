"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PAGE_KEYS } from "@/lib/constants/page-access";
import { Role } from "@prisma/client";

interface Rule {
  id: string;
  pageKey: string;
  role: string;
  enabled: boolean;
  updatedBy: string | null;
  updatedAt: string;
}

export default function PageAccessDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [matrix, setMatrix] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const isForbidden = status === "authenticated" && !isSuperAdmin;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && isSuperAdmin) {
      fetch("/api/page-access")
        .then((r) => r.json())
        .then((res) => {
          if (res.success) setMatrix(res.data.matrix);
          else setError(res.error || "Gagal memuat.");
        })
        .catch(() => setError("Kesalahan jaringan."))
        .finally(() => setLoading(false));
    }
  }, [status, isSuperAdmin, router]);

  const toggle = async (pageKey: string, role: Role, curr: boolean) => {
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/page-access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageKey, role, enabled: !curr }),
      });
      const r = await res.json();
      if (r.success) {
        setMatrix((prev) =>
          prev.map((item) =>
            item.pageKey === pageKey && item.role === role
              ? { ...item, enabled: !curr, updatedBy: session?.user?.name || "Superadmin", updatedAt: new Date().toISOString() }
              : item
          )
        );
        setMsg(`Berhasil memperbarui.`);
        setTimeout(() => setMsg(null), 2000);
      } else {
        setError(r.error || "Gagal.");
      }
    } catch {
      setError("Error.");
    }
  };

  if (status === "loading" || (isSuperAdmin && loading)) {
    return <div className="p-10 text-center">Memuat...</div>;
  }

  if (isForbidden) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-red-50 text-center rounded-xl border">
        <h2 className="text-xl font-bold text-red-600 mb-2">🚫 Akses Ditolak</h2>
        <p className="text-gray-700">Akses Ditolak. Khusus SUPER_ADMIN.</p>
        <button onClick={() => router.replace("/dashboard")} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">Dashboard</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🛡️ Kelola Akses & Visibilitas Halaman</h1>
        <p className="text-gray-600">Atur visibilitas halaman bagi Admin dan Kasir.</p>
      </div>
      {error && <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>}
      {msg && <div className="p-3 bg-green-100 text-green-700 rounded">{msg}</div>}
      <div className="bg-white border rounded-xl overflow-hidden shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Halaman</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Admin</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Kasir</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Update Terakhir</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {PAGE_KEYS.map((page) => {
              const rAdmin = matrix.find((m) => m.pageKey === page.key && m.role === "ADMIN");
              const rKasir = matrix.find((m) => m.pageKey === page.key && m.role === "KASIR");
              const last = rAdmin?.updatedAt && rKasir?.updatedAt && new Date(rAdmin.updatedAt) > new Date(rKasir.updatedAt) ? rAdmin : (rAdmin || rKasir);

              return (
                <tr key={page.key} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-semibold text-gray-900">{page.label}</td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => toggle(page.key, "ADMIN", !!rAdmin?.enabled)}
                      className={`px-3 py-1 rounded text-xs text-white ${rAdmin?.enabled ? "bg-green-600" : "bg-gray-400"}`}
                    >
                      {rAdmin?.enabled ? "AKTIF" : "NONAKTIF"}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => toggle(page.key, "KASIR", !!rKasir?.enabled)}
                      className={`px-3 py-1 rounded text-xs text-white ${rKasir?.enabled ? "bg-green-600" : "bg-gray-400"}`}
                    >
                      {rKasir?.enabled ? "AKTIF" : "NONAKTIF"}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {last?.updatedBy ? `${last.updatedBy} (${new Date(last.updatedAt).toLocaleDateString()})` : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

