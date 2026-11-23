-- Salesman + poin loyalitas customer (23 Nov 2026, perbaikan 7 item #5/#6).
-- Salesman: CRUD penuh, dipilih per transaksi di POS, tercatat internal di
-- Sale (salesmanId) — TIDAK PERNAH dicetak di invoice/struk/surat jalan.
-- Poin: Customer.points bertambah otomatis di createSale hanya kalau
-- pointsEnabled + bukan CREDIT + customer bukan UMUM + grandTotal > 0.
-- Pengaturan poin (pointsEnabled, pointsRupiahPerPoint) di store_settings,
-- diatur SUPER_ADMIN dari tab Sales di Pengaturan.
-- WAJIB jalankan `npx prisma migrate deploy` sebelum deploy patch ini.
CREATE TABLE "salesmen" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "salesmen_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "customers" ADD COLUMN "points" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "store_settings" ADD COLUMN "pointsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "store_settings" ADD COLUMN "pointsRupiahPerPoint" INTEGER NOT NULL DEFAULT 10000;

ALTER TABLE "sales" ADD COLUMN "salesmanId" TEXT;

ALTER TABLE "sales" ADD CONSTRAINT "sales_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "salesmen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "sales_salesmanId_idx" ON "sales"("salesmanId");
