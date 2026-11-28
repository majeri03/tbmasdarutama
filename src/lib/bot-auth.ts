/**
 * WS-A (28 Nov 2026) — fondasi auth API bot /api/bot/*.
 *
 * API bot memakai kunci API sendiri (header X-Bot-Key: WA_BOT_API_KEY),
 * BUKAN login user / getAuthenticatedUser(). Route lama /api/* tidak
 * disentuh — helper di file ini hanya dipakai route di bawah /api/bot/*.
 *
 * Prinsip keamanan file ini:
 * - Fail-closed: kunci env belum diisi ATAU header kosong/salah -> 401.
 *   Satu pesan generik untuk semua kasus 401 (jangan bocorkan alasan).
 * - Perbandingan kunci constant-time: kedua sisi di-hash SHA-256 dulu
 *   (supaya panjang selalu sama — crypto.timingSafeEqual melempar kalau
 *   panjang buffer beda), baru dibandingkan dengan timingSafeEqual.
 * - Kunci mentah TIDAK PERNAH disimpan: rate limit memakai
 *   'bot:' + sha256Hex(kunci), audit log tidak pernah mencatat kunci.
 * - HTTPS-only di production (lihat isHttpsRequest).
 * - sanitizeBotError: pesan Prisma/SQL/stack trace TIDAK PERNAH keluar
 *   ke client — selalu pesan generik; detail hanya console.error server.
 *
 * File lib biasa (TANPA "use server") — file "use server" hanya boleh
 * export fungsi async, sedangkan file ini juga export konstanta & tipe.
 */
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/** Level bot: 1 = penuh, 2 = buat transaksi, 3 = baca saja. */
export type BotLevel = 1 | 2 | 3;

/** Batas rate limit bot: 60 request/menit per kunci (lihat checkBotRateLimit). */
export const BOT_RATE_LIMIT_MAX_PER_MINUTE = 60;
export const BOT_RATE_LIMIT_WINDOW_MS = 60_000;

/** Satu-satunya pesan 401 — dipakai untuk SEMUA kasus gagal auth. */
export const BOT_UNAUTHORIZED_MESSAGE = "Kunci API bot tidak valid.";
/** Pesan 429 rate limit. */
export const BOT_RATE_LIMITED_MESSAGE =
  "Terlalu banyak permintaan. Coba lagi sebentar lagi.";

/** Pesan 403 sopan (Bahasa Indonesia) sesuai level pemanggil. */
export function botForbiddenMessage(level: number | null): string {
  if (level === 3) {
    return "Maaf, akun ini hanya bisa melihat, tidak bisa mengubah data.";
  }
  return "Maaf, level akun ini tidak diizinkan untuk aksi ini.";
}

// ---------------------------------------------------------------------------
// Util internal
// ---------------------------------------------------------------------------

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Bandingkan dua string secara constant-time.
 * Kedua sisi di-hash SHA-256 dulu sehingga buffer yang dibandingkan
 * selalu 32 byte — timingSafeEqual melempar kalau panjangnya beda,
 * dan hash menutupi panjang kunci aslinya.
 */
function timingSafeEqualString(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a, "utf8").digest();
  const hashB = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * HTTPS-only di production: tolak request yang header x-forwarded-proto-nya
 * ada dan bukan 'https'. Di luar production (dev/test lokal Jery) jangan
 * ditolak. Header tidak ada -> lolos (mis. akses langsung tanpa proxy).
 */
function isHttpsRequest(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const proto = request.headers.get("x-forwarded-proto");
  if (proto && proto.trim().toLowerCase() !== "https") return false;
  return true;
}

/**
 * Rate limit 60/menit per kunci, pakai ulang model RateLimit yang sudah
 * ada (tabel rate_limits, migrasi 20261122230000_rate_limit) — sama
 * seperti src/lib/utils/rate-limit.ts, tapi kuncinya hash kunci API
 * ('bot:' + sha256Hex(kunci)), BUKAN kunci mentah dan bukan IP.
 *
 * Hanya dipanggil SETELAH kunci lolos (request 401 tidak dihitung —
 * kalau tidak, penyerang bisa memblokir bot dengan membanjiri
 * request berkunci salah).
 *
 * Logika: window 60 detik; windowStart lebih tua dari 60 detik ->
 * reset count=1, windowStart=now; kalau tidak -> count+1 (atomik
 * lewat increment); kalau count > 60 -> batasi (429).
 *
 * Kalau database tidak bisa dijangkau, gagal TERBUKA (allow) mengikuti
 * konvensi rate-limit.ts — rate limit tidak boleh memblokir bot saat
 * DB bermasalah; route-nya sendiri tetap akan gagal di query
 * berikutnya kalau DB memang mati. Kegagalan dicatat ke console.error.
 */
