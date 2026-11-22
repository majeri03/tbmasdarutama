-- Penugasan sopir ke kendaraan (22 Nov 2026, rombakan armada).
-- FleetVehicle.driverName/driverPhone selama ini teks bebas tanpa kaitan ke
-- akun User, sehingga aturan GPS hanya bisa ADMIN+ dan sopir KASIR yang
-- ditugaskan selalu ditolak 403. Dua kolom baru mengaitkan kendaraan ke akun
-- sopir utama dan sopir pendamping (keduanya boleh role apa pun — ADMIN pun
-- bisa jadi sopir); dua sopir yang jalan bareng bisa ditugaskan ke kendaraan
-- yang sama. Hapus akun -> SET NULL, kendaraan tetap ada.
-- WAJIB jalankan `npx prisma migrate deploy` sebelum deploy patch ini.
ALTER TABLE "fleet_vehicles" ADD COLUMN "driverUserId" TEXT;
ALTER TABLE "fleet_vehicles" ADD COLUMN "coDriverUserId" TEXT;

ALTER TABLE "fleet_vehicles" ADD CONSTRAINT "fleet_vehicles_driverUserId_fkey" FOREIGN KEY ("driverUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fleet_vehicles" ADD CONSTRAINT "fleet_vehicles_coDriverUserId_fkey" FOREIGN KEY ("coDriverUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
