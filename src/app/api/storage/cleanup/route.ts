import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/utils/api";
import { hasMinimumRole } from "@/lib/utils/role";
import prisma from "@/lib/prisma";
import { extractR2Filename } from "@/lib/utils/storage";
import { deleteR2FileByUrl } from "@/lib/utils/r2-tracking";

// Alias helper for consistency
const extractFilenameFromUrl = extractR2Filename;

// PENTEST FIX (22 Nov 2026, L4/M14): pola key R2 yang sama seperti
// DELETE /api/upload — dipakai untuk membedakan file R2 asli dari URL
// luar (placeholder dsb.) yang tidak ada di R2.
const R2_KEY_RE = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(?:-[a-zA-Z0-9_-]+)*\.(jpg|jpeg|png|webp)$/;

/**
 * Coba hapus satu file dari R2.
 * - "deleted": file R2 benar-benar terhapus (atau sudah tercatat DELETED).
 * - "not-r2": nilainya bukan key R2 (URL luar/placeholder) — tidak ada
 *   file di R2 yang perlu dihapus, baris DB boleh dihapus.
 * - "failed": hapus R2 gagal — baris DB WAJIB dipertahankan (L5) dan
 *   file sudah ditandai DELETE_FAILED oleh deleteR2FileByUrl.
 */
async function tryDeleteR2File(
  urlOrKey: string | null | undefined
): Promise<"deleted" | "not-r2" | "failed"> {
  const key = extractFilenameFromUrl(urlOrKey);
  if (!key) return "failed";
  if (!R2_KEY_RE.test(key)) return "not-r2";
  const ok = await deleteR2FileByUrl(key);
  return ok ? "deleted" : "failed";
}

/**
 * PENTEST FIX (22 Nov 2026, M14): tidak ada tabel audit di DB, jadi jejak
 * audit pembersihan ditulis terstruktur ke log server (Vercel logs) —
 * siapa, kapan, target, berapa yang terhapus/gagal. Jangan hapus baris ini.
 */
function auditCleanupLog(input: {
  userId: string;
  email: string;
  target: string;
  olderThanDays: number;
  deletedCount: number;
  skippedCount: number;
  failedCount: number;
}) {
  console.log(
    `[STORAGE_CLEANUP_AUDIT] ${JSON.stringify({ ...input, at: new Date().toISOString() })}`
  );
}

/**
 * GET /api/storage/cleanup
 * Mendapatkan data statistik penggunaan gambar Cloudflare R2 per kategori.
 *
 * PENTEST FIX (22 Nov 2026, L1): dulu tanpa cek role — KASIR bisa membaca
 * statistik penyimpanan internal. Sekarang ADMIN+ saja (sama seperti POST
 * dan server action getStorageOverview).
 */