async function checkBotRateLimit(apiKey: string): Promise<boolean> {
  const key = `bot:${sha256Hex(apiKey)}`;
  const now = new Date();
  try {
    const row = await prisma.rateLimit.findUnique({ where: { key } });
    if (!row || now.getTime() - row.windowStart.getTime() > BOT_RATE_LIMIT_WINDOW_MS) {
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, windowStart: now },
        update: { count: 1, windowStart: now },
      });
      return true;
    }
    const updated = await prisma.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
    return updated.count <= BOT_RATE_LIMIT_MAX_PER_MINUTE;
  } catch (error) {
    console.error("[BOT_RATE_LIMIT_ERROR]", error);
    return true;
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Cek header X-Bot-Key lawan WA_BOT_API_KEY dari env.
 * Urutan: HTTPS (production) -> kunci env ada? -> header ada? ->
 * bandingkan constant-time -> rate limit 60/menit.
 * Fail-closed: env belum diisi ATAU header kosong/salah -> 401 generik.
 */
export async function authenticateBotKey(
  request: Request
): Promise<{ ok: true } | { ok: false; status: 401 | 429 }> {
  if (!isHttpsRequest(request)) {
    return { ok: false, status: 401 };
  }

  const expectedKey = process.env.WA_BOT_API_KEY?.trim();
  if (!expectedKey) {
    // Kunci belum diisi di env -> tolak semua (fail-closed). Jangan
    // bocorkan bahwa penyebabnya kunci env yang kosong.
    return { ok: false, status: 401 };
  }

  const providedKey = request.headers.get("X-Bot-Key")?.trim();
  if (!providedKey) {
    return { ok: false, status: 401 };
  }

  if (!timingSafeEqualString(providedKey, expectedKey)) {
    return { ok: false, status: 401 };
  }

  // Rate limit HANYA dihitung setelah kunci lolos (lihat checkBotRateLimit).
  const allowed = await checkBotRateLimit(providedKey);
  if (!allowed) {
    return { ok: false, status: 429 };
  }

  return { ok: true };
}

/** Parse header X-Bot-Level ("1"/"2"/"3", selain itu null). */
export function getBotLevel(request: Request): BotLevel | null {
  const raw = request.headers.get("X-Bot-Level")?.trim();
  if (raw === "1" || raw === "2" || raw === "3") {
    return Number(raw) as BotLevel;
  }
  return null;
}

/** Header X-Bot-Sender (no. HP / LID pengirim WA), di-trim; kosong -> null. */
export function getBotSender(request: Request): string | null {
  const sender = request.headers.get("X-Bot-Sender")?.trim();
  return sender ? sender : null;
}

/**
 * Auth untuk endpoint TULIS: kunci dulu (401/429), lalu level header
 * harus ada dan termasuk `allowed`, dan sender tidak boleh kosong.
 * Kalau tidak -> 403 (pesan sopan via botForbiddenMessage(level)).
 */
export async function requireBotWrite(
  request: Request,
  allowed: BotLevel[]
): Promise<
  | { ok: true; level: BotLevel; sender: string }
  | { ok: false; status: 401 | 403 | 429 }
> {
  const auth = await authenticateBotKey(request);
  if (!auth.ok) return auth;

  const level = getBotLevel(request);
  const sender = getBotSender(request);
  if (!level || !allowed.includes(level) || !sender) {
    return { ok: false, status: 403 };
  }
  return { ok: true, level, sender };
}

/**
 * Auth untuk endpoint BACA: kunci dulu (401/429); level header boleh
 * kosong (dianggap 3); kalau ada tapi bukan 1/2/3 -> tetap anggap 3
 * (jangan gagalkan baca). Sender boleh null (baca tidak wajib kenal
 * pengirim, tapi route tetap boleh mencatatnya kalau ada).
 */
export async function requireBotRead(
  request: Request
): Promise<
  | { ok: true; level: BotLevel; sender: string | null }
  | { ok: false; status: 401 | 429 }
> {
  const auth = await authenticateBotKey(request);
  if (!auth.ok) return auth;

  const level = getBotLevel(request) ?? 3;
  return { ok: true, level, sender: getBotSender(request) };
}

// ---------------------------------------------------------------------------
// Respons standar { success, data } / { success: false, error }
// ---------------------------------------------------------------------------

export function botOk(
  data: unknown,
  pagination?: { page: number; limit: number; total: number; totalPages: number }
): NextResponse {
  const body: Record<string, unknown> = { success: true, data };
  if (pagination) body.pagination = pagination;
  return NextResponse.json(body, { status: 200 });
}

export function botErr(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * SELALU kembalikan pesan generik — JANGAN PERNAH kembalikan pesan
 * Prisma/SQL/stack trace ke client. Detail boleh console.error di
 * server (tanpa kunci).
 */
export function sanitizeBotError(err: unknown): string {
  console.error("[BOT_ERROR]", err);
  return "Terjadi kesalahan di server.";
}

// ---------------------------------------------------------------------------
// Audit log (model BotAuditLog, tabel bot_audit_logs)
// ---------------------------------------------------------------------------

export type WriteBotAuditInput = {
  level: number;
  sender: string;
  method: string;
  endpoint: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  success: boolean;
  error?: string;
};

/**
 * Ringkas nilai untuk kolom Json audit: utuh kalau JSON-nya <= 2000
 * karakter; kalau lebih, simpan string JSON terpotong 2000 karakter
 * (tetap nilai Json yang valid). undefined -> undefined (kolom null).
 */
function summarizeForAudit(value: unknown): unknown {
  if (value === undefined) return undefined;
  try {
    const text = JSON.stringify(value) ?? String(value);
    if (text.length <= 2000) return value;
    return text.slice(0, 2000);
  } catch {
    try {
      return String(value).slice(0, 2000);
    } catch {
      return "[tidak bisa diserialisasi]";
    }
  }
}

/**
 * Insert satu baris audit. JANGAN PERNAH throw — gagal audit tidak
 * boleh gagalkan request (try/catch internal). JANGAN PERNAH mencatat
 * kunci (input tidak membawa kunci; jangan tambahkan).
 */
export async function writeBotAudit(input: WriteBotAuditInput): Promise<void> {
  try {
    await prisma.botAuditLog.create({
      data: {
        level: input.level,
        sender: input.sender,
        method: input.method,
        endpoint: input.endpoint,
        entityType: input.entityType,
        entityId: input.entityId,
        before: summarizeForAudit(input.before) as never,
        after: summarizeForAudit(input.after) as never,
        success: input.success,
        error: input.error ? input.error.slice(0, 500) : undefined,
      },
    });
  } catch (error) {
    // Audit gagal (mis. DB mati / migrasi belum jalan) -> catat saja,
    // request tetap lanjut. Jangan lempar, jangan bocorkan ke client.
    console.error("[BOT_AUDIT_ERROR]", input.endpoint, input.entityType, error);
  }
}

// ---------------------------------------------------------------------------
// Pagination & serialisasi
// ---------------------------------------------------------------------------

/** limit default 20, clamp 1..50; page minimal 1. */
export function parseBotPagination(searchParams: URLSearchParams): {
  page: number;
  limit: number;
  skip: number;
} {
  const rawPage = Number(searchParams.get("page"));
  const rawLimit = Number(searchParams.get("limit"));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(50, Math.floor(rawLimit))
      : 20;
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Ubah Prisma Decimal / number ke Number. Decimal HARUS diubah sebelum
 * dikirim sebagai JSON — objek Decimal mentah membuat JSON.stringify
 * gagal / hasilnya bukan angka. null/undefined/NaN -> null.
 */
export function toNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  // Prisma Decimal (duck-typing via toNumber, supaya tidak tergantung
  // import Decimal dari @prisma/client di tiap route).
  if (typeof value === "object") {
    const maybeDecimal = value as { toNumber?: unknown };
    if (typeof maybeDecimal.toNumber === "function") {
      try {
        const n = (maybeDecimal.toNumber as () => unknown)();
        return typeof n === "number" && Number.isFinite(n) ? n : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Serialisasi rekursif untuk data yang dikirim sebagai JSON: Decimal
 * -> number (via toNum), Date -> string ISO, BigInt -> number.
 * Dipakai route bot sebelum botOk(...) kalau datanya berisi nilai
 * Prisma mentah. Array/objek lain diteruskan apa adanya.
 */
export function serializeBotData<T>(value: T): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const maybeDecimal = value as { toNumber?: unknown };
    if (typeof maybeDecimal.toNumber === "function") {
      return toNum(value);
    }
    if (Array.isArray(value)) return value.map((v) => serializeBotData(v));
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeBotData(v);
    }
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Actor user untuk field createdById (bot tidak punya user id)
// ---------------------------------------------------------------------------

/**
 * Cari User SUPER_ADMIN pertama (orderBy createdAt asc) dan kembalikan
 * id-nya. Dipakai WS-C/WS-D untuk field `createdById` yang wajib di
 * StockMovement / DeliveryOrder, karena bot tidak punya user id
 * (bot auth pakai kunci API, bukan login user).
 *
 * Kalau tidak ada -> null (route yang memanggil harus balas 500
 * generik — jangan lanjutkan tulis tanpa createdById yang valid).
 * Filter isActive sengaja TIDAK dipakai di sini (sesuai spesifikasi
 * WS-A); kalau koordinator memutuskan hanya SUPER_ADMIN aktif yang
 * boleh jadi actor, tambahkan `isActive: true` di where.
 */
export async function getBotActorUserId(): Promise<string | null> {
  try {
    const admin = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return admin?.id ?? null;
  } catch (error) {
    console.error("[BOT_ACTOR_ERROR]", error);
    return null;
  }
}
