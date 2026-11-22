/**
 * r2-tracking.ts — Pelacakan file Cloudflare R2 di database (22 Nov 2026).
 *
 * Masalah yang diperbaiki: POST /api/upload membuat objek R2 tanpa jejak DB.
 * Akibatnya file yatim (batal simpan, ganti tanpa hapus, hapus data tanpa
 * hapus file) tidak terdeteksi, dan statistik kuota hanya tebakan.
 *
 * Alur yang dipakai semua jalur:
 *   upload  -> trackUpload()            : baris PENDING (r2Key unik)
 *   simpan  -> confirmR2File(url, ...)  : baris ACTIVE + owner terisi
 *   ganti   -> deleteR2FileByUrl(old)    : hapus file lama DULU, baru simpan baru
 *   hapus   -> deleteR2FileByUrl(...)    : hapus file + tandai DELETED
 *
 * Aturan keras: JANGAN PERNAH hapus jejak DB sebelum file R2 benar-benar
 * hilang (lihat deleteDeliveryPhoto). Kalau hapus R2 gagal, baris ditandai
 * DELETE_FAILED supaya bisa di-retry — bukan dihapus diam-diam.
 */
import prisma from "@/lib/prisma";
import { deleteFromR2, extractR2Filename } from "./storage";

export type R2OwnerType =
  | "PRODUCT"
  | "DELIVERY_PROOF"
  | "PAYMENT_PROOF"
  | "HERO"
  | "LOGO"
  | "UNKNOWN";

/** Folder R2 -> tipe pemilik. Folder yang tidak dikenal = UNKNOWN. */
export function ownerTypeFromFolder(folder: string): R2OwnerType {
  switch ((folder || "").toLowerCase()) {
    case "products":
      return "PRODUCT";
    case "proofs_delivery":
      return "DELIVERY_PROOF";
    case "proofs_payment":
      return "PAYMENT_PROOF";
    case "heroes":
      return "HERO";
    case "logos":
      return "LOGO";
    default:
      return "UNKNOWN";
  }
}

/** Ambil SEMUA url dari tag di notes, mis. extractTagUrls(notes, "BUKTI_TF"). */
export function extractTagUrls(
  notes: string | null | undefined,
  tag: string
): string[] {
  if (!notes) return [];
  const re = new RegExp(`\\[${tag}\\]:\\s*([^\\s\\]\\n]+)`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(notes)) !== null) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

/** Ambil semua key R2 dari beberapa tag sekaligus. */
export function extractTagKeys(
  notes: string | null | undefined,
  tags: string[]
): string[] {
  const keys: string[] = [];
  for (const tag of tags) {
    for (const url of extractTagUrls(notes, tag)) {
      const key = extractR2Filename(url);
      if (key) keys.push(key);
    }
  }
  return Array.from(new Set(keys));
}

/**
 * Catat upload baru sebagai PENDING. Dipanggil dari POST /api/upload
 * SETELAH Worker mengonfirmasi file tersimpan. Kalau baris sudah ada
 * (upload ganda / retry), dibiarkan apa adanya.
 *
 * FIX (22 Nov 2026, pentest L9): pencatatan diulang sampai 3x dengan jeda
 * singkat (kegagalan sesaat DB tidak langsung membuat file yatim).
 * Mengembalikan true kalau baris berhasil tercatat, false kalau semua
 * percobaan gagal — pemanggil TIDAK menggagalkan upload, tapi menandai
 * respons sebagai `untracked` supaya operator tahu file itu tidak terlacak.
 */
export async function trackUpload(input: {
  r2Key: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
  folder: string;
  uploadedById?: string | null;
}): Promise<boolean> {
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await prisma.r2File.upsert({
        where: { r2Key: input.r2Key },
        update: {},
        create: {
          r2Key: input.r2Key,
          url: input.url,
          sizeBytes: input.sizeBytes,
          mimeType: input.mimeType,
          folder: input.folder,
          ownerType: ownerTypeFromFolder(input.folder),
          uploadedById: input.uploadedById ?? null,
          status: "PENDING",
        },
      });
      return true;
    } catch (e) {
      console.warn(
        `[R2_TRACK_WARN] Gagal mencatat upload (percobaan ${attempt}/${MAX_ATTEMPTS}):`,
        e
      );
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
      }
    }
  }
  return false;
}

/**
 * Hitung berapa file yang diunggah satu user sejak awal hari ini (UTC).
 * Dipakai batas harian upload di POST /api/upload (pentest M15).
 * Kalau query gagal, mengembalikan 0 (fail-open) supaya upload bukti
 * bayar/kirim tidak mati hanya karena hitungan kuota bermasalah —
 * kegagalannya tetap dicatat di log server.
 */
export async function countUserUploadsToday(
  userId: string
): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  try {
    return await prisma.r2File.count({
      where: { uploadedById: userId, createdAt: { gte: startOfDay } },
    });
  } catch (e) {
    console.warn("[R2_QUOTA_WARN] Gagal menghitung kuota upload harian:", e);
    return 0;
  }
}

