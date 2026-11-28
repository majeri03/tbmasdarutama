import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
  NEXTAUTH_SECRET: z.string().min(8, "NEXTAUTH_SECRET minimal harus 8 karakter"),
  MOBILE_JWT_SECRET: z.string().min(8, "MOBILE_JWT_SECRET minimal harus 8 karakter").optional(),
  // FIX (22 Nov 2026): secret cron untuk endpoint /api/notifications/
  // check-overdue — sebelumnya tidak divalidasi di schema sama sekali.
  NOTIFICATION_CRON_SECRET: z.string().min(8, "NOTIFICATION_CRON_SECRET minimal harus 8 karakter").optional(),
  // PKG-H (23 Nov 2026, cron Vercel): CRON_SECRET dibuat OTOMATIS oleh
  // Vercel saat cron terpasang (vercel.json) — tidak perlu diisi manual.
  // Endpoint check-overdue menerimanya lewat header
  // `Authorization: Bearer <CRON_SECRET>` karena Vercel Cron tidak bisa
  // mengirim header kustom.
  CRON_SECRET: z.string().min(8, "CRON_SECRET minimal harus 8 karakter").optional(),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL harus berupa URL valid").optional(),
  // SECURITY FIX (Nov 2026, M6): kunci bot sebelumnya tidak divalidasi sama
  // sekali, jadi ketiadaannya diam-diam mematikan auth (fail-open). Kunci
  // ini tetap opsional di schema agar aplikasi tidak crash saat boot, tapi
  // endpoint yang memakainya sekarang fail-closed (kunci hilang = ditolak).
  // Set BOT_API_KEY dan WA_BOT_API_KEY di hosting sebelum deploy patch ini.
  // WS-A (28 Nov 2026, API bot): WA_BOT_API_KEY minimal 32 karakter.
  // Tetap .optional() — belum diisi = boleh (endpoint bot fail-closed
  // sendiri kalau kunci env kosong), tapi kalau diisi kurang dari 32
  // karakter maka boot production gagal (fail-closed). PENTING: field
  // ini SEBELUMNYA tidak pernah dimasukkan ke safeParse di bawah, jadi
  // min(16) yang lama tidak pernah divalidasi sama sekali — sekarang
  // sudah dimasukkan ke input safeParse supaya validasinya benar jalan.
  // BOT_API_KEY (kunci lama lain) TIDAK diubah — bukan urusan WS-A.
  BOT_API_KEY: z.string().min(16, "BOT_API_KEY minimal 16 karakter").optional(),
  WA_BOT_API_KEY: z.string().min(32, "WA_BOT_API_KEY minimal 32 karakter").optional(),
  CLOUDFLARE_WORKER_URL: z.string().url("CLOUDFLARE_WORKER_URL harus berupa URL valid").optional(),
  // FIX (22 Nov 2026, R2): kredensial S3-compatible untuk listing objek R2
  // langsung (ListObjectsV2) saat rekonsiliasi. Saat ini TIDAK ADA di env —
  // Worker tidak punya endpoint /list dan kodenya tidak ada di repo, jadi
  // rekonsiliasi memakai daftar key hasil export dashboard/wrangler.
  // Isi dari dashboard Cloudflare (R2 -> Manage R2 API Tokens) kalau mau
  // listing langsung di masa depan; semuanya opsional.
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  // HAPUS (22 Nov 2026, pentest H7): fitur AI dihapus total atas permintaan
  // pemilik — kunci API AI tidak lagi dipakai di mana pun.
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const getParsedEnv = () => {
  const result = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    // FIX (22 Nov 2026): fallback MOBILE_JWT_SECRET || NEXTAUTH_SECRET
    // DIHAPUS. Fallback ini bertentangan dengan komentar di jwt.ts yang
    // menuntut secret terpisah — dan menyesatkan: env hasil parse ini
    // tidak dibaca siapa pun (jwt.ts membaca process.env langsung dan
    // sudah error keras kalau MOBILE_JWT_SECRET kosong), jadi fallback
    // itu hanya memberi kesan aman yang palsu. Sekarang hanya
    // MOBILE_JWT_SECRET yang dipakai.
    // (Minimum 8 karakter TIDAK dinaikkan — menaikkannya bisa memecahkan
    // deploy yang sudah jalan; secret yang lemah tetap harus diganti
    // manual di Vercel dengan yang panjang & acak.)
    MOBILE_JWT_SECRET: process.env.MOBILE_JWT_SECRET,
    NOTIFICATION_CRON_SECRET: process.env.NOTIFICATION_CRON_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    CLOUDFLARE_WORKER_URL: process.env.CLOUDFLARE_WORKER_URL,
    // WS-A (28 Nov 2026): WA_BOT_API_KEY WAJIB ada di input safeParse —
    // sebelumnya field ini hanya ada di schema tapi tidak pernah
    // divalidasi (lihat komentar di schema di atas). BOT_API_KEY
    // sengaja tidak ditambahkan (bukan urusan WS-A).
    WA_BOT_API_KEY: process.env.WA_BOT_API_KEY,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (!result.success) {
    // Di development, hanya print warning agar tsc/lint/build lokal tidak crash jika env belum diisi lengkap
    if (process.env.NODE_ENV !== "production") {
      console.warn("⚠️ [ENV WARNING] Konfigurasi environment belum lengkap atau tidak valid:", result.error.format());
      return process.env as unknown as z.infer<typeof envSchema>;
    }
    
    // Di production, lempar error keras untuk mencegah bypass keamanan
    console.error("❌ [ENV CRITICAL ERROR] Konfigurasi environment tidak valid untuk PRODUCTION:", result.error.format());
    throw new Error("Konfigurasi environment tidak valid untuk production.");
  }

  // PERINGATAN (22 Nov 2026, pentest M9/L-4): secret di bawah 32 karakter
  // masih DIIZINKAN (bukan hard-fail) — panjang secret produksi saat ini
  // tidak diketahui, dan hard-fail bisa mematikan aplikasi saat deploy.
  // Tapi secret pendek (apalagi 8 karakter) bisa di-brute-force offline
  // kalau satu token bocor. PEMILIK WAJIB mengganti ketiganya di Vercel
  // dengan string acak minimal 32 karakter; setelah itu minimum di schema
  // di atas bisa dinaikkan ke 32.
  const shortSecretNames: Array<[string, string | undefined]> = [
    ["NEXTAUTH_SECRET", result.data.NEXTAUTH_SECRET],
    ["MOBILE_JWT_SECRET", result.data.MOBILE_JWT_SECRET],
    ["NOTIFICATION_CRON_SECRET", result.data.NOTIFICATION_CRON_SECRET],
    ["CRON_SECRET", result.data.CRON_SECRET],
  ];
  for (const [name, value] of shortSecretNames) {
    if (value && value.length < 32) {
      console.warn(
        `⚠️ [ENV WARNING] ${name} hanya ${value.length} karakter — ganti dengan string acak minimal 32 karakter di Vercel (Settings → Environment Variables).`
      );
    }
  }

  return result.data;
};

export const env = getParsedEnv();
