import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/utils/api";
import {
  trackUpload,
  confirmR2File,
  deleteR2FileByUrl,
  countUserUploadsToday,
} from "@/lib/utils/r2-tracking";

// WS-9 (26 Nov 2026, fitur Profil): foto profil user.
//
// Endpoint khusus avatar — SENGAJA tidak memakai /api/upload:
// - /api/upload adalah jalur umum (produk, bukti kirim, logo toko) dengan
//   batas 5 MB dan folder allowlist-nya sendiri. Avatar punya aturan
//   sendiri (maks 2 MB, folder "avatars") dan harus mengikat file ke
//   User.avatarUrl + menghapus avatar lama, jadi jalurnya dipisah supaya
//   perubahan di sini TIDAK BISA merusak upload logo toko.
// - Deteksi magic byte di bawah ini sengaja diduplikasi dari
//   /api/upload (bukan diimpor) dengan alasan yang sama: /api/upload
//   tidak disentuh sama sekali oleh patch ini.
//
// Alur simpan (POST):
//   upload file baru ke R2 (folder "avatars") -> catat R2File (PENDING)
//   -> konfirmasi ACTIVE + owner AVATAR/userId -> simpan avatarUrl baru
//   ke User -> hapus avatar LAMA dari R2 (best-effort; kalau gagal,
//   baris R2File lama ditandai DELETE_FAILED dan bisa di-retry dari
//   halaman Penyimpanan, bukan dihapus diam-diam).
// Alur hapus (DELETE):
//   hapus file dari R2 dulu -> baru kosongkan User.avatarUrl. Kalau hapus
//   R2 gagal, avatarUrl dipertahankan dan klien diminta coba lagi.

const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL;

// Batas foto profil: maks 2 MB, hanya JPG/PNG/WebP.
// Angka yang sama ditegakkan di client (tab Profil web + layar Profil
// APK) dan ditampilkan ke user di UI ("Maks. 2 MB • JPG, PNG, WebP").
export const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024;
const AVATAR_FOLDER = "avatars";

// Sama seperti /api/upload: batas 100 upload/hari/user (dihitung dari
// R2File) supaya satu akun tidak menghabiskan kuota R2 sendirian.
const DAILY_UPLOAD_LIMIT = 100;

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Deteksi jenis gambar dari isi file (magic byte), bukan dari klaim klien.
 * JPEG FF D8 FF, PNG 89 50 4E 47 0D 0A 1A 0A, WebP RIFF....WEBP.
 * (Duplikat dari /api/upload — lihat komentar di atas.)
 */
function detectImageType(bytes: Uint8Array): "jpg" | "png" | "webp" | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "jpg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "webp";
  }
  return null;
}

if (!WORKER_URL) {
  throw new Error("CLOUDFLARE_WORKER_URL is not configured in .env");
}

