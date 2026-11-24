-- Fee/komisi salesman per invoice (24 Nov 2026).
-- Global: store_settings.salesmanFeeEnabled (default MATI/false) +
-- salesmanFeePercent (default 2%). Per invoice: sales.salesmanFeeEnabled /
-- sales.salesmanFeePercent, NULL = ikut global.
-- Fee = floor(grandTotal * persen / 100), hanya bila fee global AKTIF dan
-- penjualan punya salesman. Kalau fee global MATI, fee semua invoice Rp0
-- apa pun pengaturan per invoicenya.
-- Fee TIDAK PERNAH dicetak di invoice/struk/surat jalan.
-- WAJIB jalankan `npx prisma migrate deploy` sebelum deploy patch ini.
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "salesmanFeeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "salesmanFeePercent" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "salesmanFeeEnabled" BOOLEAN;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "salesmanFeePercent" INTEGER;
