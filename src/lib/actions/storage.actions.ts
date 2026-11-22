"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/utils/role";
import { revalidatePath } from "next/cache";
import { extractR2Filename } from "@/lib/utils/storage";
import {
  deleteR2FileByUrl,
  deleteR2FilesByKeys,
  extractTagKeys,
  sweepStalePending,
} from "@/lib/utils/r2-tracking";

// Kuota gratis Cloudflare R2: 10 GB penyimpanan.
const R2_QUOTA_BYTES = 10 * 1024 * 1024 * 1024;

// PENTEST FIX (22 Nov 2026, L4): pola key R2 yang sama seperti DELETE
// /api/upload — tolak traversal (../) dan key di luar folder/nama.ext.
const R2_KEY_RE = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(?:-[a-zA-Z0-9_-]+)*\.(jpg|jpeg|png|webp)$/;
const MAX_RECONCILE_KEYS = 100;

/** Normalisasi key R2 (terima URL penuh juga); null kalau polanya tidak valid. */
function normalizeR2Key(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const key = extractR2Filename(raw.trim()) || raw.trim();
  return R2_KEY_RE.test(key) ? key : null;
}

/** Validasi daftar key: maks 100, tiap key harus pola folder/nama.ext. */
function validateR2KeyList(
  keys: unknown[]
): { ok: true; keys: string[] } | { ok: false; error: string } {
  if (!Array.isArray(keys) || keys.length === 0) {
    return { ok: false, error: "Tidak ada file yang dipilih." };
  }
  if (keys.length > MAX_RECONCILE_KEYS) {
    return { ok: false, error: `Maksimal ${MAX_RECONCILE_KEYS} key sekaligus.` };
  }
  const out: string[] = [];
  for (const k of keys) {
    const norm = normalizeR2Key(k);
    if (!norm) {
      return { ok: false, error: "Ada key file yang tidak valid (harus pola folder/nama.jpg|jpeg|png|webp)." };
    }
    out.push(norm);
  }
  return { ok: true, keys: Array.from(new Set(out)) };
}

async function requireStorageAdmin() {
  const session = await auth();
  requirePermission(session, "MANAGE_STORE_SETTINGS");
  return session;
}

async function requireStorageViewer() {
  const session = await auth();
  requirePermission(session, "VIEW_MENU_SETTINGS");
  return session;
}

/**
 * Ringkasan penyimpanan untuk halaman Penyimpanan. Angka ukuran ASLI dari
 * tabel R2File (bukan tebakan jumlah x 45KB seperti dulu).
 */
export async function getStorageOverview() {
  try {
    await requireStorageViewer();
    await sweepStalePending();

    const [activeAgg, byFolder, orphanAgg, pendingAgg, failedAgg, counts] =
      await Promise.all([
        prisma.r2File.aggregate({
          _sum: { sizeBytes: true },
          _count: { _all: true },
          where: { status: "ACTIVE" },
        }),
        prisma.r2File.groupBy({
          by: ["folder"],
          _sum: { sizeBytes: true },
          _count: { _all: true },
          where: { status: "ACTIVE" },
        }),
        prisma.r2File.aggregate({
          _sum: { sizeBytes: true },
          _count: { _all: true },
          where: { status: "ORPHANED" },
        }),
        prisma.r2File.aggregate({
          _sum: { sizeBytes: true },
          _count: { _all: true },
          where: { status: "PENDING" },
        }),
        prisma.r2File.aggregate({
          _sum: { sizeBytes: true },
          _count: { _all: true },
          where: { status: "DELETE_FAILED" },
        }),
        Promise.all([
          prisma.productImage.count(),
          prisma.deliveryPhoto.count(),
          prisma.heroImage.count(),
          prisma.deliveryOrder.count({
            where: { proofImage: { not: null } },
          }),
        ]),
      ]);

    const usedBytes = activeAgg._sum.sizeBytes ?? 0;
    return {
      success: true,
      data: {
        quotaBytes: R2_QUOTA_BYTES,
        usedBytes,
        usedPercent: Number(((usedBytes / R2_QUOTA_BYTES) * 100).toFixed(2)),
        activeCount: activeAgg._count._all,
        byFolder: byFolder.map((f) => ({
          folder: f.folder,
          count: f._count._all,
          sizeBytes: f._sum.sizeBytes ?? 0,
        })),
        orphans: {
          count: orphanAgg._count._all,
          sizeBytes: orphanAgg._sum.sizeBytes ?? 0,
        },
        pending: {
          count: pendingAgg._count._all,
          sizeBytes: pendingAgg._sum.sizeBytes ?? 0,
        },
        deleteFailed: {
          count: failedAgg._count._all,
          sizeBytes: failedAgg._sum.sizeBytes ?? 0,
        },
        legacyCounts: {
          productImages: counts[0],
          deliveryPhotos: counts[1],
          heroImages: counts[2],
          deliveryOrdersWithProof: counts[3],
        },
      },
    };
  } catch (error) {
    console.error("[STORAGE_OVERVIEW_ERROR]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal memuat ringkasan penyimpanan",
    };
  }
}

