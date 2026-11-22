import { COMPANY_INFO } from "@/lib/constants/company";
import { getCurrentDateTime } from "@/lib/utils/pdf-helpers";

interface ReportHeaderProps {
  title: string;
  period?: string;
}

export default function ReportHeader({ title, period }: ReportHeaderProps) {
  return (
    <div className="mb-8">
      {/* Kop perusahaan */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-wide text-[#111111]">{COMPANY_INFO.name}</h1>
        <p className="mt-1 text-sm text-[#6B7280]">{COMPANY_INFO.address}</p>
        <p className="text-sm text-[#6B7280]">Telp: {COMPANY_INFO.phone}</p>
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
