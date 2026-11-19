import crypto from "crypto";

// MOBILE_JWT_SECRET dipisah dari NEXTAUTH_SECRET agar konsisten di Vercel.
// Set di Vercel: Settings → Environment Variables → MOBILE_JWT_SECRET
// Harus SAMA persis antara lokal .env dan Vercel env vars.
//
// SECURITY FIX (Nov 2026, C4): fallback string hardcoded sebelumnya dihapus.
// Dulu, kalau MOBILE_JWT_SECRET dan NEXTAUTH_SECRET tidak di-set, fungsi ini
// mengembalikan "temp-dev-only-secret-..." yang tertulis di repo — siapa pun
// yang membaca repo bisa memalsukan token SUPER_ADMIN di environment
// non-production. Sekarang: secret tidak ada = error keras di SEMUA
// environment. Jangan tambahkan fallback apa pun di sini.
// Catatan deploy: pastikan MOBILE_JWT_SECRET sudah di-set SEBELUM deploy ini,
// kalau tidak login mobile akan gagal dengan error di atas (sengaja).
const getJwtSecret = (): string => {
  const secret = process.env.MOBILE_JWT_SECRET;
  if (!secret) {
    throw new Error("CRITICAL ERROR: MOBILE_JWT_SECRET wajib dikonfigurasi. Jangan pakai fallback.");
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

    // SECURITY FIX (Nov 2026, L2): validasi alg dan bandingkan signature
    // dengan timingSafeEqual, bukan perbandingan string biasa.
    let headerObj: { alg?: string };
    try {
      headerObj = JSON.parse(Buffer.from(header, "base64url").toString("utf-8")) as { alg?: string };
    } catch {
      return null;
    }
    if (headerObj.alg !== "HS256") return null;

    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${header}.${data}`)
      .digest("base64url");
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
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
