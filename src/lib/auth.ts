import NextAuth, { CredentialsSignin } from "next-auth";
import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import {
  getClientIp,
  isRateLimited,
  recordRateLimitHit,
  clearRateLimit,
} from "@/lib/utils/rate-limit";
import { verifyTurnstileToken } from "@/lib/utils/turnstile";
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      email: string;
      name: string;
    };
  }

  interface User {
    id: string;
    role: string;
    tokenVersion?: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: string;
    /** Nama & email akun — supaya halaman Profil Akun bisa menampilkannya
     *  tanpa query tambahan (sebelumnya tidak pernah masuk ke token/sesi). */
    name?: string | null;
    email?: string | null;
    /** Versi token (lihat User.tokenVersion). Naik tiap logout / ganti
     *  password / nonaktifkan akun / ganti role — token lama langsung mati. */
    tv?: number;
  }
}
// Rate-limit login web (dashboard) — samakan dengan login mobile:
// 5x gagal per IP+email dalam 15 menit, lalu tolak 15 menit.
// HARDENING (24 Nov 2026): batas diperketat dari 10x menjadi 5x, dan
// ditambah batas AGREGAT per IP (30x/15 menit, semua email) — tanpa ini
// penyerang bisa memutar banyak email (tiap email 5x) dari satu IP tanpa
// pernah kena batas per-email.
// SECURITY FIX (22 Nov 2026, pentest M28 + M12/L-1): hitungan pindah dari
// Map in-memory per instance ke tabel rate_limits di DB (berlaku
// antar-instance serverless), dan kunci sekarang ip:email — sebelumnya
// kunci email saja, jadi penyerang bisa mengunci akun korban (termasuk
// SUPER_ADMIN) selama 15 menit tanpa perlu tahu password.
const WEB_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const WEB_LOGIN_MAX_FAILED = 5;
const WEB_LOGIN_IP_MAX_FAILED = 30;

// FIX (24 Nov 2026, OTP): akun yang belum terverifikasi ditolak login
// dengan kode yang bisa dibedakan dari password salah — supaya halaman
// login bisa menampilkan pesan "Akun belum terverifikasi" + tombol ke
// /verify-email (tempat memasukkan kode OTP).
// Auth.js v5 TIDAK meneruskan pesan Error biasa ke client (sampainya
// hanya "Configuration"); yang diteruskan hanyalah subclass
// CredentialsSignin lewat properti `code` (dibaca LoginForm dari
// result.code — diverifikasi dari source next-auth 5.0.0-beta.30).
// Kode ini HANYA dilempar kalau passwordnya BENAR (lihat authorize di
// bawah), jadi tidak membocorkan status akun ke orang yang tidak tahu
// password.
class UnverifiedAccountError extends CredentialsSignin {
  code = "unverified";
}

// HARDENING (24 Nov 2026): cek bot Turnstile gagal — pola yang sama
// seperti UnverifiedAccountError supaya LoginForm bisa menampilkan pesan
// yang benar (result.code === "turnstile"), bukan pesan generik.
class TurnstileFailedError extends CredentialsSignin {
  code = "turnstile";
}

