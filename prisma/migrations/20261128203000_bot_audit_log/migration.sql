-- WS-A (28 Nov 2026, API bot /api/bot/*): audit log semua tulis bot.
-- Satu baris per aksi tulis (produk/pelanggan/penjualan/pembayaran/
-- delivery/penyesuaian stok), supaya penyalahgunaan kunci bot bisa
-- ditelusuri. before/after JSONB ringkas (dipotong ~2000 karakter di
-- src/lib/bot-auth.ts). JANGAN PERNAH mencatat kunci API di tabel ini.
--
-- WAJIB jalankan `npx prisma migrate deploy` sebelum deploy patch ini
-- (dan `npx prisma generate` setelahnya, supaya Prisma Client kenal
-- model BotAuditLog). Aman dijalankan ulang: migrasi tercatat sekali di
-- _prisma_migrations. Nama index mengikuti konvensi default Prisma
-- ({tabel}_{kolom}_idx) supaya schema.prisma dan database cocok.
CREATE TABLE "bot_audit_logs" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "level" INTEGER NOT NULL,
  "sender" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "error" TEXT,
  CONSTRAINT "bot_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bot_audit_logs_createdAt_idx" ON "bot_audit_logs"("createdAt");
CREATE INDEX "bot_audit_logs_sender_idx" ON "bot_audit_logs"("sender");
