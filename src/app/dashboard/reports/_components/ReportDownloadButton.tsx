"use client";

import { Download } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useState } from "react";

interface ReportDownloadButtonProps {
  targetRef: React.RefObject<HTMLDivElement>;
  filename: string;
  disabled?: boolean;
}

/**
 * dark-8 (26 Nov 2026) — PDF laporan harus TERANG di mode gelap.
 *
 * Masalah: html2canvas memotret DOM layar dan MENGABAIKAN @media print,
 * jadi varian print: yang terang (print:text-[#111111], print:bg-white,
 * dst.) tidak berlaku di snapshot — PDF ikut gelap walau Print browser
 * tetap terang. Opsi backgroundColor: "#ffffff" di bawah hanya mengisi
 * latar kanvas, bukan warna elemen di dalamnya.
 *
 * Cara kerja: onclone menerima DOKUMEN HASIL CLONE (bukan halaman asli).
 * Style di bawah disuntikkan ke <head> clone saja — halaman gelap di
 * layar TIDAK berubah, dan style ini mati bersama clone setelah snapshot
 * selesai. Isinya menimpa kelas gelap di dalam #print-content dengan nilai
 * terang yang SAMA dengan varian print: tiap elemen (jadi PDF = hasil
 * print). Daftar kelas diambil dari inventarisasi 9 file isi laporan
 * (6 *ReportContent + ReportHeader + ReportSummary + ReportFooter).
 *
 * Kenapa selektor [class~="..."]: mencocokkan token class persis tanpa
 * perlu escape (bandingkan .text-\[\#E5484D\]); html2canvas membaca style
 * lewat getComputedStyle browser pada clone, jadi semua CSS valid berlaku.
 * :nth-child(even) pada baris zebra dipertahankan supaya corak selang-
 * seling putih/#FAFAFA sama seperti print.
 */
const LIGHT_SNAPSHOT_CSS = `
#print-content { background: #ffffff !important; color: #111111 !important; }
#print-content [class~="text-stone-100"] { color: #111111 !important; }
#print-content [class~="text-stone-400"] { color: #6b7280 !important; }
#print-content [class~="bg-[#1C1917]"] { background-color: #ffffff !important; }
#print-content [class~="border-white/40"] { border-color: #111111 !important; }
#print-content [class~="border-white/25"] { border-color: #111111 !important; }
#print-content [class~="border-white/10"] { border-color: #e5e7eb !important; }
#print-content [class~="even:bg-white/[0.04]"]:nth-child(even) { background-color: #fafafa !important; }
#print-content [class~="bg-white/[0.04]"] { background-color: #fafafa !important; }
#print-content [class~="bg-white/[0.06]"] { background-color: #fafafa !important; }
#print-content [class~="text-[#E5484D]"] { color: #7f1d1d !important; }
#print-content [class~="border-[#E5484D]"] { border-color: #7f1d1d !important; }
#print-content .report-total-red { color: #7f1d1d !important; }
#print-content .report-rule-red { border-color: #7f1d1d !important; }
`;

export default function ReportDownloadButton({ 
  targetRef, 
  filename,
  disabled = false 
}: ReportDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!targetRef.current) return;

    setIsDownloading(true);
    try {
      const canvas = await html2canvas(targetRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        // dark-8: suntikkan style terang ke DOKUMEN CLONE saja (lihat
        // LIGHT_SNAPSHOT_CSS di atas). Halaman gelap di layar tidak berubah.
        // "?." untuk jaga-jaga: head selalu ada di dokumen clone, tapi
        // tsconfig proyek strict — jangan sampai tsc gagal karena null.
        onclone: (clonedDoc) => {
          const style = clonedDoc.createElement("style");
          style.textContent = LIGHT_SNAPSHOT_CSS;
          clonedDoc.head?.appendChild(style);
        },
      });

      // OPT-C (23 Nov 2026): JPEG q0.85, bukan PNG — PDF 1 halaman turun
      // dari ~8,5 MB jadi ratusan KB. Teks tetap tajam karena scale 2.
      const imgData = canvas.toDataURL("image/jpeg", 0.85);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if content is longer
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${filename}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Gagal download PDF. Silakan coba lagi.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isDownloading || disabled}
      className="inline-flex items-center gap-2 rounded-lg bg-[#7F1D1D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#991B1B] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download className="w-4 h-4" />
      {isDownloading ? "Mengunduh..." : "Download PDF"}
    </button>
  );
}