/**
 * POST /api/profile/avatar
 * Upload / ganti foto profil. Body: multipart FormData { file }.
 * Mengembalikan { avatarUrl } (URL publik R2).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user?.id) return unauthorizedResponse();
    const userId = session.user.id;

    // WS-1 (27 Nov 2026): multipart yang rusak (mis. tanpa boundary dari
    // klien lama) dulu jatuh ke catch umum -> 500 generik "Gagal
    // mengunggah foto profil." Sekarang 400 dengan pesan yang jelas.
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return validationErrorResponse(
        "Foto tidak terbaca server (format pengiriman rusak). Perbarui aplikasi ke versi terbaru lalu coba lagi."
      );
    }
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return validationErrorResponse("Tidak ada file yang diunggah.");
    }

    // Validasi tipe dari klaim klien dulu, lalu dari isi file (magic byte).
    const extension = ALLOWED_MIME[file.type];
    if (!extension) {
      return validationErrorResponse(
        "File harus berupa gambar (JPG, PNG, atau WebP)."
      );
    }
    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      return validationErrorResponse(
        "Ukuran foto maksimal 2 MB. Pilih foto yang lebih kecil."
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    if (detectImageType(bytes) !== extension) {
      return validationErrorResponse(
        "Isi file bukan gambar yang valid (JPG, PNG, atau WebP)."
      );
    }

    const uploadsToday = await countUserUploadsToday(userId);
    if (uploadsToday >= DAILY_UPLOAD_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error: "Batas upload harian tercapai (100 file/hari). Coba lagi besok.",
        },
        { status: 429 }
      );
    }

    // Avatar lama dibaca dulu — dihapus SETELAH avatar baru tersimpan,
    // supaya kalau upload baru gagal, foto lama tetap utuh.
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    if (!current) return unauthorizedResponse("User tidak ditemukan.");
    const oldAvatarUrl = current.avatarUrl;

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const filename = `${AVATAR_FOLDER}/${userId}-${timestamp}-${randomString}.${extension}`;

    const uploadResponse = await fetch(`${WORKER_URL}/upload`, {
      method: "POST",
      headers: {
        "X-Filename": filename,
        "X-Content-Type": file.type,
      },
      body: arrayBuffer,
    });
    if (!uploadResponse.ok) {
      // WS-1: dulu throw -> catch umum -> 500 generik, padahal penyebabnya
      // Worker/R2. Sekarang 502 dengan pesan yang menjelaskan penyebabnya.
      const errorText = await uploadResponse.text();
      console.error("[AVATAR_UPLOAD_ERROR]", uploadResponse.status, errorText);
      return errorResponse(
        "Foto gagal disimpan ke penyimpanan (Cloudflare). Coba lagi nanti.",
        502
      );
    }
    const result = await uploadResponse.json();
    // WS-1: Worker yang tidak mengembalikan URL dulu diteruskan begitu saja
    // (avatarUrl undefined -> update User gagal di Prisma -> 500 generik).
    if (!result?.url || typeof result.url !== "string") {
      console.error("[AVATAR_UPLOAD_ERROR] Worker tidak mengembalikan URL:", result);
      return errorResponse(
        "Server penyimpanan tidak mengembalikan alamat foto. Coba lagi nanti.",
        502
      );
    }

    const tracked = await trackUpload({
      r2Key: filename,
      url: result.url,
      sizeBytes: file.size,
      mimeType: file.type,
      folder: AVATAR_FOLDER,
      uploadedById: userId,
    });
    if (!tracked) {
      console.warn(
        "[AVATAR_UPLOAD_UNTRACKED] File terunggah tapi tidak tercatat di R2File:",
        filename
      );
    }
    await confirmR2File(result.url, "AVATAR", userId);

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: result.url },
    });

    // Hapus avatar lama dari R2 supaya tidak menumpuk file sampah.
    // Best-effort: kalau gagal, jejak DB-nya ditandai DELETE_FAILED oleh
    // deleteR2FileByUrl dan bisa di-retry dari halaman Penyimpanan.
    if (oldAvatarUrl && oldAvatarUrl !== result.url) {
      const deleted = await deleteR2FileByUrl(oldAvatarUrl);
      if (!deleted) {
        console.warn(
          "[AVATAR_OLD_DELETE_WARN] Avatar lama gagal dihapus dari R2:",
          oldAvatarUrl
        );
      }
    }

    return successResponse(
      { avatarUrl: result.url as string },
      "Foto profil berhasil diunggah."
    );
  } catch (error) {
    console.error("[API_PROFILE_AVATAR_POST_ERROR]", error);
    return errorResponse("Gagal mengunggah foto profil.");
  }
}

/**
 * DELETE /api/profile/avatar
 * Hapus foto profil: hapus file dari R2 dulu, baru kosongkan avatarUrl.
 */
export async function DELETE() {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user?.id) return unauthorizedResponse();
    const userId = session.user.id;

    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    if (!current) return unauthorizedResponse("User tidak ditemukan.");
    if (!current.avatarUrl) {
      return successResponse(
        { avatarUrl: null },
        "Tidak ada foto profil untuk dihapus."
      );
    }

    const deleted = await deleteR2FileByUrl(current.avatarUrl);
    if (!deleted) {
      return errorResponse(
        "Gagal menghapus foto dari penyimpanan. Coba lagi nanti."
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    return successResponse(
      { avatarUrl: null },
      "Foto profil berhasil dihapus."
    );
  } catch (error) {
    console.error("[API_PROFILE_AVATAR_DELETE_ERROR]", error);
    return errorResponse("Gagal menghapus foto profil.");
  }
}
