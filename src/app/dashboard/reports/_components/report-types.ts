/**
 * Data toko untuk kop laporan, dibaca server-side dari DB (StoreSetting)
 * oleh report.actions.ts dan diteruskan sebagai prop — bukan di-fetch
 * client-side oleh ReportHeader (lihat ReportHeader.tsx).
 */
export interface ReportStoreInfo {
  name: string | null;
  address: string | null;
  phone: string | null;
}
