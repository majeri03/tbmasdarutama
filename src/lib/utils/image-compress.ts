/**
 * image-compress.ts — Kompresi gambar di browser sebelum upload (22 Nov 2026).
 *
 * Masalah: web mengunggah file ASLI (sampai 5MB) tanpa kompres sama sekali,
 * sementara APK mengompres agresif (bukti 900px/kualitas 0.55, produk
 * 150px/0.1). Satu foto produk dari web bisa 50-100x lebih besar dari foto
 * APK — penyumbang kuota R2 gratis terbesar.
 *
 * Aturan: gambar di-resize ke maks 900px (sisi terpanjang) dan kualitas
 * ~0.6 — sama seperti APK. File yang sudah kecil (<150KB) dibiarkan apa
 * adanya. PNG dipertahankan sebagai PNG (transparansi), JPEG/WebP jadi JPEG.
 */

/** Muat File menjadi HTMLImageElement. */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal membaca gambar"));
    };
    img.src = url;
  });
}

/**
 * Kompres satu file gambar. Mengembalikan File baru (atau file asli kalau
 * sudah kecil / gagal dikompres — upload tetap jalan).
 */
export async function compressImageFile(
  file: File,
  options?: { maxWidth?: number; quality?: number }
): Promise<File> {
  const maxWidth = options?.maxWidth ?? 900;
  const quality = options?.quality ?? 0.6;

  // File kecil tidak perlu dikompres.
  if (file.size <= 150 * 1024) return file;
  if (!file.type.startsWith("image/")) return file;
  // SVG tidak boleh masuk (sudah diblokir server), jangan disentuh.
  if (file.type === "image/svg+xml") return file;

  try {
    const img = await loadImage(file);
    const scale = Math.min(1, maxWidth / Math.max(img.width, img.height));
    if (scale >= 1 && file.type !== "image/png") {
      // Sudah cukup kecil dimensinya; kompres kualitas saja untuk JPEG/WebP.
    }
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const outMime = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, outMime, quality)
    );
    if (!blob) return file;

    const ext = outMime === "image/png" ? "png" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    const compressed = new File([blob], `${baseName}.${ext}`, {
      type: outMime,
      lastModified: Date.now(),
    });
    // Kalau hasil kompres malah lebih besar (mis. PNG ramai), pakai aslinya.
    return compressed.size < file.size ? compressed : file;
  } catch (e) {
    console.warn("[IMAGE_COMPRESS_WARN] Gagal kompres, upload file asli:", e);
    return file;
  }
}
