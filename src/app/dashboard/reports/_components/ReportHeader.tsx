"use client";

import { useEffect, useState } from "react";
import { getStoreSetting } from "@/lib/actions/store-setting.actions";
import { getCurrentDateTime } from "@/lib/utils/pdf-helpers";

interface ReportHeaderProps {
  title: string;
  period?: string;
}

/**
 * Kop laporan — nama/alamat/telepon toko dibaca dari DB (StoreSetting),
 * BUKAN dari konstanta hardcode (dulu: COMPANY_INFO di
 * src/lib/constants/company.ts). Kalau DB belum punya data toko, tampil
 * "Data toko belum diisi" dan baris alamat/telepon disembunyikan — tidak
 * ada lagi data toko rekaan di laporan (PKG-E, perbaikan 7 item #1).
 */
export default function ReportHeader({ title, period }: ReportHeaderProps) {
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storePhone, setStorePhone] = useState("");

  useEffect(() => {
    let cancelled = false;
    getStoreSetting()
      .then((res) => {
        if (!cancelled && res.success && res.data) {
          setStoreName(res.data.name || "");
          setStoreAddress(res.data.address || "");
          setStorePhone(res.data.phone || "");
        }
      })
      .catch(() => {
        // Gagal memuat: kop tetap tampil tanpa data toko.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mb-8">
      {/* Kop perusahaan */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-wide text-[#111111]">
          {storeName || "Data toko belum diisi"}
        </h1>
        {storeAddress && <p className="mt-1 text-sm text-[#6B7280]">{storeAddress}</p>}
        {storePhone && <p className="text-sm text-[#6B7280]">Telp: {storePhone}</p>}
      </div>

      {/* Garis merah tua */}
      <div className="report-rule-red mt-5 border-t-[3px] border-red-900" />

      {/* Judul laporan */}
      <div className="mt-5 text-center">
        <h2 className="text-xl font-bold uppercase tracking-[0.12em] text-[#111111]">{title}</h2>
        {period && <p className="mt-1 text-sm text-[#6B7280]">Periode: {period}</p>}
        <p className="mt-1 text-xs text-[#6B7280]">Dicetak: {getCurrentDateTime()}</p>
      </div>

      {/* Garis hitam di bawah blok judul */}
      <div className="mt-5 border-b border-[#111111]" />
    </div>
  );
}
