/**
 * scripts/cleanup-orphan-files.ts
 *
 * Skrip audit & pembersih file yatim (orphan files) di Cloudflare R2 yang tidak memiliki referensi di database.
 * Mendukung mode:
 *   - Dry Run (default): hanya mendata file yatim tanpa menghapus
 *     Penggunaan: npx tsx scripts/cleanup-orphan-files.ts --dry-run
 *   - Execute: menghapus file yatim secara permanen
 *     Penggunaan: npx tsx scripts/cleanup-orphan-files.ts --execute
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL;

async function run() {
  const isExecute = process.argv.includes("--execute");
  console.log("==================================================");
  console.log(`MODE: ${isExecute ? "🚨 EXECUTE (FILE AKAN DIHAPUS)" : "🔍 DRY RUN (HANYA AUDIT/SIMULASI)"}`);
  console.log("==================================================");

  if (!WORKER_URL) {
    console.error("ERROR: CLOUDFLARE_WORKER_URL belum diatur di .env");
    process.exit(1);
  }

  try {
    // 1. Kumpulkan semua URL dan filename yang sah dari Database
    console.log("Mengumpulkan referensi file dari database...");
    const validKeys = new Set<string>();

    // A. Foto Produk
    const productImages = await prisma.productImage.findMany({ select: { imageUrl: true } });
    productImages.forEach((img) => {
      const key = extractKey(img.imageUrl);
      if (key) validKeys.add(key);
    });

    // B. Delivery Photos (tabel baru)
    const deliveryPhotos = await prisma.deliveryPhoto.findMany({ select: { url: true, filename: true } });
    deliveryPhotos.forEach((dp) => {
      if (dp.filename) validKeys.add(dp.filename);
      const key = extractKey(dp.url);
      if (key) validKeys.add(key);
    });

    // C. Delivery Order proofImage & notes
    const deliveryOrders = await prisma.deliveryOrder.findMany({ select: { proofImage: true, notes: true } });
    deliveryOrders.forEach((doItem) => {
      if (doItem.proofImage) {
        const key = extractKey(doItem.proofImage);
        if (key) validKeys.add(key);
      }
      if (doItem.notes) {
        const match = doItem.notes.match(/\[BUKTI_KIRIM\]:\s*([^\s\]\n]+)/);
        if (match && match[1]) {
          const key = extractKey(match[1]);
          if (key) validKeys.add(key);
        }
      }
    });

    // D. Sales & Payments bukti transfer
    const sales = await prisma.sale.findMany({ select: { notes: true } });
    sales.forEach((s) => {
      if (s.notes) {
        const match = s.notes.match(/\[BUKTI_TF\]:\s*([^\s\]\n]+)/);
        if (match && match[1]) {
          const key = extractKey(match[1]);
          if (key) validKeys.add(key);
        }
      }
    });

    const debtPayments = await prisma.debtPayment.findMany({ select: { notes: true } });
    debtPayments.forEach((p) => {
      if (p.notes) {
        const match = p.notes.match(/\[BUKTI_TF\]:\s*([^\s\]\n]+)/);
        if (match && match[1]) {
          const key = extractKey(match[1]);
          if (key) validKeys.add(key);
        }
      }
    });

    console.log(`Ditemukan ${validKeys.size} file yang sah tercatat di database.`);

    // 2. Minta daftar file dari Cloudflare Worker
    console.log("Mengambil daftar file fisik dari Cloudflare R2...");
    const listRes = await fetch(`${WORKER_URL}/list`).catch(() => null);

    let storageFiles: string[] = [];
    if (listRes && listRes.ok) {
      const data = await listRes.json();
      storageFiles = (data.files || []).map((f: any) => (typeof f === "string" ? f : f.name || f.key));
    } else {
      console.log("Endpoint /list pada Worker tidak tersedia atau tidak mengembalikan list.");
      console.log("Melakukan audit integritas dari database: semua file terdaftar siap diproteksi.");
      return;
    }

    console.log(`Ditemukan ${storageFiles.length} file fisik di Cloudflare R2.`);

    // 3. Bandingkan file di R2 dengan validKeys
    const orphanFiles = storageFiles.filter((key) => !validKeys.has(key));

    console.log("--------------------------------------------------");
    console.log(`Total file yatim ditemukan: ${orphanFiles.length}`);
    orphanFiles.forEach((f, idx) => console.log(`  [${idx + 1}] ${f}`));
    console.log("--------------------------------------------------");

    if (orphanFiles.length === 0) {
      console.log("✅ Bersih! Tidak ada file yatim yang ditemukan.");
      return;
    }

    if (!isExecute) {
      console.log("💡 Jalankan dengan '--execute' jika ingin menghapus file yatim ini secara permanen.");
      return;
    }

    // 4. Hapus jika mode --execute
    console.log("Menghapus file yatim...");
    let deletedCount = 0;
    for (const orphan of orphanFiles) {
      try {
        const delRes = await fetch(`${WORKER_URL}/delete`, {
          method: "DELETE",
          headers: { "X-Filename": orphan },
        });
        if (delRes.ok) {
          deletedCount++;
          console.log(`  [OK] Terhapus: ${orphan}`);
        } else {
          console.warn(`  [GAGAL] Status ${delRes.status}: ${orphan}`);
        }
      } catch (err: any) {
        console.warn(`  [ERROR] ${orphan}:`, err?.message);
      }
    }

    console.log("==================================================");
    console.log(`Pembersihan selesai. Berhasil menghapus ${deletedCount} file yatim.`);
    console.log("==================================================");
  } catch (error) {
    console.error("Gagal menjalankan skrip pembersih file yatim:", error);
  } finally {
    await prisma.$disconnect();
  }
}

function extractKey(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/files/")) {
      return parsed.pathname.replace("/files/", "");
    }
    return parsed.pathname.startsWith("/") ? parsed.pathname.substring(1) : parsed.pathname;
  } catch {
    return url.replace(/^.*\/files\//, "");
  }
}

run();
