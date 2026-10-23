import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/utils/api";
import prisma from "@/lib/prisma";

const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL;

// Helper to extract Cloudflare R2 filename from URL
function extractFilenameFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // Format biasanya: /files/folder/filename.ext atau /folder/filename.ext
    const pathname = urlObj.pathname;
    if (pathname.startsWith("/files/")) {
      return pathname.replace("/files/", "");
    }
    return pathname.startsWith("/") ? pathname.substring(1) : pathname;
  } catch {
    // If not a full URL, maybe already a relative path
    return url.replace(/^.*\/files\//, "");
  }
}

// Helper to delete a file from Cloudflare R2 via worker
async function deleteFromWorker(filename: string): Promise<boolean> {
  if (!WORKER_URL) return false;
  try {
    const res = await fetch(`${WORKER_URL}/delete`, {
      method: "DELETE",
      headers: {
        "X-Filename": filename,
      },
    });
    return res.ok;
  } catch (err) {
    console.warn(`[WORKER_DELETE_WARN] Failed to delete ${filename}:`, err);
    return false;
  }
}

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

    const categoryStats = categories.map((cat: any) => {
      let imageCount = 0;
      cat.products.forEach((p: any) => {
        imageCount += p.productImages.length;
      });
      return {
        id: cat.id,
        name: cat.name,
        productCount: cat.products.length,
        imageCount,
        estimatedSizeKB: imageCount * 45, // Rata-rata ~45KB setelah optimasi
      };
    });

    // 2. Total Semua Gambar Produk
    const totalProductImages = await prisma.productImage.count();

    // 3. Bukti Pengiriman (Delivery Order)
    const allDeliveryOrders = await prisma.deliveryOrder.findMany({
      where: {
        notes: {
          contains: "[BUKTI_KIRIM]",
        },
      },
      select: {
        id: true,
        createdAt: true,
        notes: true,
      },
    });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const deliveryProofTotal = allDeliveryOrders.length;
    const deliveryProofOlder30Days = allDeliveryOrders.filter(
      (d: any) => new Date(d.createdAt) < thirtyDaysAgo
    ).length;
    const deliveryProofOlder60Days = allDeliveryOrders.filter(
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

    const totalDetectedImages =
      totalProductImages + deliveryProofTotal + paymentProofTotal + heroImageCount;
    const estimatedTotalKB = totalDetectedImages * 50;
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
          },
          paymentProofs: {
            total: paymentProofTotal,
            olderThan30Days: paymentProofOlder30Days,
          },
          heroImages: heroImageCount,
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

      for (const img of images) {
        const filename = extractFilenameFromUrl(img.imageUrl);
        if (filename) await deleteFromWorker(filename);
      }

      const res = await prisma.productImage.deleteMany({
        where: {
          product: {
            categoryId: categoryId,
          },
        },
      });

      deletedCount = res.count;

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
        if (filename) await deleteFromWorker(filename);
      }

      const res = await prisma.productImage.deleteMany();
      deletedCount = res.count;

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

      const whereClause: any = {
        notes: {
          contains: "[BUKTI_KIRIM]",
        },
      };

      if (cutoffDate) {
        whereClause.createdAt = {
          lt: cutoffDate,
        };
      }

      const dos = await prisma.deliveryOrder.findMany({
        where: whereClause,
        select: { id: true, notes: true },
      });

      for (const item of dos) {
        if (!item.notes) continue;
        const match = item.notes.match(/\[BUKTI_KIRIM\]:\s*([^\s\]\n]+)/);
        if (match && match[1]) {
          const filename = extractFilenameFromUrl(match[1]);
          if (filename) await deleteFromWorker(filename);
          deletedCount++;
        }

        // Clean the tag from notes
        const cleanedNotes = item.notes
          .replace(/\[BUKTI_KIRIM\]:\s*[^\s\]\n]+/g, "")
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

      for (const sale of sales) {
        if (!sale.notes) continue;
        const match = sale.notes.match(/\[BUKTI_TF\]:\s*([^\s\]\n]+)/);
        if (match && match[1]) {
          const filename = extractFilenameFromUrl(match[1]);
          if (filename) await deleteFromWorker(filename);
          deletedCount++;
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
        const match = p.notes.match(/\[BUKTI_TF\]:\s*([^\s\]\n]+)/);
        if (match && match[1]) {
          const filename = extractFilenameFromUrl(match[1]);
          if (filename) await deleteFromWorker(filename);
          deletedCount++;
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