/**
 * Konfirmasi file: entitas pemilik sudah disimpan, jadi baris jadi ACTIVE
 * dengan owner terisi. Kalau baris belum ada (file diunggah sebelum patch
 * ini), dibuatkan baris ACTIVE baru. Dipanggil dari setiap jalur simpan
 * (produk, DO, bukti transfer, hero, logo).
 */
export async function confirmR2File(
  urlOrKey: string | null | undefined,
  ownerType: R2OwnerType,
  ownerId: string
) {
  if (!urlOrKey) return;
  const r2Key = extractR2Filename(urlOrKey);
  if (!r2Key) return;
  const folder = r2Key.split("/")[0] || "products";
  try {
    await prisma.r2File.upsert({
      where: { r2Key },
      update: { ownerType, ownerId, status: "ACTIVE" },
      create: {
        r2Key,
        url: urlOrKey,
        sizeBytes: 0, // Ukuran asli tidak diketahui untuk file lama; diisi backfill.
        mimeType: "image/jpeg",
        folder,
        ownerType,
        ownerId,
        status: "ACTIVE",
      },
    });
  } catch (e) {
    console.warn("[R2_CONFIRM_WARN] Gagal mengonfirmasi file:", r2Key, e);
  }
}

/** Konfirmasi banyak file sekaligus (mis. daftar gambar produk). */
export async function confirmR2Files(
  urlsOrKeys: Array<string | null | undefined>,
  ownerType: R2OwnerType,
  ownerId: string
) {
  for (const u of urlsOrKeys) {
    await confirmR2File(u, ownerType, ownerId);
  }
}

/**
 * Hapus SATU file: hapus dari R2 dulu, baru tandai baris DELETED.
 * Kalau hapus R2 gagal, baris ditandai DELETE_FAILED (bukan dihapus) —
 * jejaknya tetap ada supaya bisa di-retry dari halaman Penyimpanan.
 * Mengembalikan true hanya kalau file benar-benar hilang dari R2.
 */
export async function deleteR2FileByUrl(
  urlOrKey: string | null | undefined
): Promise<boolean> {
  if (!urlOrKey) return false;
  const r2Key = extractR2Filename(urlOrKey);
  if (!r2Key) return false;

  const ok = await deleteFromR2(r2Key);
  try {
    if (ok) {
      await prisma.r2File.updateMany({
        where: { r2Key },
        data: { status: "DELETED" },
      });
    } else {
      await prisma.r2File.updateMany({
        where: { r2Key },
        data: { status: "DELETE_FAILED" },
      });
    }
  } catch (e) {
    console.warn("[R2_DELETE_TRACK_WARN] Gagal menandai file:", r2Key, e);
  }
  return ok;
}

/**
 * Hapus banyak file; mengembalikan jumlah yang benar-benar terhapus.
 * Dijalankan bertahap (10 file sekaligus) supaya hapus massal ratusan
 * file tidak memakan waktu bermenit-menit.
 */
export async function deleteR2FilesByKeys(
  keys: string[]
): Promise<{ deleted: number; failed: number }> {
  const uniq = Array.from(new Set(keys.filter(Boolean)));
  let deleted = 0;
  let failed = 0;
  const CHUNK = 10;
  for (let i = 0; i < uniq.length; i += CHUNK) {
    const results = await Promise.allSettled(
      uniq.slice(i, i + CHUNK).map((key) => deleteR2FileByUrl(key))
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) deleted++;
      else failed++;
    }
  }
  return { deleted, failed };
}

/** Tandai baris-baris sebagai DELETED tanpa memanggil R2 (dipakai setelah
 *  penghapusan massal yang sudah memanggil Worker sendiri). */
export async function markR2FilesDeletedByKeys(keys: string[]) {
  const uniq = Array.from(new Set(keys.filter(Boolean)));
  if (uniq.length === 0) return;
  try {
    await prisma.r2File.updateMany({
      where: { r2Key: { in: uniq } },
      data: { status: "DELETED" },
    });
  } catch (e) {
    console.warn("[R2_MARK_DELETED_WARN]", e);
  }
}

/**
 * Hapus SEMUA file milik satu entitas (dipakai saat entitas dihapus).
 * Mengembalikan jumlah file yang benar-benar terhapus dari R2.
 */
export async function deleteR2FilesForOwner(
  ownerType: R2OwnerType,
  ownerId: string
): Promise<{ deleted: number; failed: number }> {
  const rows = await prisma.r2File.findMany({
    where: { ownerType, ownerId, status: { in: ["ACTIVE", "PENDING", "ORPHANED", "DELETE_FAILED"] } },
    select: { r2Key: true },
  });
  return deleteR2FilesByKeys(rows.map((r) => r.r2Key));
}

/**
 * Tandai baris PENDING yang sudah lebih dari 24 jam sebagai ORPHANED
 * (diunggah tapi tidak pernah disimpan pemiliknya). Dipanggil dari
 * halaman Penyimpanan & endpoint rekonsiliasi.
 */
export async function sweepStalePending(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const res = await prisma.r2File.updateMany({
      where: { status: "PENDING", createdAt: { lt: cutoff } },
      data: { status: "ORPHANED" },
    });
    return res.count;
  } catch (e) {
    console.warn("[R2_SWEEP_WARN]", e);
    return 0;
  }
}