export const authConfig: NextAuthConfig = {
  // WS-A (25 Nov 2026): trustHost:true membuat Auth.js memakai host
  // request untuk URL absolutnya. TAPI kalau env AUTH_URL /
  // NEXTAUTH_URL di Vercel masih berisi domain lama
  // (https://masdarutama.tech), env itu yang dipakai Auth.js untuk
  // redirect signIn/signOut dan untuk baseUrl next-auth/react — dan
  // TIDAK ADA kode yang bisa menimpa env dari dalam aplikasi. Jadi:
  // ganti AUTH_URL dan NEXTAUTH_URL di Vercel ke
  // https://tbmasdarutama.vercel.app lalu redeploy (lihat NOTES WS-A).
  // Jangan "memperbaiki" ini dengan hardcode domain di kode.
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        // HARDENING (24 Nov 2026): token Turnstile dari widget di LoginForm.
        // Hanya dipakai login WEB — login mobile (APK) tidak lewat sini.
        turnstileToken: { label: "Turnstile", type: "text" },
      },
      async authorize(credentials) {
        // SECURITY FIX (22 Nov 2026, pentest L8 API): validasi tipe dulu —
        // credentials non-string sebelumnya bisa membuat .toLowerCase() /
        // bcrypt.compare melempar dan berakhir 500.
        if (
          !credentials ||
          typeof credentials.email !== "string" ||
          typeof credentials.password !== "string" ||
          !credentials.email ||
          !credentials.password
        ) {
          throw new Error("Email atau password salah");
        }

        // SECURITY FIX (22 Nov 2026, pentest M12 API): email dinormalisasi
        // sebelum dipakai — sebelumnya where memakai email mentah, jadi
        // akun yang sama bisa gagal login web karena kapitalisasi, padahal
        // login mobile menormalisasi.
        const email = credentials.email.toLowerCase().trim();
        const password = credentials.password;

        // Kunci rate limit ip:email (IP = elemen terakhir X-Forwarded-For).
        // headers() bisa gagal di luar konteks request — kalau gagal, pakai
        // kunci email saja (perilaku lama, tetap lebih baik daripada tanpa
        // rate limit).
        let ip = "unknown";
        try {
          ip = getClientIp(await headers());
        } catch {
          // Di luar konteks request — pakai "unknown".
        }
        const rateKey = `${ip}:${email}`;
        // HARDENING (24 Nov 2026): cek bot Turnstile untuk login WEB,
        // SEBELUM cek rate limit / password. Kalau kunci Turnstile belum
        // diisi, verifikasi dilewati (fail open). Kalau kunci sudah diisi
        // tapi token kosong/tidak valid, tolak dengan kode "turnstile"
        // supaya LoginForm menampilkan pesan yang benar. Login mobile
        // (APK, /api/auth/login) TIDAK memakai cek ini.
        const turnstileOk = await verifyTurnstileToken(
          typeof credentials.turnstileToken === "string"
            ? credentials.turnstileToken
            : undefined,
          ip
        );
        if (!turnstileOk) {
          throw new TurnstileFailedError();
        }
        if (await isRateLimited(rateKey, WEB_LOGIN_MAX_FAILED, WEB_LOGIN_WINDOW_MS)) {
          throw new Error("Terlalu banyak percobaan login. Coba lagi 15 menit lagi.");
        }
        // HARDENING (24 Nov 2026): batas agregat per IP — dihitung untuk
        // SETIAP percobaan login (berhasil/gagal) dari IP ini, semua email.
        // 30x/15 menit sangat longgar untuk pemakaian normal.
        const ipRateKey = `login-ip:${ip}`;
        if (await isRateLimited(ipRateKey, WEB_LOGIN_IP_MAX_FAILED, WEB_LOGIN_WINDOW_MS)) {
          throw new Error("Terlalu banyak percobaan login. Coba lagi 15 menit lagi.");
        }
        await recordRateLimitHit(ipRateKey, WEB_LOGIN_WINDOW_MS);

        const user = await prisma.user.findUnique({
          where: { email },
        });

        // SECURITY FIX (22 Nov 2026, pentest M12/L-7): satu pesan generik
        // untuk email tidak terdaftar DAN password salah — sebelumnya
        // "Email tidak ditemukan atau akun tidak aktif" vs "Password
        // salah" membocorkan email mana yang terdaftar.
        if (!user) {
          await recordRateLimitHit(rateKey, WEB_LOGIN_WINDOW_MS);
          throw new Error("Email atau password salah");
        }

        const isPasswordValid = await bcrypt.compare(
          password,
          user.password
        );

        if (!isPasswordValid) {
          await recordRateLimitHit(rateKey, WEB_LOGIN_WINDOW_MS);
          throw new Error("Email atau password salah");
        }

        // FIX (24 Nov 2026, OTP): password BENAR tapi akun belum aktif.
        // - Email BELUM terverifikasi (emailVerifiedAt null) -> tolak
        //   dengan kode "unverified" supaya halaman login menampilkan
        //   pesan + tombol ke /verify-email. Kode ini hanya sampai ke
        //   orang yang sudah tahu password yang benar (trade-off ini
        //   diminta user: tanpa pembedaan ini, pemilik akun tidak tahu
        //   harus memasukkan OTP di mana).
        // - Email SUDAH terverifikasi tapi akun dinonaktifkan admin ->
        //   tetap pesan generik seperti password salah.
        if (!user.isActive) {
          await recordRateLimitHit(rateKey, WEB_LOGIN_WINDOW_MS);
          if (!user.emailVerifiedAt) {
            throw new UnverifiedAccountError();
          }
          throw new Error("Email atau password salah");
        }

        await clearRateLimit(rateKey);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Login baru: simpan tv = tokenVersion saat ini ke dalam klaim token.
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.name = user.name ?? undefined;
        token.email = user.email ?? undefined;
        token.tv = (user as { tokenVersion?: number }).tokenVersion;
        return token;
      }

      // SECURITY FIX (22 Nov 2026, pentest H1): sesi web SEKARANG BISA
      // DICABUT — pola yang sama seperti verifyMobileToken.
      // - Token TANPA klaim tv (terbit sebelum patch ini) langsung ditolak.
      //   Akibatnya: SEMUA sesi web lama mati saat deploy patch ini dan
      //   semua user harus login ulang sekali.
      // - User harus ada di DB, aktif, dan tv-nya sama dengan tokenVersion
      //   di DB. Logout / ganti password / nonaktifkan akun / ganti role
      //   menaikkan tokenVersion, jadi semua sesi web lama langsung mati.
      if (!token.id || typeof token.tv !== "number") {
        return null;
      }
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { name: true, email: true, role: true, isActive: true, tokenVersion: true },
        });
        if (!dbUser || !dbUser.isActive) return null;
        if (dbUser.tokenVersion !== token.tv) return null;
        token.role = dbUser.role;
        // Isi ulang nama/email dari DB — mengisi token lama (terbit sebelum
        // patch ini) yang belum punya klaim nama/email.
        token.name = dbUser.name ?? undefined;
        token.email = dbUser.email ?? undefined;
        return token;
      } catch (error) {
        // Query DB gagal (mis. konteks runtime tanpa akses DB) — JANGAN
        // kunci semua user keluar: biarkan token lolos di sini. Penegakan
        // penuh tetap terjadi di route handler / server action (Node)
        // yang memanggil auth(), karena callback ini jalan lagi di sana
        // dengan akses DB normal.
        // WS-A (25 Nov 2026): fail-open ini SENGAJA dan load-bearing —
        // middleware jalan di Edge Runtime dan SELALU masuk cabang ini,
        // jadi req.auth di middleware TIDAK BISA membedakan sesi valid
        // dari sesi yang tokenVersion-nya sudah dicabut. Karena itu
        // middleware TIDAK BOLEH memutuskan redirect /login →
        // /dashboard (keputusan itu hanya di halaman /login, runtime
        // Node). Jangan ubah cabang ini menjadi fail-closed tanpa
        // memindahkan seluruh logika auth middleware.
        console.error("Error validating web session in jwt callback:", error);
        return token;
      }
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.name = (token.name as string | undefined) ?? "";
        session.user.email = (token.email as string | undefined) ?? "";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const nextAuthInstance = NextAuth(authConfig);
