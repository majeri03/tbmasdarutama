"use client";

import { useEffect, useState } from "react";
import { getCurrentDateTimeWita } from "./report-datetime";
import { getStoreSetting } from "@/lib/actions/store-setting.actions";

/**
 * Blok tanda tangan di akhir laporan.
 * Dipakai semua laporan supaya bentuknya sama.
 *
 * Nama toko dibaca dari DB (StoreSetting) lewat server action — TIDAK ADA
 * lagi nama toko hardcode di file ini. Halaman laporan adalah client
 * component, jadi nama toko dimuat di useEffect; kalau DB belum punya nama
 * toko, baris "Dicetak" tampil tanpa nama toko (bukan nama rekaan).
 * Prop storeName opsional: kalau parent (server) sudah punya namanya, pakai
 * itu dan lewati fetch.
 */
export default function ReportFooter({ storeName: storeNameProp }: { storeName?: string | null }) {
  const [storeName, setStoreName] = useState<string>(storeNameProp || "");

  useEffect(() => {
    if (storeNameProp) return;
    let cancelled = false;
    getStoreSetting()
      .then((res) => {
        if (!cancelled && res.success && res.data?.name) {
          setStoreName(res.data.name);
        }
      })
      .catch(() => {
        // Gagal memuat: footer tetap tampil tanpa nama toko.
      });
    return () => {
      cancelled = true;
    };
  }, [storeNameProp]);

  return (
    <div className="mt-12 break-inside-avoid">
      <div className="grid grid-cols-2 gap-12">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#6B7280]">
            Dibuat oleh
          </p>
          <div className="h-16" />
          <div className="border-b border-[#111111]" />
          <p className="mt-1 text-xs text-[#6B7280]">Nama</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#6B7280]">
            Mengetahui
          </p>
          <div className="h-16" />
          <div className="border-b border-[#111111]" />
          <p className="mt-1 text-xs text-[#6B7280]">Nama</p>
        </div>
      </div>
      <p className="mt-8 text-center text-xs text-[#6B7280]">
        Dicetak: {getCurrentDateTimeWita()}
        {storeName ? ` • ${storeName}` : ""}
      </p>
    </div>
  );
}
