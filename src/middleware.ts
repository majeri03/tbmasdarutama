import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";

const getAllowedOrigins = () => {
  const origins = [
    // PKG-J (23 Nov 2026, migrasi domain): domain lama masih diterima
    // selama masa transisi. Hapus baris masdarutama.tech setelah domain
    // lama mati/expired — domain baru sudah cukup.
    "https://masdarutama.tech",
    "https://tbmasdarutama.vercel.app",
    // Origin aplikasi Capacitor (APK) — bukan http, jadi aman di produksi.
    "capacitor://localhost",
  ];
  // FIX (22 Nov 2026): http://localhost HANYA di development. Sebelumnya
  // diizinkan tanpa syarat di produksi juga — situs web mana pun yang jalan
  // di localhost (mis. lewat terowongan/redirect) bisa memanggil API dengan
  // kredensial. "http://localhost:3000" di bawah memang sudah dev-only.
  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost");
  }
  // Pentest fix (Nov 2026): NEXT_PUBLIC_APP_URL hanya diterima kalau
  // benar-benar URL aplikasi sendiri (https + host masdarutama.tech atau
  // tbmasdarutama.vercel.app — lihat isOwnAppUrl di bawah).
  // Sebelumnya nilai apa pun dari env langsung masuk daftar izin — satu
  // salah ketik di Vercel bisa membuka CORS berkredensial ke domain penyerang.
  if (isOwnAppUrl(process.env.NEXT_PUBLIC_APP_URL)) {
    origins.push(process.env.NEXT_PUBLIC_APP_URL as string);
  } else if (process.env.NODE_ENV === "development") {
    origins.push("http://localhost:3000");
  }
  return origins;
};

// Pentest fix (Nov 2026): validasi NEXT_PUBLIC_APP_URL — hanya https +
// host masdarutama.tech atau tbmasdarutama.vercel.app (atau subdomainnya).
// Di development, http://localhost juga diterima. Nilai lain diabaikan
// diam-diam (fail-closed).
// PKG-J (23 Nov 2026, migrasi domain): domain lama (masdarutama.tech,
// gratisan, mau expired) masih diterima selama masa transisi supaya
// deploy lama + baru sama-sama jalan. Setelah domain lama mati, hapus
// cabang masdarutama.tech di bawah — domain baru sudah cukup.
const isOwnAppUrl = (value: string | undefined): value is string => {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      (url.hostname === "masdarutama.tech" ||
        url.hostname.endsWith(".masdarutama.tech") ||
        url.hostname === "tbmasdarutama.vercel.app" ||
        url.hostname.endsWith(".tbmasdarutama.vercel.app"))
    ) {
      return true;
    }
    if (
      process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Nama cookie sesi Auth.js v5 — di https namanya
// "__Secure-authjs.session-token", di http "authjs.session-token".
const SESSION_COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
] as const;

// FIX (25 Nov 2026, WS-A, batch 1a): hapus cookie sesi yang masih
// dikirim browser padahal sesi sudah TIDAK valid menurut middleware
// (req.auth null) — mis. token kedaluwarsa, tidak bisa didekripsi, atau
// token lawas tanpa klaim tv. Hanya dipanggil kalau req.auth null:
// sesi yang masih terlihat valid di edge TIDAK disentuh, karena edge
// tidak bisa membedakan sesi valid dari sesi yang tokenVersion-nya
// sudah dicabut (cek tv di DB hanya jalan di runtime Node — lihat
// callback jwt di src/lib/auth.ts). Menghapus cookie sesi yang
// terlihat valid akan mengeluarkan user yang sebenarnya masih login.
// Sesi basi yang lolos edge (tv dicabut) dibersihkan di halaman /login
// lewat GET /api/auth/logout (lihat src/app/login/page.tsx).
const clearStaleSessionCookies = (
  req: NextRequest,
  response: NextResponse
): void => {
  const hasStaleCookie = SESSION_COOKIE_NAMES.some((name) =>
    req.cookies.has(name)
  );
  if (!hasStaleCookie) return;
  for (const name of SESSION_COOKIE_NAMES) {
    response.cookies.delete(name);
  }
};

// Pentest fix (Nov 2026, CSRF): mutasi /api dari origin browser yang tidak
// dikenal ditolak. Request TANPA header Origin (APK native, server-to-server,
// curl, cron Vercel) tetap lolos — yang dicegah adalah situs jahat yang
// memancing browser korban mengirim form/fetch lintas situs dengan cookie.
// Kalau Origin tidak ada tapi Referer ada dan lintas situs, ikut ditolak.
const isCrossSiteMutation = (req: NextRequest): boolean => {
  if (!MUTATION_METHODS.has(req.method)) return false;
  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.get("origin");
  if (origin) return !allowedOrigins.includes(origin);
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return !allowedOrigins.includes(new URL(referer).origin);
    } catch {
      return false;
    }
  }
  return false;
};

