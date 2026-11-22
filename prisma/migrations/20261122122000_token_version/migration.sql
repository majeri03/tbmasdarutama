-- Tambah tokenVersion untuk pencabutan token mobile (22 Nov 2026).
-- verifyMobileToken menolak token yang tv-nya tidak sama dengan nilai ini;
-- ganti password / nonaktifkan akun / ganti role / logout menaikkan nilainya.
-- Token lama (tanpa klaim tv) dianggap tv=0, jadi tetap valid sampai ada
-- perubahan akun — tidak ada logout massal mendadak saat deploy.
ALTER TABLE "users" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
