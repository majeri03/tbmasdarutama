import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";

const getAllowedOrigins = () => {
  const origins = [
    "https://masdarutama.tech",
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
  // benar-benar URL aplikasi sendiri (https + host masdarutama.tech).
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
// host masdarutama.tech (atau subdomainnya). Di development, http://localhost
// juga diterima. Nilai lain diabaikan diam-diam (fail-closed).
const isOwnAppUrl = (value: string | undefined): value is string => {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      (url.hostname === "masdarutama.tech" || url.hostname.endsWith(".masdarutama.tech"))
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

  // Redirect Dashboard Setelah Login
  if (path === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Redirect ke login jika belum login dan akses protected route 
  if (!isLoggedIn && path.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/api/:path*"],
};