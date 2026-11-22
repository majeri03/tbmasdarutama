-- Rate limit berbasis database (22 Nov 2026, pentest M28).
-- Hitungan in-memory per instance tidak berlaku antar-instance serverless
-- Vercel (tiap instance punya hitungannya sendiri, hilang saat di-recycle),
-- jadi batas percobaan login / ganti password / reset password dipindah ke
-- tabel ini. Satu baris per kunci (mis. "login:1.2.3.4:user@mail.com").
-- WAJIB jalankan `npx prisma migrate deploy` sebelum deploy patch ini.
CREATE TABLE "rate_limits" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);
