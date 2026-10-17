import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
  NEXTAUTH_SECRET: z.string().min(8, "NEXTAUTH_SECRET minimal harus 8 karakter"),
  MOBILE_JWT_SECRET: z.string().min(8, "MOBILE_JWT_SECRET minimal harus 8 karakter").optional(),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL harus berupa URL valid").optional(),
  CLOUDFLARE_WORKER_URL: z.string().url("CLOUDFLARE_WORKER_URL harus berupa URL valid").optional(),
  GROQ_API_KEYS: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const getParsedEnv = () => {
  const result = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    MOBILE_JWT_SECRET: process.env.MOBILE_JWT_SECRET || process.env.NEXTAUTH_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    CLOUDFLARE_WORKER_URL: process.env.CLOUDFLARE_WORKER_URL,
    GROQ_API_KEYS: process.env.GROQ_API_KEYS,
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

  return result.data;
};

export const env = getParsedEnv();
