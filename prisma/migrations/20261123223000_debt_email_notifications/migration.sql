-- Email pengingat utang jatuh tempo (23 Nov 2026, PKG-H).
-- DebtNotificationRecipient: daftar email penerima ringkasan utang,
-- dikelola SUPER_ADMIN dari tab "Notifikasi Utang" di Pengaturan.
-- DebtEmailLog: jejak pengiriman, dipakai dedup harian (cron terpanggil
-- 2x dalam sehari tidak boleh mengirim 2x) + info "terakhir terkirim".
-- store_settings: saklar email + jadwal pengingat (hari lewat jatuh
-- tempo, dipisah koma, default "3,7,30") + jendela "akan jatuh tempo".
-- WAJIB jalankan `npx prisma migrate deploy` + `npx prisma generate`
-- sebelum `npx tsc --noEmit` / `npm run build`.
CREATE TABLE "debt_notification_recipients" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "debt_notification_recipients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "debt_notification_recipients_email_key" ON "debt_notification_recipients"("email");

CREATE TABLE "debt_email_logs" (
  "id" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "customerOverdue" INTEGER NOT NULL DEFAULT 0,
  "customerDueSoon" INTEGER NOT NULL DEFAULT 0,
  "supplierOverdue" INTEGER NOT NULL DEFAULT 0,
  "supplierDueSoon" INTEGER NOT NULL DEFAULT 0,
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "totalCustomer" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "totalSupplier" DECIMAL(15,2) NOT NULL DEFAULT 0,
  CONSTRAINT "debt_email_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "store_settings" ADD COLUMN "debtEmailEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "store_settings" ADD COLUMN "debtReminderDays" TEXT NOT NULL DEFAULT '3,7,30';
ALTER TABLE "store_settings" ADD COLUMN "debtEmailDaysBefore" INTEGER NOT NULL DEFAULT 3;
