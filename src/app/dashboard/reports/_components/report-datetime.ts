/**
 * Format tanggal khusus laporan — selalu zona WITA (Asia/Makassar, UTC+8).
 *
 * Dipakai SEMUA laporan (kop "Dicetak: ...", kolom tanggal, label periode)
 * supaya tidak ada lagi stempel "WIB" dan tidak ada lagi tanggal yang
 * bergeser karena zona waktu server (Vercel = UTC) atau browser.
 *
 * Kenapa file ini ada (item 147 & 139):
 * - `getCurrentDateTime()` di src/lib/utils/pdf-helpers.ts menulis label
 *   'WIB' secara hardcode dan memakai zona lokal runtime. File itu dipakai
 *   bersama generator invoice (di luar workstream ini), jadi laporan pakai
 *   helper sendiri di sini — jangan ubah pdf-helpers.ts dari workstream ini.
 * - String "yyyy-MM-dd" (label periode dari <input type="date">) dibaca
 *   sebagai TANGGAL KALENDER, bukan sebagai tengah malam UTC — jadi
 *   "2026-11-23" selalu tampil 23 November 2026, di zona mana pun.
 */

export const WITA_TIME_ZONE = "Asia/Makassar";

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function witaParts(date: Date): {
  day: string;
  month: string;
  year: string;
  hour: string;
  minute: string;
} {
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: WITA_TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: get("day"),
    month: get("month"),
    year: get("year"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** "25 November 2026" — tanggal transaksi dalam zona WITA. */
export function formatDateWita(date: Date | string): string {
  if (typeof date === "string") {
    // "yyyy-MM-dd" = tanggal kalender pilihan user: tampilkan apa adanya,
    // jangan lewat Date (akan jadi tengah malam UTC dan bisa geser hari).
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
    if (m) {
      const monthIndex = Number(m[2]) - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        return `${Number(m[3])} ${MONTHS_ID[monthIndex]} ${m[1]}`;
      }
      return date;
    }
  }
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return String(date);
  const p = witaParts(d);
  return `${Number(p.day)} ${p.month} ${p.year}`;
}

/** "25 November 2026, 15:16 WITA" — stempel cetak laporan. */
export function getCurrentDateTimeWita(): string {
  const p = witaParts(new Date());
  return `${Number(p.day)} ${p.month} ${p.year}, ${p.hour}:${p.minute} WITA`;
}