export async function GET() {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasMinimumRole(session, "ADMIN")) {
      return NextResponse.json(
        { error: "Hanya Admin / Super Admin yang dapat melihat statistik penyimpanan." },
        { status: 403 }
      );
    }

    // 1. Gambar Produk per Kategori Produk
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        products: {
          select: {
            id: true,
            productImages: {
              select: {
                id: true,
                imageUrl: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // FIX (22 Nov 2026, R2): ukuran ASLI dari tabel R2File, bukan tebakan
    // jumlah x 45KB. R2File diisi oleh upload baru + backfill untuk file lama.
    const r2ProductFiles = await prisma.r2File.findMany({
      where: { ownerType: "PRODUCT", status: "ACTIVE" },
      select: { ownerId: true, sizeBytes: true },
    });
    const productSizeById = new Map<string, number>();
    for (const f of r2ProductFiles) {
      if (!f.ownerId) continue;
      productSizeById.set(f.ownerId, (productSizeById.get(f.ownerId) ?? 0) + f.sizeBytes);
    }

    const categoryStats = categories.map((cat: any) => {
      let imageCount = 0;
      let sizeBytes = 0;
      cat.products.forEach((p: any) => {
        imageCount += p.productImages.length;
        sizeBytes += productSizeById.get(p.id) ?? 0;
      });
      return {
        id: cat.id,
        name: cat.name,
        productCount: cat.products.length,
        imageCount,
        estimatedSizeKB: Math.round(sizeBytes / 1024),
        realSizeBytes: sizeBytes,
      };
    });

    // 2. Total Semua Gambar Produk
    const totalProductImages = await prisma.productImage.count();

    // 3. Bukti Pengiriman (Delivery Order) - Deteksi dari DeliveryPhoto dan proofImage
    const allDeliveryPhotos = await prisma.deliveryPhoto.findMany({
      select: {
        id: true,
        createdAt: true,
      },
    });

    const allDeliveryOrdersWithProof = await prisma.deliveryOrder.findMany({
      where: {
        OR: [
          { proofImage: { not: null } },
          { notes: { contains: "[BUKTI_KIRIM]" } },
        ],
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Hitung total bukti unik
    const deliveryProofTotal = Math.max(allDeliveryPhotos.length, allDeliveryOrdersWithProof.length);
    const deliveryProofOlder30Days = allDeliveryPhotos.filter(
      (d: any) => new Date(d.createdAt) < thirtyDaysAgo
    ).length || allDeliveryOrdersWithProof.filter(
      (d: any) => new Date(d.createdAt) < thirtyDaysAgo
    ).length;
    const deliveryProofOlder60Days = allDeliveryPhotos.filter(
      (d: any) => new Date(d.createdAt) < sixtyDaysAgo
    ).length || allDeliveryOrdersWithProof.filter(
      (d: any) => new Date(d.createdAt) < sixtyDaysAgo
    ).length;

    // 4. Bukti Transfer Penjualan & Piutang
    const allSalesWithProof = await prisma.sale.findMany({
      where: {
        notes: {
          contains: "[BUKTI_TF]",
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    const allDebtPaymentsWithProof = await prisma.debtPayment.findMany({
      where: {
        notes: {
          contains: "[BUKTI_TF]",
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    const paymentProofTotal = allSalesWithProof.length + allDebtPaymentsWithProof.length;
    const paymentProofOlder30Days =
      allSalesWithProof.filter((s: any) => new Date(s.createdAt) < thirtyDaysAgo).length +
      allDebtPaymentsWithProof.filter((d: any) => new Date(d.createdAt) < thirtyDaysAgo).length;

    // 5. Hero / Banner Images
    const heroImageCount = await prisma.heroImage.count();

    // 5b. Tag [FOTO_LOKASI] di notes DO — sebelumnya TIDAK PERNAH dihitung.
    const fotoLokasiCount = await prisma.deliveryOrder.count({
      where: { notes: { contains: "[FOTO_LOKASI]" } },
    });

    // 5c. FIX (22 Nov 2026, R2): total ukuran ASLI dari tabel R2File.
    // File yang belum ter-backfill menyumbang 0 di sini — jalankan backfill
    // dulu supaya angkanya lengkap (lihat halaman Penyimpanan).
    const r2Agg = await prisma.r2File.aggregate({
      _sum: { sizeBytes: true },
      where: { status: "ACTIVE" },
    });
    const r2ByFolder = await prisma.r2File.groupBy({
      by: ["folder"],
      _sum: { sizeBytes: true },
      _count: { _all: true },
      where: { status: "ACTIVE" },
    });
    const orphanAgg = await prisma.r2File.aggregate({
      _sum: { sizeBytes: true },
      _count: { _all: true },
      where: { status: { in: ["ORPHANED", "DELETE_FAILED"] } },
    });
    const pendingAgg = await prisma.r2File.aggregate({
      _sum: { sizeBytes: true },
      _count: { _all: true },
      where: { status: "PENDING" },
    });

    const totalDetectedImages =
      totalProductImages + deliveryProofTotal + paymentProofTotal + heroImageCount;
    const realTotalBytes = r2Agg._sum.sizeBytes ?? 0;
    const estimatedTotalKB = Math.round(realTotalBytes / 1024);
    const estimatedTotalMB = Number((estimatedTotalKB / 1024).toFixed(2));
    const r2QuotaGB = 10;
    const r2QuotaMB = 10 * 1024;
    const quotaUsedPercent = Number(((estimatedTotalMB / r2QuotaMB) * 100).toFixed(2));

    return NextResponse.json({
      success: true,
      data: {
        quota: {
          maxGB: r2QuotaGB,
          maxMB: r2QuotaMB,
          estimatedUsedMB: estimatedTotalMB,
          usedPercent: quotaUsedPercent,
          totalImages: totalDetectedImages,
        },
        productCategories: categoryStats,
        totals: {
          productImages: totalProductImages,
          deliveryProofs: {
            total: deliveryProofTotal,
            olderThan30Days: deliveryProofOlder30Days,
            olderThan60Days: deliveryProofOlder60Days,
            fotoLokasi: fotoLokasiCount,
          },
          paymentProofs: {
            total: paymentProofTotal,
            olderThan30Days: paymentProofOlder30Days,
          },
          heroImages: heroImageCount,
        },
        // FIX (22 Nov 2026, R2): angka jujur dari tabel pelacakan.
        r2Files: {
          realUsedBytes: realTotalBytes,
          byFolder: r2ByFolder.map((f: any) => ({
            folder: f.folder,
            count: f._count._all,
            sizeKB: Math.round((f._sum.sizeBytes ?? 0) / 1024),
          })),
          orphans: {
            count: orphanAgg._count._all,
            sizeMB: Number((((orphanAgg._sum.sizeBytes ?? 0) / 1024 / 1024)).toFixed(2)),
          },
          pending: {
            count: pendingAgg._count._all,
            sizeMB: Number((((pendingAgg._sum.sizeBytes ?? 0) / 1024 / 1024)).toFixed(2)),
          },
        },
      },
    });
  } catch (error) {
    console.error("[STORAGE_STATS_ERROR]", error);
    return NextResponse.json(
      { error: "Gagal memuat statistik penyimpanan" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/storage/cleanup
 * Menghapus kumpulan gambar sesuai kategori target untuk menghemat kuota Cloudflare R2 10GB.
 *
 * PENTEST FIX (22 Nov 2026, M14 + L2 + L5):
 * - Role check denylist (role === "KASIR") diganti allowlist ADMIN+.
 * - olderThanDays WAJIB bilangan bulat 1-365 untuk SEMUA target destruktif
 *   (termasuk ALL_PRODUCTS / PRODUCT_CATEGORY / HERO_IMAGES yang dulu tidak
 *   butuh itu sama sekali). Nilai -1 dulu menghasilkan cutoff di masa
 *   depan sehingga SEMUA bukti ikut terhapus.
 * - Baris DB hanya dihapus untuk file yang R2-nya benar-benar terhapus.
 *   Kalau hapus R2 gagal, baris dipertahankan + file ditandai
 *   DELETE_FAILED (bisa di-retry dari halaman Penyimpanan).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check: Admin / Super Admin only (allowlist, bukan denylist).
    if (!hasMinimumRole(session, "ADMIN")) {
      return NextResponse.json(
        { error: "Hanya Admin / Super Admin yang dapat membersihkan penyimpanan." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { target, categoryId, olderThanDays } = body;

    const validTargets = ["PRODUCT_CATEGORY", "ALL_PRODUCTS", "DELIVERY_PROOFS", "PAYMENT_PROOFS", "HERO_IMAGES"];
    if (!target || !validTargets.includes(target)) {
      return NextResponse.json(
        { error: "Target pembersihan tidak valid atau data tidak lengkap" },
        { status: 400 }
      );
    }

    // olderThanDays wajib untuk semua target destruktif.
    const days = Number(olderThanDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return NextResponse.json(
        { error: "olderThanDays wajib diisi bilangan bulat 1–365 (hari)." },
        { status: 400 }
      );
    }
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    let deletedCount = 0;
    let skippedCount = 0; // baris DB dihapus tapi nilainya bukan file R2
    let failedCount = 0; // hapus R2 gagal — baris DB dipertahankan

    const audit = () =>
      auditCleanupLog({
        userId: session.user.id!,
        email: (session.user as { email?: string }).email ?? "-",
        target,
        olderThanDays: days,
        deletedCount,
        skippedCount,
        failedCount,
      });

    // Hapus tag [TAG]: key dari satu notes; hanya tag yang filenya
    // benar-benar terhapus (atau bukan file R2) yang dibuang dari notes.
    // Mengembalikan notes baru + apakah ada perubahan.
    async function cleanNoteTags(
      notes: string,
      tags: string[]
    ): Promise<{ cleaned: string; changed: boolean }> {
      let cleaned = notes;
      let changed = false;
      for (const tag of tags) {
        const re = new RegExp(`\\[${tag}\\]:\\s*([^\\s\\]\\n]+)`, "g");
        const matches: Array<{ full: string; value: string }> = [];
        let m: RegExpExecArray | null;
        while ((m = re.exec(notes)) !== null) {
          if (m[1]) matches.push({ full: m[0], value: m[1] });
        }
        const seen = new Set<string>();
        for (const match of matches) {
          if (seen.has(match.value)) {
            // Tag duplikat dengan nilai sama — sudah ditangani di atas.
            cleaned = cleaned.split(match.full).join("");
            changed = true;
            continue;
          }
          seen.add(match.value);
          const res = await tryDeleteR2File(match.value);
          if (res === "deleted") {
            deletedCount++;
            cleaned = cleaned.split(match.full).join("");
            changed = true;
          } else if (res === "not-r2") {
            skippedCount++;
            cleaned = cleaned.split(match.full).join("");
            changed = true;
          } else {
            failedCount++;
          }
        }
      }
      return { cleaned: cleaned.trim(), changed };
    }

    // TARGET 1: Gambar Produk berdasarkan Kategori Tertentu
    if (target === "PRODUCT_CATEGORY" && categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { name: true },
      });

      const images = await prisma.productImage.findMany({
        where: {
          product: {
            categoryId: categoryId,
          },
          createdAt: { lt: cutoffDate },
        },
        select: { id: true, imageUrl: true },
      });

      const deletedIds: string[] = [];
      for (const img of images) {
        const res = await tryDeleteR2File(img.imageUrl);
        if (res === "deleted") {
          deletedCount++;
          deletedIds.push(img.id);
        } else if (res === "not-r2") {
          skippedCount++;
          deletedIds.push(img.id);
        } else {
          failedCount++;
        }
      }

      if (deletedIds.length > 0) {
        await prisma.productImage.deleteMany({
          where: { id: { in: deletedIds } },
        });
      }

      audit();
      return NextResponse.json({
        success: true,
        deletedCount,
        skippedCount,
        failedCount,
        message: `Berhasil menghapus ${deletedCount} foto produk pada kategori "${category?.name || "Kategori"}" (lebih dari ${days} hari).${failedCount > 0 ? ` ${failedCount} gagal dihapus dari R2 dan dipertahankan — lihat status DELETE_FAILED di halaman Penyimpanan.` : ""}`,
      });
    }

    // TARGET 2: Hapus SEMUA Gambar Produk (lebih dari N hari)
    if (target === "ALL_PRODUCTS") {
      const images = await prisma.productImage.findMany({
        where: { createdAt: { lt: cutoffDate } },
        select: { id: true, imageUrl: true },
      });

      const deletedIds: string[] = [];
      for (const img of images) {
        const res = await tryDeleteR2File(img.imageUrl);
        if (res === "deleted") {
          deletedCount++;
          deletedIds.push(img.id);
        } else if (res === "not-r2") {
          skippedCount++;
          deletedIds.push(img.id);
        } else {
          failedCount++;
        }
      }

      if (deletedIds.length > 0) {
        await prisma.productImage.deleteMany({
          where: { id: { in: deletedIds } },
        });
      }

      audit();
      return NextResponse.json({
        success: true,
        deletedCount,
        skippedCount,
        failedCount,
        message: `Berhasil menghapus ${deletedCount} foto produk (lebih dari ${days} hari) dari Cloudflare R2 & database.${failedCount > 0 ? ` ${failedCount} gagal dihapus dari R2 dan dipertahankan — lihat status DELETE_FAILED di halaman Penyimpanan.` : ""}`,
      });
    }

    // TARGET 3: Hapus Bukti Pengiriman (Delivery Proofs)
    if (target === "DELIVERY_PROOFS") {
      // 1. Bersihkan dari tabel DeliveryPhoto
      const photos = await prisma.deliveryPhoto.findMany({
        where: { createdAt: { lt: cutoffDate } },
        select: { id: true, filename: true, url: true },
      });

      const deletedPhotoIds: string[] = [];
      for (const p of photos) {
        const fileToDelete = p.filename || extractFilenameFromUrl(p.url);
        const res = await tryDeleteR2File(fileToDelete);
        if (res === "deleted") {
          deletedCount++;
          deletedPhotoIds.push(p.id);
        } else if (res === "not-r2") {
          skippedCount++;
          deletedPhotoIds.push(p.id);
        } else {
          failedCount++;
        }
      }

      if (deletedPhotoIds.length > 0) {
        await prisma.deliveryPhoto.deleteMany({
          where: { id: { in: deletedPhotoIds } },
        });
      }

      // 2. Bersihkan dari DeliveryOrder.proofImage
      const dosWithProof = await prisma.deliveryOrder.findMany({
        where: {
          proofImage: { not: null },
          createdAt: { lt: cutoffDate },
        },
        select: { id: true, proofImage: true },
      });

      const clearedDoIds: string[] = [];
      for (const d of dosWithProof) {
        if (!d.proofImage) continue;
        const res = await tryDeleteR2File(d.proofImage);
        if (res === "deleted") {
          deletedCount++;
          clearedDoIds.push(d.id);
        } else if (res === "not-r2") {
          skippedCount++;
          clearedDoIds.push(d.id);
        } else {
          failedCount++;
        }
      }

      if (clearedDoIds.length > 0) {
        await prisma.deliveryOrder.updateMany({
          where: { id: { in: clearedDoIds } },
          data: { proofImage: null },
        });
      }

      // 3. Bersihkan legacy tag [BUKTI_KIRIM] DAN [FOTO_LOKASI] dari notes.
      const dosWithNotes = await prisma.deliveryOrder.findMany({
        where: {
          OR: [
            { notes: { contains: "[BUKTI_KIRIM]" } },
            { notes: { contains: "[FOTO_LOKASI]" } },
          ],
          createdAt: { lt: cutoffDate },
        },
        select: { id: true, notes: true },
      });

      for (const item of dosWithNotes) {
        if (!item.notes) continue;
        const { cleaned, changed } = await cleanNoteTags(item.notes, ["BUKTI_KIRIM", "FOTO_LOKASI"]);
        if (changed) {
          await prisma.deliveryOrder.update({
            where: { id: item.id },
            data: { notes: cleaned || null },
          });
        }
      }

      audit();
      return NextResponse.json({
        success: true,
        deletedCount,
        skippedCount,
        failedCount,
        message: `Berhasil membersihkan ${deletedCount} foto bukti pengiriman (lebih dari ${days} hari) dari Cloudflare R2.${failedCount > 0 ? ` ${failedCount} gagal dihapus dari R2 dan dipertahankan — lihat status DELETE_FAILED di halaman Penyimpanan.` : ""}`,
      });
    }

    // TARGET 4: Hapus Bukti Transfer & Pembayaran (Payment Proofs)
    if (target === "PAYMENT_PROOFS") {
      // 1. Sales
      const sales = await prisma.sale.findMany({
        where: {
          notes: { contains: "[BUKTI_TF]" },
          createdAt: { lt: cutoffDate },
        },
        select: { id: true, notes: true },
      });

      for (const sale of sales) {
        if (!sale.notes) continue;
        const { cleaned, changed } = await cleanNoteTags(sale.notes, ["BUKTI_TF"]);
        if (changed) {
          await prisma.sale.update({
            where: { id: sale.id },
            data: { notes: cleaned || null },
          });
        }
      }

      // 2. Debt Payments
      const payments = await prisma.debtPayment.findMany({
        where: {
          notes: { contains: "[BUKTI_TF]" },
          createdAt: { lt: cutoffDate },
        },
        select: { id: true, notes: true },
      });

      for (const p of payments) {
        if (!p.notes) continue;
        const { cleaned, changed } = await cleanNoteTags(p.notes, ["BUKTI_TF"]);
        if (changed) {
          await prisma.debtPayment.update({
            where: { id: p.id },
            data: { notes: cleaned || null },
          });
        }
      }

      audit();
      return NextResponse.json({
        success: true,
        deletedCount,
        skippedCount,
        failedCount,
        message: `Berhasil membersihkan ${deletedCount} foto bukti transfer (lebih dari ${days} hari) dari Cloudflare R2.${failedCount > 0 ? ` ${failedCount} gagal dihapus dari R2 dan dipertahankan — lihat status DELETE_FAILED di halaman Penyimpanan.` : ""}`,
      });
    }

    // TARGET 5: Hapus Gambar Hero / Banner
    if (target === "HERO_IMAGES") {
      const heroes = await prisma.heroImage.findMany({
        where: { createdAt: { lt: cutoffDate } },
        select: { id: true, imageUrl: true },
      });

      const deletedIds: string[] = [];
      for (const h of heroes) {
        const res = await tryDeleteR2File(h.imageUrl);
        if (res === "deleted") {
          deletedCount++;
          deletedIds.push(h.id);
        } else if (res === "not-r2") {
          skippedCount++;
          deletedIds.push(h.id);
        } else {
          failedCount++;
        }
      }

      if (deletedIds.length > 0) {
        await prisma.heroImage.deleteMany({ where: { id: { in: deletedIds } } });
      }

      audit();
      return NextResponse.json({
        success: true,
        deletedCount,
        skippedCount,
        failedCount,
        message: `Berhasil menghapus ${deletedCount} gambar hero (lebih dari ${days} hari) dari Cloudflare R2 & database.${failedCount > 0 ? ` ${failedCount} gagal dihapus dari R2 dan dipertahankan — lihat status DELETE_FAILED di halaman Penyimpanan.` : ""}`,
      });
    }

    return NextResponse.json(
      { error: "Target pembersihan tidak valid atau data tidak lengkap" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[STORAGE_CLEANUP_EXECUTE_ERROR]", error);
    return NextResponse.json(
      { error: "Gagal menjalankan pembersihan penyimpanan" },
      { status: 500 }
    );
  }
}
