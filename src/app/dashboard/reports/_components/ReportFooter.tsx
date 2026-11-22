import { getCurrentDateTime } from "@/lib/utils/pdf-helpers";

/**
 * Blok tanda tangan di akhir laporan.
 * Dipakai semua laporan supaya bentuknya sama.
 */
export default function ReportFooter() {
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
        Dicetak: {getCurrentDateTime()} • TB Masdar Utama
      </p>
    </div>
  );
}
