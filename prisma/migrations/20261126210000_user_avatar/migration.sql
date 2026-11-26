-- WS-9 (26 Nov 2026, fitur Profil): foto profil user.
--
-- 1. Kolom avatarUrl di users (nullable — user lama tetap null = tanpa foto).
-- 2. Nilai AVATAR di enum R2FileOwnerType untuk pelacakan file avatar
--    di tabel r2_files (folder "avatars").
--
-- WAJIB jalankan `npx prisma migrate deploy` sebelum deploy patch ini
-- (dan `npx prisma generate` setelahnya, supaya Prisma Client kenal
-- kolom/enum baru). Aman dijalankan ulang: migrasi tercatat sekali di
-- _prisma_migrations. Catatan Postgres: ALTER TYPE ... ADD VALUE boleh
-- jalan di dalam transaksi (sejak PG 12), dan migrasi ini tidak memakai
-- nilai baru itu di pernyataan lain, jadi tidak ada risiko di sini.
ALTER TABLE "users" ADD COLUMN "avatarUrl" TEXT;

ALTER TYPE "R2FileOwnerType" ADD VALUE IF NOT EXISTS 'AVATAR';
