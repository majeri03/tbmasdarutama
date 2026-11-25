import { format } from "date-fns";
import { id } from "date-fns/locale";

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return format(dateObj, "dd MMMM yyyy", { locale: id });
};

export const formatDateTime = (date: Date | string): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return format(dateObj, "dd MMM yyyy HH:mm", { locale: id });
};

const WITA_TIME_ZONE = "Asia/Makassar";

function witaParts(date: Date): { day: string; month: string; year: string; hour: string; minute: string } {
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
  return { day: get("day"), month: get("month"), year: get("year"), hour: get("hour"), minute: get("minute") };
}

export const getCurrentDate = (): string => {
  // FIX (25 Nov 2026, koordinator item 147): tanggal "sekarang" memakai
  // WITA — sebelumnya memakai zona lokal runtime (UTC di Vercel), jadi
  // pukul 00:xx-07:59 WITA tanggalnya masih kemarin.
  const p = witaParts(new Date());
  return `${p.day} ${p.month} ${p.year}`;
};

export const getCurrentDateTime = (): string => {
  // FIX (25 Nov 2026, koordinator item 147): stempel cetak memakai jam
  // WITA + label 'WITA' — sebelumnya jam zona lokal runtime (UTC di
  // Vercel) dengan label hardcode 'WIB'.
  const p = witaParts(new Date());
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute} WITA`;
};