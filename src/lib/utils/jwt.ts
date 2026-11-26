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
//
// EDGE RUNTIME FIX (Nov 2026): Diganti dari Node.js `crypto` module ke
// Web Crypto API (globalThis.crypto / SubtleCrypto) agar kompatibel dengan
// Next.js Edge Runtime (middleware). Buffer.from base64url tetap aman di Edge.

const getJwtSecret = (): string => {
  const secret = process.env.MOBILE_JWT_SECRET;
  if (!secret) {
    throw new Error("CRITICAL ERROR: MOBILE_JWT_SECRET wajib dikonfigurasi. Jangan pakai fallback.");
  }
  return secret;
};

export type TokenPayload = {
  id: string;
  email: string;
  name: string;
  role: string;
  /** URL foto profil (R2, folder "avatars") — null kalau belum ada. */
  avatarUrl?: string | null;
  /** Versi token (lihat User.tokenVersion). Naik tiap ganti password /
   *  nonaktifkan akun / ganti role / logout — token lama langsung mati. */
  tv?: number;
  exp?: number;
};

// --- helpers Web Crypto (Edge-safe) ---

function base64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(s.length + ((4 - (s.length % 4)) % 4), "=");
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(message));
  return base64urlEncode(sig);
}

async function hmacVerify(secret: string, message: string, signature: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const sigBytes = base64urlDecode(signature);
  return globalThis.crypto.subtle.verify("HMAC", key, sigBytes.buffer as ArrayBuffer, enc.encode(message));
}

/**
 * Signs a mobile auth token with HMAC-SHA256.
 * Valid for 30 days.
 */
export async function signMobileToken(payload: Omit<TokenPayload, "exp">): Promise<string> {
  const secret = getJwtSecret();
  const header = base64urlEncode(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const data = base64urlEncode(
    new TextEncoder().encode(
      JSON.stringify({
        ...payload,
        exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 hari
      })
    )
  );

  const signature = await hmacSign(secret, `${header}.${data}`);
  return `${header}.${data}.${signature}`;
}

/**
 * Verifies and decodes a mobile auth token.
 *
 * SECURITY FIX (22 Nov 2026): dulu hanya cek signature + expiry — token
 * akun yang dinonaktifkan atau token yang dicuri tetap berlaku sampai 30
 * hari. Sekarang token juga dicek ke database: user harus ada, aktif,
 * role-nya sama dengan payload, dan `tv` sama dengan User.tokenVersion.
 * Ganti password / nonaktifkan akun / ganti role / logout menaikkan
 * tokenVersion, jadi semua token lama langsung ditolak.
 *
 * Catatan: prisma di-import dinamis di sini (bukan import statis di atas)
 * supaya file ini tetap aman di-import dari Edge Runtime — Prisma Client
 * hanya bisa jalan di Node, dan modul ini sebelumnya memang dirancang
 * Edge-safe. Kalau import dinamis ini gagal, token ditolak (fail-closed).
 */
export async function verifyMobileToken(token: string): Promise<TokenPayload | null> {
  try {
    const secret = getJwtSecret();
    const parts = token.split(".");
    if (parts.length !== 3) {
      console.warn("[MOBILE_TOKEN_REJECT] bad_format");
      return null;
    }

    const [header, data, signature] = parts;

    // SECURITY FIX (Nov 2026, L2): validasi alg dan bandingkan signature
    // dengan Web Crypto (constant-time di engine level).
    let headerObj: { alg?: string };
    try {
      headerObj = JSON.parse(new TextDecoder().decode(base64urlDecode(header))) as { alg?: string };
    } catch {
      console.warn("[MOBILE_TOKEN_REJECT] bad_header");
      return null;
    }
    if (headerObj.alg !== "HS256") {
      console.warn("[MOBILE_TOKEN_REJECT] bad_alg", headerObj.alg);
      return null;
    }

    const valid = await hmacVerify(secret, `${header}.${data}`, signature);
    if (!valid) {
      console.warn("[MOBILE_TOKEN_REJECT] bad_signature");
      return null;
    }

    const decoded = JSON.parse(new TextDecoder().decode(base64urlDecode(data))) as TokenPayload;
    if (decoded.exp && Date.now() > decoded.exp) {
      console.warn("[MOBILE_TOKEN_REJECT] expired", { id: decoded.id });
      return null;
    }

    // Cek ke database: user harus ada + aktif + role sama + tv sama.
    // SECURITY FIX (22 Nov 2026, pentest L-3): token TANPA klaim tv
    // (terbit sebelum patch 22 Nov) SEKARANG DITOLAK. Sebelumnya token
    // lama tanpa tv dianggap tv=0 dan tetap berlaku selama tokenVersion
    // user masih 0 — jendela token curian pra-patch. Token yang diterbitkan
    // login mobile saat ini selalu membawa tv (lihat login/route.ts).
    const { default: prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { isActive: true, role: true, tokenVersion: true, avatarUrl: true },
    });
    if (!user) {
      console.warn("[MOBILE_TOKEN_REJECT] no_user", { id: decoded.id });
      return null;
    }
    if (!user.isActive) {
      console.warn("[MOBILE_TOKEN_REJECT] inactive", { id: decoded.id });
      return null;
    }
    if (user.role !== decoded.role) {
      console.warn("[MOBILE_TOKEN_REJECT] role_mismatch", {
        id: decoded.id,
        tokenRole: decoded.role,
        dbRole: user.role,
      });
      return null;
    }
    if (decoded.tv === undefined || decoded.tv !== user.tokenVersion) {
      console.warn("[MOBILE_TOKEN_REJECT] tv_mismatch", {
        id: decoded.id,
        tokenTv: decoded.tv,
        dbTv: user.tokenVersion,
      });
      return null;
    }

    console.log("[MOBILE_TOKEN_OK]", { id: decoded.id, tv: decoded.tv });
    // WS-9 (26 Nov 2026): avatar selalu dibaca dari DB, bukan dari klaim
    // token — token lama (terbit sebelum patch ini) tidak punya klaim
    // avatarUrl, dan foto yang baru diganti langsung terbaca tanpa
    // login ulang di APK.
    decoded.avatarUrl = user.avatarUrl ?? null;
    return decoded;
  } catch (error) {
    console.warn(
      "[MOBILE_TOKEN_REJECT] exception",
      error instanceof Error ? error.message : "unknown"
    );
    return null;
  }
}
