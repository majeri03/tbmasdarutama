-- OTP verifikasi email akun baru (23 Nov 2026, PKG-I).
-- EmailVerificationToken: kode OTP 6 digit disimpan sebagai hash SHA-256
-- (bukan mentah, meniru PasswordResetToken), berlaku 15 menit, maks 5x
-- salah. Akun baru dibuat isActive=false sampai kode diverifikasi.
-- users.emailVerifiedAt: dicatat saat verifikasi berhasil (akun lama
-- yang sudah aktif tidak punya nilai ini).
-- WAJIB jalankan `npx prisma migrate deploy` + `npx prisma generate`
-- sebelum `npx tsc --noEmit` / `npm run build`.
CREATE TABLE "email_verification_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "otpHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_verification_tokens_otpHash_key" ON "email_verification_tokens"("otpHash");
CREATE INDEX "email_verification_tokens_userId_idx" ON "email_verification_tokens"("userId");

ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
