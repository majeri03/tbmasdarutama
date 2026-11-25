-- Nilai awal akses halaman per peran (25 Nov 2026, item 184 — keputusan Jery).
-- POS: ADMIN AKTIF, KASIR AKTIF.
-- Reports dan Settings: ADMIN AKTIF, KASIR NONAKTIF.
-- PO Barang (Purchase Order): ADMIN AKTIF, KASIR NONAKTIF.
-- Desain dan Layout Invoice: ADMIN NONAKTIF, KASIR NONAKTIF (khusus SUPER_ADMIN).
-- Stock Opname: ADMIN AKTIF, KASIR NONAKTIF.
-- Baris-baris ini SUDAH ADA di DB produksi dengan nilai NONAKTIF (dibuktikan
-- tes batch 8: toggle POS/ADMIN bisa diubah lalu dikembalikan), jadi mengubah
-- default di kode saja TIDAK cukup — migrasi data ini yang menulis nilainya.
-- WAJIB jalankan `npx prisma migrate deploy` sebelum deploy patch ini.
-- Aman dijalankan ulang (idempotent): baris yang sudah ada hanya di-update
-- kolom "enabled"-nya. Sekali migrasi tercatat di _prisma_migrations, deploy
-- normal TIDAK menjalankannya lagi, jadi toggle yang SUPER_ADMIN ubah manual
-- lewat halaman Akses Halaman setelah ini tetap bertahan.

-- Pengaman: tabel page_access belum pernah dibuat oleh migrasi mana pun di
-- repo ini (dibuat via db push). Kalau tabel belum ada di DB target, buat
-- dulu sesuai prisma/schema.prisma supaya INSERT di bawah tidak gagal.
-- Di DB produksi tabel sudah ada, jadi blok ini no-op.
CREATE TABLE IF NOT EXISTS "page_access" (
  "id" TEXT NOT NULL,
  "pageKey" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "page_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "page_access_pageKey_role_key" ON "page_access"("pageKey", "role");

INSERT INTO "page_access" ("id", "pageKey", "role", "enabled", "updatedAt") VALUES
  ('pa_pos_admin', 'pos', 'ADMIN'::"Role", true, NOW()),
  ('pa_pos_kasir', 'pos', 'KASIR'::"Role", true, NOW()),
  ('pa_reports_settings_admin', 'reports_settings', 'ADMIN'::"Role", true, NOW()),
  ('pa_reports_settings_kasir', 'reports_settings', 'KASIR'::"Role", false, NOW()),
  ('pa_po_admin', 'po', 'ADMIN'::"Role", true, NOW()),
  ('pa_po_kasir', 'po', 'KASIR'::"Role", false, NOW()),
  ('pa_invoice_layout_admin', 'invoice_layout', 'ADMIN'::"Role", false, NOW()),
  ('pa_invoice_layout_kasir', 'invoice_layout', 'KASIR'::"Role", false, NOW()),
  ('pa_stock_opname_admin', 'stock_opname', 'ADMIN'::"Role", true, NOW()),
  ('pa_stock_opname_kasir', 'stock_opname', 'KASIR'::"Role", false, NOW())
ON CONFLICT ("pageKey", "role") DO UPDATE SET
  "enabled" = EXCLUDED."enabled",
  "updatedAt" = NOW();
