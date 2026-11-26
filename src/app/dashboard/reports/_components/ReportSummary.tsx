import { ReactNode } from "react";

/**
 * Judul bagian di dalam isi laporan.
 * Dipakai semua laporan supaya bentuknya sama.
 */
export function ReportSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-4 border-b border-white/25 print:border-[#111111] pb-2 text-sm font-bold uppercase tracking-[0.08em] text-stone-100 print:text-[#111111]">
      {children}
    </h3>
  );
}

export interface ReportSummaryItem {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
}

interface ReportSummaryProps {
  title?: string;
  items: ReportSummaryItem[];
}

/**
 * Tabel ringkasan dua kolom (label | angka).
 * Kotak putih polos, garis hitam di atas dan bawah, baris zebra.
 * Dipakai semua laporan untuk menggantikan kartu ringkasan warna-warni.
 */
export default function ReportSummary({ title, items }: ReportSummaryProps) {
  return (
    <div className="mb-6">
      {title && <ReportSectionTitle>{title}</ReportSectionTitle>}
      <div className="border-y-2 border-white/40 print:border-[#111111]">
        <table className="w-full text-sm">
          <tbody>
            {items.map((item) => (
              <tr
                key={item.label}
                className="border-b border-white/10 print:border-gray-200 even:bg-white/[0.04] print:even:bg-[#FAFAFA] last:border-b-0"
              >
                <td className="px-3 py-2.5 text-stone-400 print:text-[#6B7280]">{item.label}</td>
                <td
                  className={`px-3 py-2.5 text-right tabular-nums text-stone-100 print:text-[#111111] ${
                    item.strong ? "font-bold" : "font-semibold"
                  }`}
                >
                  {item.value}
                  {item.note && (
                    <span className="block text-xs font-normal text-stone-400 print:text-[#6B7280]">
                      {item.note}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
