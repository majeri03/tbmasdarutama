-- Tabel pelacakan file Cloudflare R2 (22 Nov 2026).
-- Sebelumnya upload lewat POST /api/upload langsung membuat objek R2 tanpa
-- jejak DB apa pun: file yatim (batal simpan, ganti tanpa hapus, hapus data
-- tanpa hapus file) tidak terdeteksi dan statistik kuota hanya tebakan.
-- WAJIB jalankan `npx prisma migrate deploy` sebelum deploy patch ini.
-- Setelah migrasi, jalankan backfill: POST /api/storage/backfill
-- (atau tombol "Isi data lama" di halaman Penyimpanan) supaya file-file
-- lama ikut tercatat.
CREATE TYPE "R2FileStatus" AS ENUM ('PENDING', 'ACTIVE', 'ORPHANED', 'DELETED', 'DELETE_FAILED');
CREATE TYPE "R2FileOwnerType" AS ENUM ('PRODUCT', 'DELIVERY_PROOF', 'PAYMENT_PROOF', 'HERO', 'LOGO', 'UNKNOWN');

CREATE TABLE "r2_files" (
    "id" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "folder" TEXT NOT NULL,
    "ownerType" "R2FileOwnerType" NOT NULL DEFAULT 'UNKNOWN',
    "ownerId" TEXT,
    "uploadedById" TEXT,
    "status" "R2FileStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "r2_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "r2_files_r2Key_key" ON "r2_files"("r2Key");
CREATE INDEX "r2_files_status_idx" ON "r2_files"("status");
CREATE INDEX "r2_files_folder_idx" ON "r2_files"("folder");
CREATE INDEX "r2_files_ownerType_ownerId_idx" ON "r2_files"("ownerType", "ownerId");

ALTER TABLE "r2_files" ADD CONSTRAINT "r2_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
