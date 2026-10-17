"use client";

import { useState } from "react";
import { PAGE_KEYS } from "@/lib/constants/page-access";
import { updatePageAccess } from "@/lib/actions/page-access.actions";
import { Role } from "@prisma/client";

export interface Rule {
  id: string;
  pageKey: string;
  role: string;
  enabled: boolean;
  updatedBy: string | null;
  updatedAt: Date | string;
}

interface PageAccessClientProps {
  initialMatrix: Rule[];
}

export default function PageAccessClient({ initialMatrix }: PageAccessClientProps) {
  const [matrix, setMatrix] = useState<Rule[]>(initialMatrix);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const toggle = async (pageKey: string, role: Role, curr: boolean) => {
    const updatingKey = `${pageKey}-${role}`;
    setUpdating(updatingKey);
    setError(null);
    setMsg(null);

    try {
      const res = await updatePageAccess(pageKey, role, !curr);
      if (res.success && res.data) {
        setMatrix((prev) =>
          prev.map((item) =>
            item.pageKey === pageKey && item.role === role
              ? {
                  ...item,
                  enabled: !curr,
                  updatedBy: res.data?.updatedBy || "Superadmin",
                  updatedAt: new Date().toISOString(),
                }
              : item
          )
        );
        const label = PAGE_KEYS.find((p) => p.key === pageKey)?.label || pageKey;
        setMsg(`Berhasil mengubah akses ${role} untuk ${label} menjadi ${!curr ? "AKTIF" : "NONAKTIF"}.`);
        setTimeout(() => setMsg(null), 3000);
      } else {
        setError(res.error || "Gagal memperbarui hak akses.");
      }
    } catch {
      setError("Kesalahan koneksi saat menyimpan perubahan.");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-6">
      {error && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
      {msg && <div className="p-3 bg-green-100 text-green-700 rounded-lg text-sm transition-opacity">{msg}</div>}

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
              const last =
                rAdmin?.updatedAt && rKasir?.updatedAt && new Date(rAdmin.updatedAt) > new Date(rKasir.updatedAt)
                  ? rAdmin
                  : rAdmin || rKasir;

              return (
                <tr key={page.key} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-semibold text-gray-900">{page.label}</td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => toggle(page.key, Role.ADMIN, !!rAdmin?.enabled)}
                      disabled={updating !== null}
                      className={`px-3 py-1 rounded text-xs font-bold text-white transition ${
                        rAdmin?.enabled ? "bg-green-600 hover:bg-green-700" : "bg-gray-400 hover:bg-gray-500"
                      } ${updating === `${page.key}-ADMIN` ? "opacity-50" : ""}`}
                    >
                      {rAdmin?.enabled ? "AKTIF" : "NONAKTIF"}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => toggle(page.key, Role.KASIR, !!rKasir?.enabled)}
                      disabled={updating !== null}
                      className={`px-3 py-1 rounded text-xs font-bold text-white transition ${
                        rKasir?.enabled ? "bg-green-600 hover:bg-green-700" : "bg-gray-400 hover:bg-gray-500"
                      } ${updating === `${page.key}-KASIR` ? "opacity-50" : ""}`}
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