export const { handlers, signIn, signOut } = nextAuthInstance;

/**
 * Enhanced auth() helper:
 * 1. Supports NextAuth middleware when called with a callback: auth((req) => ...)
 * 2. In Server Components, Server Actions, and Route Handlers:
 *    - First checks standard NextAuth web session
 *    - If null, checks Authorization Bearer header or authjs.session-token cookie
 *      and validates mobile JWT token via verifyMobileToken()
 */
export const auth: typeof nextAuthInstance.auth = ((...args: any[]) => {
  // If called as middleware wrapper (function argument)
  if (typeof args[0] === "function") {
    return (nextAuthInstance.auth as any)(...args);
  }

  // If called directly: await auth()
  return (async () => {
    try {
      const session = await (nextAuthInstance.auth as any)();
      if (session?.user?.id) {
        if (session.user.role) {
          session.user.role = session.user.role.toUpperCase();
        }
        return session;
      }
    } catch {
      // Standard NextAuth failed or not present
    }

    try {
      const { headers } = await import("next/headers");
      const reqHeaders = await headers();
      let token: string | null = null;

      const authHeader = reqHeaders.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      }

      if (!token) {
        const cookieHeader = reqHeaders.get("cookie");
        if (cookieHeader) {
          const match = cookieHeader.match(/(?:__Secure-)?authjs\.session-token=([^;]+)/);
          if (match) token = match[1];
        }
      }

      if (token) {
        const { verifyMobileToken } = await import("@/lib/utils/jwt");
        const payload = await verifyMobileToken(token);
        if (payload) {
          return {
            user: {
              id: payload.id,
              email: payload.email,
              name: payload.name,
              role: (payload.role || "KASIR").toUpperCase(),
            },
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          } as any;
        }
      }
    } catch {
      // headers() context not available or error occurred
    }

    return null;
  })();
}) as any;

export const getCurrentUser = async () => {
  const session = await auth();
  return session?.user;
};