export default auth((req: NextRequest & { auth: Session | null }) => {
  // 1. CORS Configuration for API Routes (Mobile / Cross-Origin compatibility)
  if (req.nextUrl.pathname.startsWith("/api")) {
    const origin = req.headers.get("origin") || "";
    const allowedOrigins = getAllowedOrigins();
    const isAllowed = allowedOrigins.includes(origin);
    
    // Handle preflight OPTIONS request
    if (req.method === "OPTIONS") {
      const response = new NextResponse(null, { status: 200 });
      
      response.headers.set("Access-Control-Allow-Credentials", isAllowed ? "true" : "false");
      response.headers.set("Access-Control-Allow-Origin", isAllowed ? origin : allowedOrigins[0]);
      response.headers.set("Access-Control-Allow-Methods", "GET,DELETE,PATCH,POST,PUT,OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Cookie, Authorization");
      response.headers.set("Access-Control-Expose-Headers", "Set-Cookie");
      return response;
    }

    // Pentest fix (Nov 2026, CSRF): tolak mutasi /api dari origin yang tidak
    // dikenal (lihat isCrossSiteMutation di atas). Ditempatkan setelah
    // preflight OPTIONS supaya CORS preflight tetap dijawab.
    if (isCrossSiteMutation(req)) {
      return NextResponse.json(
        { success: false, error: "Origin tidak diizinkan." },
        { status: 403 }
      );
    }

    // Map Authorization Bearer to Cookie for API routes
    const requestHeaders = new Headers(req.headers);
    const authHeader = requestHeaders.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const cookiePrefix = req.nextUrl.protocol === "https:" ? "__Secure-" : "";
      const cookieName = `${cookiePrefix}authjs.session-token`;
      const existingCookie = requestHeaders.get("Cookie") || "";
      if (existingCookie) {
        requestHeaders.set("Cookie", `${cookieName}=${token}; ${existingCookie}`);
      } else {
        requestHeaders.set("Cookie", `${cookieName}=${token}`);
      }
    }

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      }
    });

    response.headers.set("Access-Control-Allow-Credentials", isAllowed ? "true" : "false");
    response.headers.set("Access-Control-Allow-Origin", isAllowed ? origin : allowedOrigins[0]);
    response.headers.set("Access-Control-Allow-Methods", "GET,DELETE,PATCH,POST,PUT,OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Cookie, Authorization");
    response.headers.set("Access-Control-Expose-Headers", "Set-Cookie");

    return response;
  }

  const isLoggedIn = !!req.auth;
  const path = req.nextUrl.pathname;

  // FIX (25 Nov 2026, WS-A, batch 1a): /login TIDAK LAGI memantul ke
  // /dashboard dari middleware. Middleware jalan di Edge Runtime dan
  // TIDAK BISA menjalankan cek tokenVersion di DB (Prisma melempar di
  // edge; callback jwt di src/lib/auth.ts sengaja fail-open di sana),
  // jadi sesi basi / sudah dicabut tetap terlihat "login" di sini.
  // Dulu: /login dengan cookie basi memantul ke /dashboard, lalu
  // auth() di Server Component (Node, cek DB penuh) menolak dan
  // redirect balik ke /login → loop. Keputusan "sudah login" sekarang
  // hanya diambil halaman /login sendiri (src/app/login/page.tsx,
  // runtime Node, auth() penuh). Middleware di sini hanya
  // membersihkan cookie sesi yang SUDAH TERBUKTI tidak valid di edge
  // (req.auth null) supaya browser berhenti mengirimnya.
  if (path === "/login") {
    if (!isLoggedIn) {
      const response = NextResponse.next();
      clearStaleSessionCookies(req, response);
      return response;
    }
    return NextResponse.next();
  }

  // Redirect ke login jika belum login dan akses protected route.
  // URL dibangun dari req.url (host request) — JANGAN hardcode domain
  // di sini. Redirect /dashboard tanpa login yang dulu mendarat di
  // https://masdarutama.tech/login TIDAK berasal dari baris ini
  // (baris ini selalu memakai host request); sumber domain lama adalah
  // env AUTH_URL / NEXTAUTH_URL di Vercel yang dipakai Auth.js untuk
  // redirect-nya sendiri (lihat NOTES WS-A + src/app/api/auth/
  // [...nextauth]/route.ts). Cookie sesi basi ikut dibersihkan pada
  // respons redirect ini supaya tidak kembali ke /login.
  if (!isLoggedIn && path.startsWith("/dashboard")) {
    const response = NextResponse.redirect(new URL("/login", req.url));
    clearStaleSessionCookies(req, response);
    return response;
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/api/:path*"],
};