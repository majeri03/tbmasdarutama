import crypto from "crypto";

// MOBILE_JWT_SECRET dipisah dari NEXTAUTH_SECRET agar konsisten di Vercel.
// Set di Vercel: Settings → Environment Variables → MOBILE_JWT_SECRET
// Harus SAMA persis antara lokal .env dan Vercel env vars.
const JWT_SECRET =
  process.env.MOBILE_JWT_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "masdarutama-secret-key-2024-super-secret";

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
