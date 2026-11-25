"use client";

import { useEffect, useState } from "react";
import { getStoreSetting } from "@/lib/actions/store-setting.actions";
import { getCurrentDateTimeWita } from "./report-datetime";

interface ReportHeaderProps {
  title: string;
  period?: string;
  /**
   * Data toko dari server (report.actions.ts -> getReportStoreInfo()).
   * Kalau prop ini diisi (walau null — artinya DB memang belum punya data
   * toko), header langsung render dari situ dan TIDAK fetch client-side.
   * Kalau tidak diisi sama sekali, fallback ke fetch lama.
   */
  storeName?: string | null;
  storeAddress?: string | null;
  storePhone?: string | null;
}

/**
 * Kop laporan — nama/alamat/telepon toko dibaca dari DB (StoreSetting),
 * BUKAN dari konstanta hardcode (dulu: COMPANY_INFO di
 * src/lib/constants/company.ts). Kalau DB belum punya data toko, tampil
 * "Data toko belum diisi" dan baris alamat/telepon disembunyikan — tidak
 * ada lagi data toko rekaan di laporan (PKG-E, perbaikan 7 item #1).
 *
 * Kenapa data toko kini dikirim server-side (item 6):
 * Dulu header fetch client-side di useEffect; sebelum fetch selesai, kop
 * sudah terlanjur tampil "Data toko belum diisi" — padahal Info Toko sudah
 * terisi. Itu yang terlihat di Laporan Pembelian setelah Tampilkan, dan
 * lebih parah lagi saat Print/Download PDF ditekan cepat: snapshot
 * (react-to-print / html2canvas) menangkap DOM saat placeholder masih
 * tampil. Sekarang tiap report action menyertakan `store` dan halaman
 * meneruskannya sebagai prop, jadi kop benar sejak paint pertama.
 * Selama data masih dimuat (hanya di jalur fallback tanpa prop), nama toko
 * dibiarkan kosong — placeholder "Data toko belum diisi" HANYA tampil
 * setelah pemuatan selesai dan DB memang tidak punya nama toko.
 */
export default function ReportHeader({
  title,
  period,
  storeName: storeNameProp,
  storeAddress: storeAddressProp,
  storePhone: storePhoneProp,
}: ReportHeaderProps) {
  const serverProvided = storeNameProp !== undefined;
  const [storeName, setStoreName] = useState(storeNameProp ?? "");
  const [storeAddress, setStoreAddress] = useState(storeAddressProp ?? "");
  const [storePhone, setStorePhone] = useState(storePhoneProp ?? "");
  // true = data toko sudah diketahui (dari prop server ATAU fetch selesai).
  const [loaded, setLoaded] = useState(serverProvided);

  useEffect(() => {
    if (serverProvided) return;
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
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [serverProvided]);

  return (
    <div className="mb-8">
      {/* Kop perusahaan */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-wide text-[#111111]">
          {loaded ? storeName || "Data toko belum diisi" : "\u00A0"}
        </h1>
        {loaded && storeAddress && <p className="mt-1 text-sm text-[#6B7280]">{storeAddress}</p>}
        {loaded && storePhone && <p className="text-sm text-[#6B7280]">Telp: {storePhone}</p>}
      </div>

      {/* Garis merah tua */}
      <div className="report-rule-red mt-5 border-t-[3px] border-red-900" />

      {/* Judul laporan */}
      <div className="mt-5 text-center">
        <h2 className="text-xl font-bold uppercase tracking-[0.12em] text-[#111111]">{title}</h2>
        {period && <p className="mt-1 text-sm text-[#6B7280]">Periode: {period}</p>}
        <p className="mt-1 text-xs text-[#6B7280]">Dicetak: {getCurrentDateTimeWita()}</p>
      </div>

      {/* Garis hitam di bawah blok judul */}
      <div className="mt-5 border-b border-[#111111]" />
    </div>
  );
}
