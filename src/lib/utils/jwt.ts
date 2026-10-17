import crypto from "crypto";

// MOBILE_JWT_SECRET dipisah dari NEXTAUTH_SECRET agar konsisten di Vercel.
// Set di Vercel: Settings → Environment Variables → MOBILE_JWT_SECRET
// Harus SAMA persis antara lokal .env dan Vercel env vars.
const getJwtSecret = (): string => {
  const secret = process.env.MOBILE_JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CRITICAL ERROR: MOBILE_JWT_SECRET atau NEXTAUTH_SECRET wajib dikonfigurasi di production!");
    }
    // Hanya untuk kenyamanan development lokal jika lupa set env, namun tetap diberi peringatan
    console.warn("WARNING: MOBILE_JWT_SECRET / NEXTAUTH_SECRET belum dikonfigurasi. Menggunakan fallback lokal sementara.");
    return "temp-dev-only-secret-do-not-use-in-production-123456789";
  }
  return secret;
};

const JWT_SECRET = getJwtSecret();

export type TokenPayload = {
  id: string;
  email: string;
  name: string;
  role: string;
  exp?: number;
};

/**
 * Signs a mobile auth token with HMAC-SHA256.
 * Valid for 30 days.
 */
export function signMobileToken(payload: Omit<TokenPayload, "exp">): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const data = Buffer.from(
    JSON.stringify({
      ...payload,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 hari
    })
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${data}`)
    .digest("base64url");

  return `${header}.${data}.${signature}`;
}

/**
 * Verifies and decodes a mobile auth token.
 */
export function verifyMobileToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, data, signature] = parts;
    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${header}.${data}`)
      .digest("base64url");

    if (signature !== expectedSignature) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(data, "base64url").toString("utf-8")) as TokenPayload;
    if (decoded.exp && Date.now() > decoded.exp) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}