/** Daftar file R2 dengan filter + paging untuk halaman Penyimpanan. */
export async function listR2Files(params?: {
  status?: string;
  folder?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  try {
    await requireStorageViewer();
    const page = Math.max(1, params?.page ?? 1);
    const limit = Math.min(100, Math.max(1, params?.limit ?? 30));
    const where: any = {};
    if (params?.status) where.status = params.status;
    if (params?.folder) where.folder = params.folder;
    if (params?.search) {
      where.OR = [
        { r2Key: { contains: params.search, mode: "insensitive" } },
        { ownerId: { contains: params.search, mode: "insensitive" } },
      ];
    }
    const [rows, total] = await Promise.all([
      prisma.r2File.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          r2Key: true,
          url: true,
          sizeBytes: true,
          mimeType: true,
          folder: true,
          ownerType: true,
          ownerId: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.r2File.count({ where }),
    ]);
    return {
      success: true,
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  } catch (error) {
    console.error("[R2_LIST_ERROR]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal memuat daftar file",
    };
  }
}

/**
 * Hapus SATU file dari halaman Penyimpanan. Kalau hapus R2 gagal, baris
 * dipertahankan sebagai DELETE_FAILED. Dengan force=true, baris dihapus
 * juga (dipakai kalau file memang sudah tidak ada di R2).
 */
export async function deleteR2FileAction(r2Key: string, force = false) {
  try {
    await requireStorageAdmin();
    if (!r2Key) return { success: false, error: "Key file wajib diisi." };

    const ok = await deleteR2FileByUrl(r2Key);
    if (ok) {
      revalidatePath("/dashboard/storage");
      return { success: true, message: `File ${r2Key} berhasil dihapus dari R2.` };
    }
    if (force) {
      await prisma.r2File.deleteMany({ where: { r2Key } });
      revalidatePath("/dashboard/storage");
      return {
        success: true,
        message: `File ${r2Key} tidak ditemukan di R2 — jejaknya dihapus dari database.`,
      };
    }
    return {
      success: false,
      error:
        "Gagal menghapus file dari Cloudflare R2. File ditandai DELETE_FAILED — coba lagi nanti, atau pakai 'Hapus jejak' kalau file memang sudah tidak ada di R2.",
    };
  } catch (error) {
    console.error("[R2_DELETE_ACTION_ERROR]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal menghapus file",
    };
  }
}

/** Hapus massal file yatim (dipakai dari bagian Yatim di halaman Penyimpanan). */
export async function deleteOrphanR2Files(keys: string[]) {
  try {
    await requireStorageAdmin();
    const checked = validateR2KeyList(keys);
    if (!checked.ok) return { success: false, error: checked.error };
    const res = await deleteR2FilesByKeys(checked.keys);
    revalidatePath("/dashboard/storage");
    return {
      success: true,
      message: `Berhasil menghapus ${res.deleted} file dari R2.${res.failed > 0 ? ` ${res.failed} gagal — lihat status DELETE_FAILED.` : ""}`,
      detail: res,
    };
  } catch (error) {
    console.error("[R2_DELETE_ORPHANS_ERROR]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal menghapus file yatim",
    };
  }
}

/**
 * BACKFILL satu kali: isi tabel R2File dari data yang sudah ada sebelum
 * patch ini (DeliveryPhoto, proofImage DO, tag di notes, ProductImage,
 * HeroImage, logo toko). File yang sudah tercatat dilewati. Dijalankan dari
 * halaman Penyimpanan atau POST /api/storage/backfill.
 */
export async function runBackfill() {
  try {
    await requireStorageAdmin();

    type Seed = {
      r2Key: string;
      url: string;
      sizeBytes: number;
      mimeType: string;
      folder: string;
      ownerType: "PRODUCT" | "DELIVERY_PROOF" | "PAYMENT_PROOF" | "HERO" | "LOGO" | "UNKNOWN";
      ownerId: string | null;
    };
    const seeds = new Map<string, Seed>();
    const counts: Record<string, number> = {
      deliveryPhotos: 0,
      deliveryProofs: 0,
      paymentProofs: 0,
      productImages: 0,
      heroImages: 0,
      logos: 0,
    };
    const put = (s: Seed) => {
      if (!s.r2Key) return;
      if (!seeds.has(s.r2Key)) seeds.set(s.r2Key, s);
    };
    const folderOf = (key: string) => key.split("/")[0] || "products";

    // 1. DeliveryPhoto — satu-satunya tabel yang sudah punya filename+size.
    const photos = await prisma.deliveryPhoto.findMany({
      select: { deliveryOrderId: true, url: true, filename: true, sizeBytes: true, mimeType: true },
    });
    for (const p of photos) {
      const key = p.filename || extractR2Filename(p.url);
      if (!key) continue;
      put({
        r2Key: key,
        url: p.url,
        sizeBytes: p.sizeBytes ?? 0,
        mimeType: p.mimeType || "image/jpeg",
        folder: folderOf(key),
        ownerType: "DELIVERY_PROOF",
        ownerId: p.deliveryOrderId,
      });
      counts.deliveryPhotos++;
    }

    // 2. DeliveryOrder.proofImage + tag BUKTI_KIRIM / FOTO_LOKASI di notes.
    const dos = await prisma.deliveryOrder.findMany({
      select: { id: true, proofImage: true, notes: true },
    });
    for (const d of dos) {
      const pk = extractR2Filename(d.proofImage);
      if (pk) {
        put({
          r2Key: pk,
          url: d.proofImage!,
          sizeBytes: 0,
          mimeType: "image/jpeg",
          folder: folderOf(pk),
          ownerType: "DELIVERY_PROOF",
          ownerId: d.id,
        });
        counts.deliveryProofs++;
      }
      for (const key of extractTagKeys(d.notes, ["BUKTI_KIRIM", "FOTO_LOKASI"])) {
        put({
          r2Key: key,
          url: key,
          sizeBytes: 0,
          mimeType: "image/jpeg",
          folder: folderOf(key),
          ownerType: "DELIVERY_PROOF",
          ownerId: d.id,
        });
        counts.deliveryProofs++;
      }
    }

    // 3. Bukti transfer di Sale.notes dan DebtPayment.notes.
    const sales = await prisma.sale.findMany({
      where: { notes: { contains: "[BUKTI_TF]" } },
      select: { id: true, notes: true },
    });
    const payments = await prisma.debtPayment.findMany({
      where: { notes: { contains: "[BUKTI_TF]" } },
      select: { id: true, notes: true },
    });
    for (const row of [...sales, ...payments]) {
      for (const key of extractTagKeys(row.notes, ["BUKTI_TF"])) {
        put({
          r2Key: key,
          url: key,
          sizeBytes: 0,
          mimeType: "image/jpeg",
          folder: folderOf(key),
          ownerType: "PAYMENT_PROOF",
          ownerId: row.id,
        });
        counts.paymentProofs++;
      }
    }

    // 4. ProductImage (ukuran asli tidak diketahui untuk file lama -> 0).
    const productImages = await prisma.productImage.findMany({
      select: { productId: true, imageUrl: true },
    });
    for (const img of productImages) {
      const key = extractR2Filename(img.imageUrl);
      if (!key) continue;
      put({
        r2Key: key,
        url: img.imageUrl,
        sizeBytes: 0,
        mimeType: "image/jpeg",
        folder: folderOf(key),
        ownerType: "PRODUCT",
        ownerId: img.productId,
      });
      counts.productImages++;
    }

    // 5. HeroImage.
    const heroes = await prisma.heroImage.findMany({
      select: { id: true, imageUrl: true },
    });
    for (const h of heroes) {
      const key = extractR2Filename(h.imageUrl);
      if (!key) continue;
      put({
        r2Key: key,
        url: h.imageUrl,
        sizeBytes: 0,
        mimeType: "image/jpeg",
        folder: folderOf(key),
        ownerType: "HERO",
        ownerId: h.id,
      });
      counts.heroImages++;
    }

    // 6. Logo toko.
    const setting = await prisma.storeSetting.findFirst({
      select: { id: true, logoUrl: true },
    });
    const logoKey = extractR2Filename(setting?.logoUrl);
    if (logoKey && setting) {
      put({
        r2Key: logoKey,
        url: setting.logoUrl!,
        sizeBytes: 0,
        mimeType: "image/jpeg",
        folder: folderOf(logoKey),
        ownerType: "LOGO",
        ownerId: setting.id,
      });
      counts.logos++;
    }

    const existing = await prisma.r2File.findMany({
      where: { r2Key: { in: Array.from(seeds.keys()) } },
      select: { r2Key: true },
    });
    const existingKeys = new Set(existing.map((r) => r.r2Key));
    const toCreate = Array.from(seeds.values()).filter((s) => !existingKeys.has(s.r2Key));

    if (toCreate.length > 0) {
      await prisma.r2File.createMany({
        data: toCreate.map((s) => ({ ...s, status: "ACTIVE" as const })),
        skipDuplicates: true,
      });
    }

    revalidatePath("/dashboard/storage");
    return {
      success: true,
      message: `Backfill selesai: ${toCreate.length} file baru tercatat, ${existingKeys.size} sudah tercatat sebelumnya.`,
      detail: { ...counts, created: toCreate.length, skipped: existingKeys.size },
    };
  } catch (error) {
    console.error("[R2_BACKFILL_ERROR]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal menjalankan backfill",
    };
  }
}

/**
 * Info rekonsiliasi: status env untuk listing R2 langsung + jumlah yatim
 * di DB. Listing R2 LANGSUNG belum bisa: tidak ada kredensial S3 R2 di env
 * (hanya CLOUDFLARE_WORKER_URL) dan kode Worker tidak ada di repo, jadi
 * tidak ada endpoint /list yang bisa dipanggil. Cara rekonsiliasi hari ini:
 * export daftar key dari dashboard Cloudflare (R2 -> bucket -> Objects)
 * atau `wrangler r2 object list <bucket>`, lalu tempel ke POST
 * /api/storage/reconcile. Kalau nanti kredensial S3 ditambahkan
 * (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME),
 * endpoint ini bisa memanggil ListObjectsV2 langsung.
 */
export async function getReconcileInfo() {
  try {
    await requireStorageAdmin();
    await sweepStalePending();
    const [orphans, failed, pending] = await Promise.all([
      prisma.r2File.count({ where: { status: "ORPHANED" } }),
      prisma.r2File.count({ where: { status: "DELETE_FAILED" } }),
      prisma.r2File.count({ where: { status: "PENDING" } }),
    ]);
    const missingVars = [
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET_NAME",
    ].filter((v) => !process.env[v]);
    return {
      success: true,
      data: {
        orphans,
        deleteFailed: failed,
        pending,
        hasWorkerUrl: !!process.env.CLOUDFLARE_WORKER_URL,
        directListingAvailable: missingVars.length === 0,
        missingVars,
        instructions:
          "Export daftar objek dari dashboard Cloudflare (R2 -> bucket -> Objects) atau jalankan `wrangler r2 object list <nama-bucket>`, lalu kirim { keys: [{ key, sizeBytes }] } ke POST /api/storage/reconcile.",
      },
    };
  } catch (error) {
    console.error("[R2_RECONCILE_INFO_ERROR]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal memuat info rekonsiliasi",
    };
  }
}

/**
 * Bandingkan daftar key R2 (dari export dashboard / wrangler) dengan DB.
 * Key yang ada di R2 tapi tidak dikenal DB dicatat sebagai ORPHANED supaya
 * bisa dihapus dari halaman Penyimpanan. Key yang ada di DB tapi tidak di
 * R2 dilaporkan (sudah hilang di luar aplikasi).
 */
export async function reconcileWithKeyList(
  keys: Array<{ key: string; sizeBytes?: number }>
) {
  try {
    await requireStorageAdmin();
    // PENTEST FIX (L4): validasi tiap key (pola folder/nama.ext, maks 100)
    // + sizeBytes harus angka wajar (yang tidak valid jadi 0).
    if (!Array.isArray(keys) || keys.length === 0) {
      return { success: false, error: "Daftar key R2 kosong." };
    }
    if (keys.length > MAX_RECONCILE_KEYS) {
      return { success: false, error: `Maksimal ${MAX_RECONCILE_KEYS} key sekaligus.` };
    }
    const entries: Array<{ key: string; sizeBytes: number }> = [];
    for (const k of keys) {
      const norm = normalizeR2Key(k.key);
      if (!norm) {
        return { success: false, error: "Ada key R2 yang tidak valid (harus pola folder/nama.jpg|jpeg|png|webp)." };
      }
      const size =
        typeof k.sizeBytes === "number" && Number.isFinite(k.sizeBytes) && k.sizeBytes >= 0
          ? Math.floor(k.sizeBytes)
          : 0;
      entries.push({ key: norm, sizeBytes: size });
    }
    const r2Keys = Array.from(new Set(entries.map((e) => e.key)));
    if (r2Keys.length === 0) {
      return { success: false, error: "Daftar key R2 kosong." };
    }
    const sizeByKey = new Map<string, number>();
    for (const e of entries) {
      if (!sizeByKey.has(e.key)) sizeByKey.set(e.key, e.sizeBytes);
    }

    const dbRows = await prisma.r2File.findMany({
      where: { status: { in: ["ACTIVE", "PENDING", "ORPHANED", "DELETE_FAILED"] } },
      select: { r2Key: true },
    });
    const dbKeys = new Set(dbRows.map((r) => r.r2Key));

    const inR2NotInDb = r2Keys.filter((k) => !dbKeys.has(k));
    const inDbNotInR2 = Array.from(dbKeys).filter((k) => !r2Keys.includes(k));

    // Catat yatim sebagai ORPHANED supaya bisa dihapus dari UI.
    if (inR2NotInDb.length > 0) {
      await prisma.r2File.createMany({
        data: inR2NotInDb.map((k) => ({
          r2Key: k,
          url: k,
          sizeBytes: sizeByKey.get(k) ?? 0,
          mimeType: "image/jpeg",
          folder: k.split("/")[0] || "products",
          ownerType: "UNKNOWN" as const,
          ownerId: null,
          status: "ORPHANED" as const,
        })),
        skipDuplicates: true,
      });
    }

    revalidatePath("/dashboard/storage");
    return {
      success: true,
      data: {
        totalInR2: r2Keys.length,
        totalInDb: dbKeys.size,
        matched: r2Keys.length - inR2NotInDb.length,
        inR2NotInDb,
        inDbNotInR2,
      },
      message: `${inR2NotInDb.length} file yatim ditemukan di R2 dan dicatat untuk dihapus. ${inDbNotInR2.length} file tercatat di DB tapi sudah tidak ada di R2.`,
    };
  } catch (error) {
    console.error("[R2_RECONCILE_ERROR]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal menjalankan rekonsiliasi",
    };
  }
}
