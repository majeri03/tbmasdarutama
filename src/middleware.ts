import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";

const getAllowedOrigins = () => {
  const origins = [
    "https://masdarutama.tech",
    "capacitor://localhost",
    "http://localhost"
  ];
  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.push(process.env.NEXT_PUBLIC_APP_URL);
  } else if (process.env.NODE_ENV === "development") {
    origins.push("http://localhost:3000");
  }
  return origins;
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