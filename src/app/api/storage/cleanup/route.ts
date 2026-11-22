import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/utils/api";
import prisma from "@/lib/prisma";
import { deleteFromR2, extractR2Filename } from "@/lib/utils/storage";
import { markR2FilesDeletedByKeys } from "@/lib/utils/r2-tracking";

// Alias helper for consistency
const extractFilenameFromUrl = extractR2Filename;
const deleteFromWorker = deleteFromR2;

/**
 * GET /api/storage/cleanup
 * Mendapatkan data statistik penggunaan gambar Cloudflare R2 per kategori.
 */
export async function GET() {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check: Admin / Super Admin only
    if (session.user.role === "KASIR") {
      return NextResponse.json(
        { error: "Hanya Admin / Super Admin yang dapat membersihkan penyimpanan." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { target, categoryId, olderThanDays } = body;

    let deletedCount = 0;

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
        },
        select: { id: true, imageUrl: true },
      });

      // FIX (22 Nov 2026, R2): deletedCount hanya naik kalau hapus R2
      // benar-benar berhasil; baris pelacakan ikut ditandai DELETED.
      for (const img of images) {
        const filename = extractFilenameFromUrl(img.imageUrl);
        if (filename) {
          const ok = await deleteFromWorker(filename);
          if (ok) {
            deletedCount++;
            await markR2FilesDeletedByKeys([filename]);
          }
        }
      }

      await prisma.productImage.deleteMany({
        where: {
          product: {
            categoryId: categoryId,
          },
        },
      });

      return NextResponse.json({
        success: true,
        deletedCount,
        message: `Berhasil menghapus ${deletedCount} foto produk pada kategori "${category?.name || "Kategori"}".`,
      });
    }

    // TARGET 2: Hapus SEMUA Gambar Produk
    if (target === "ALL_PRODUCTS") {
      const images = await prisma.productImage.findMany({
        select: { id: true, imageUrl: true },
      });

      for (const img of images) {
        const filename = extractFilenameFromUrl(img.imageUrl);
        if (filename) {
          const ok = await deleteFromWorker(filename);
          if (ok) {
            deletedCount++;
            await markR2FilesDeletedByKeys([filename]);
          }
        }
      }

      await prisma.productImage.deleteMany();

      return NextResponse.json({
        success: true,
        deletedCount,
        message: `Berhasil menghapus semua (${deletedCount}) foto produk dari Cloudflare R2 & database.`,
      });
    }

    // TARGET 3: Hapus Bukti Pengiriman (Delivery Proofs)
    if (target === "DELIVERY_PROOFS") {
      const cutoffDate = olderThanDays
        ? new Date(Date.now() - Number(olderThanDays) * 24 * 60 * 60 * 1000)
        : null;

      // 1. Bersihkan dari tabel DeliveryPhoto
      const photosWhere: any = {};
      if (cutoffDate) photosWhere.createdAt = { lt: cutoffDate };

      const photos = await prisma.deliveryPhoto.findMany({
        where: photosWhere,
        select: { id: true, filename: true, url: true },
      });

      // FIX (22 Nov 2026, R2): deletedCount hanya naik kalau hapus R2
      // benar-benar berhasil (sebelumnya naik walau gagal / filename null).
      for (const p of photos) {
        const fileToDelete = p.filename || extractFilenameFromUrl(p.url);
        if (fileToDelete) {
          const ok = await deleteFromWorker(fileToDelete);
          if (ok) {
            deletedCount++;
            await markR2FilesDeletedByKeys([fileToDelete]);
          }
        }
      }

      await prisma.deliveryPhoto.deleteMany({
        where: photosWhere,
      });

      // 2. Bersihkan dari DeliveryOrder.proofImage
      const doWhere: any = { proofImage: { not: null } };
      if (cutoffDate) doWhere.createdAt = { lt: cutoffDate };

      const dosWithProof = await prisma.deliveryOrder.findMany({
        where: doWhere,
        select: { id: true, proofImage: true },
      });

      for (const d of dosWithProof) {
        if (d.proofImage) {
          const fn = extractFilenameFromUrl(d.proofImage);
          if (fn) {
            const ok = await deleteFromWorker(fn);
            if (ok) {
              deletedCount++;
              await markR2FilesDeletedByKeys([fn]);
            }
          }
        }
      }

      await prisma.deliveryOrder.updateMany({
        where: doWhere,
        data: { proofImage: null },
      });

      // 3. Bersihkan legacy tag [BUKTI_KIRIM] DAN [FOTO_LOKASI] dari notes.
      // FIX (22 Nov 2026, R2): hapus SEMUA tag dalam satu note (dulu hanya
      // match pertama), dan [FOTO_LOKASI] yang dulu tidak pernah dibersihkan.
      const notesWhere: any = {
        OR: [
          { notes: { contains: "[BUKTI_KIRIM]" } },
          { notes: { contains: "[FOTO_LOKASI]" } },
        ],
      };
      if (cutoffDate) notesWhere.createdAt = { lt: cutoffDate };

      const dosWithNotes = await prisma.deliveryOrder.findMany({
        where: notesWhere,
        select: { id: true, notes: true },
      });

      for (const item of dosWithNotes) {
        if (!item.notes) continue;
        for (const tag of ["BUKTI_KIRIM", "FOTO_LOKASI"]) {
          const re = new RegExp(`\\[${tag}\\]:\\s*([^\\s\\]\\n]+)`, "g");
          let m: RegExpExecArray | null;
          while ((m = re.exec(item.notes)) !== null) {
            if (m[1]) {
              const filename = extractFilenameFromUrl(m[1]);
              if (filename) {
                const ok = await deleteFromWorker(filename);
                if (ok) {
                  deletedCount++;
                  await markR2FilesDeletedByKeys([filename]);
                }
              }
            }
          }
        }

        const cleanedNotes = item.notes
          .replace(/\[BUKTI_KIRIM\]:\s*[^\s\]\n]+/g, "")
          .replace(/\[FOTO_LOKASI\]:\s*[^\s\]\n]+/g, "")
          .trim();

        await prisma.deliveryOrder.update({
          where: { id: item.id },
          data: { notes: cleanedNotes || null },
        });
      }

      return NextResponse.json({
        success: true,
        deletedCount,
        message: `Berhasil membersihkan ${deletedCount} foto bukti pengiriman dari Cloudflare R2.`,
      });
    }

    // TARGET 4: Hapus Bukti Transfer & Pembayaran (Payment Proofs)
    if (target === "PAYMENT_PROOFS") {
      const cutoffDate = olderThanDays
        ? new Date(Date.now() - Number(olderThanDays) * 24 * 60 * 60 * 1000)
        : null;

      // 1. Sales
      const salesWhere: any = {
        notes: {
          contains: "[BUKTI_TF]",
        },
      };
      if (cutoffDate) salesWhere.createdAt = { lt: cutoffDate };

      const sales = await prisma.sale.findMany({
        where: salesWhere,
        select: { id: true, notes: true },
      });

      // FIX (22 Nov 2026, R2): hapus SEMUA tag dalam satu note (dulu hanya
      // match pertama) dan hitung hanya kalau hapus R2 benar-benar berhasil.
      for (const sale of sales) {
        if (!sale.notes) continue;
        const re = /\[BUKTI_TF\]:\s*([^\s\]\n]+)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(sale.notes)) !== null) {
          if (m[1]) {
            const filename = extractFilenameFromUrl(m[1]);
            if (filename) {
              const ok = await deleteFromWorker(filename);
              if (ok) {
                deletedCount++;
                await markR2FilesDeletedByKeys([filename]);
              }
            }
          }
        }

        const cleanedNotes = sale.notes
          .replace(/\[BUKTI_TF\]:\s*[^\s\]\n]+/g, "")
          .trim();

        await prisma.sale.update({
          where: { id: sale.id },
          data: { notes: cleanedNotes || null },
        });
      }

      // 2. Debt Payments
      const debtsWhere: any = {
        notes: {
          contains: "[BUKTI_TF]",
        },
      };
      if (cutoffDate) debtsWhere.createdAt = { lt: cutoffDate };

      const payments = await prisma.debtPayment.findMany({
        where: debtsWhere,
        select: { id: true, notes: true },
      });

      for (const p of payments) {
        if (!p.notes) continue;
        const re = /\[BUKTI_TF\]:\s*([^\s\]\n]+)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(p.notes)) !== null) {
          if (m[1]) {
            const filename = extractFilenameFromUrl(m[1]);
            if (filename) {
              const ok = await deleteFromWorker(filename);
              if (ok) {
                deletedCount++;
                await markR2FilesDeletedByKeys([filename]);
              }
            }
          }
        }

        const cleanedNotes = p.notes
          .replace(/\[BUKTI_TF\]:\s*[^\s\]\n]+/g, "")
          .trim();

        await prisma.debtPayment.update({
          where: { id: p.id },
          data: { notes: cleanedNotes || null },
        });
      }

      return NextResponse.json({
        success: true,
        deletedCount,
        message: `Berhasil membersihkan ${deletedCount} foto bukti transfer dari Cloudflare R2.`,
      });
    }

    // TARGET 5: Hapus Gambar Hero / Banner
    // FIX (22 Nov 2026, R2): cabang ini dideklarasikan di tipe APK
    // (storage.service.ts) tapi TIDAK ADA di backend — ditekan selalu 400.
    if (target === "HERO_IMAGES") {
      const cutoffDate = olderThanDays
        ? new Date(Date.now() - Number(olderThanDays) * 24 * 60 * 60 * 1000)
        : null;

      const heroWhere: any = {};
      if (cutoffDate) heroWhere.createdAt = { lt: cutoffDate };

      const heroes = await prisma.heroImage.findMany({
        where: heroWhere,
        select: { id: true, imageUrl: true },
      });

      for (const h of heroes) {
        const filename = extractFilenameFromUrl(h.imageUrl);
        if (filename) {
          const ok = await deleteFromWorker(filename);
          if (ok) {
            deletedCount++;
            await markR2FilesDeletedByKeys([filename]);
          }
        }
      }

      await prisma.heroImage.deleteMany({ where: heroWhere });

      return NextResponse.json({
        success: true,
        deletedCount,
        message: `Berhasil menghapus ${deletedCount} gambar hero dari Cloudflare R2 & database.`,
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
