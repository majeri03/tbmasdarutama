import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/utils/api";
import {
  trackUpload,
  markR2FilesDeletedByKeys,
  countUserUploadsToday,
} from "@/lib/utils/r2-tracking";
import { extractR2Filename } from "@/lib/utils/storage";

// ✅ Only need Worker URL
const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL;

// FIX (22 Nov 2026, pentest M15): folder R2 hanya dari allowlist ini.
// Pemakaian di kode: products (gambar produk), proofs_delivery (bukti
// kirim), proofs_payment (bukti bayar), heroes (gambar hero), logos (logo
// toko). Folder lain ditolak — sebelumnya folder bebas diisi klien.
const ALLOWED_FOLDERS = [
  "products",
  "proofs_delivery",
  "proofs_payment",
  "heroes",
  "logos",
] as const;

// FIX (22 Nov 2026, pentest M15): batas upload per user per hari supaya
// satu akun tidak bisa menghabiskan kuota R2 10 GB sendirian. Dihitung
// dari baris R2File (DB), jadi berlaku lintas instance Vercel.
const DAILY_UPLOAD_LIMIT = 100;

/**
 * Deteksi jenis gambar dari isi file (magic byte), bukan dari klaim klien.
 * FIX (22 Nov 2026, pentest M15): sebelumnya tipe hanya dicek dari
 * `file.type` kiriman klien — file teks/HTML yang mengaku image/jpeg
 * lolos dan tersimpan sebagai .jpg. Sekarang isi file harus cocok dengan
 * tipe yang diklaim: JPEG FF D8 FF, PNG 89 50 4E 47 0D 0A 1A 0A,
 * WebP RIFF....WEBP.
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

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    // SECURITY FIX (Nov 2026, H7): sebelumnya `image/*` lolos untuk SVG
    // (`image/svg+xml`) — file SVG yang diunggah lalu dibuka bisa menjalankan
    // script (stored XSS). Sekarang hanya jpg/png/webp, dan ekstensi diambil
    // dari MIME yang sudah di-allowlist, bukan dari nama file.
    const ALLOWED_MIME: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const extension = ALLOWED_MIME[file.type];
    if (!extension) {
      return NextResponse.json(
        { error: "File harus berupa gambar (jpg, png, webp)" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Ukuran file maksimal 5MB" },
        { status: 400 }
      );
    }

    // Convert file to buffer + validasi magic byte (isi file harus benar-
    // benar gambar sesuai tipe yang diklaim — lihat detectImageType).
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const detectedType = detectImageType(bytes);
    if (detectedType !== extension) {
      return NextResponse.json(
        { error: "Isi file bukan gambar yang valid (jpg, png, webp)" },
        { status: 400 }
      );
    }

    // FIX (22 Nov 2026, pentest M15): folder HANYA dari allowlist.
    // Sebelumnya folder bebas diisi klien setelah sanitasi karakter.
    const requestedFolder = (formData.get("folder") as string) || "products";
    if (
      !(ALLOWED_FOLDERS as readonly string[]).includes(requestedFolder)
    ) {
      return NextResponse.json(
        { error: "Folder upload tidak diizinkan" },
        { status: 400 }
      );
    }
    const cleanFolder = requestedFolder;

    // FIX (22 Nov 2026, pentest M15): batas 100 upload/hari/user
    // (dihitung dari R2File). KASIR tetap boleh upload — ini hanya
    // mencegah satu akun menghabiskan kuota R2 sendirian.
    const uploadsToday = await countUserUploadsToday(session.user.id);
    if (uploadsToday >= DAILY_UPLOAD_LIMIT) {
      return NextResponse.json(
        { error: "Batas upload harian tercapai (100 file/hari). Coba lagi besok." },
        { status: 429 }
      );
    }

    // Generate unique filename with optional custom folder (e.g., proofs_delivery, proofs_payment, products)
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const filename = `${cleanFolder}/${timestamp}-${randomString}.${extension}`;

    // Upload to Cloudflare R2 via Worker
    const uploadResponse = await fetch(`${WORKER_URL}/upload`, {
      method: "POST",
      headers: {
        "X-Filename": filename,
        "X-Content-Type": file.type,
      },
      body: arrayBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("[UPLOAD_ERROR]", errorText);
      throw new Error("Upload to R2 failed");
    }

    const result = await uploadResponse.json();

    // FIX (22 Nov 2026, R2): catat SETIAP upload ke tabel R2File sebagai
    // PENDING. Sebelumnya file langsung ada di R2 tanpa jejak DB — batal
    // simpan / ganti / hapus diam-diam menciptakan file yatim yang tidak
    // terdeteksi. Baris dikonfirmasi ACTIVE saat entitas pemilik disimpan
    // (confirmR2File); PENDING > 24 jam disapu jadi ORPHANED.
    // FIX (22 Nov 2026, pentest L9): trackUpload diulang 3x; kalau tetap
    // gagal, upload TIDAK digagalkan tapi respons menandai file sebagai
    // tidak terlacak supaya operator tahu.
    const tracked = await trackUpload({
      r2Key: filename,
      url: result.url,
      sizeBytes: file.size,
      mimeType: file.type,
      folder: cleanFolder,
      uploadedById: session.user.id,
    });
    if (!tracked) {
      console.warn("[UPLOAD_UNTRACKED] File terunggah tapi tidak tercatat di R2File:", filename);
    }

    // ✅ Worker returns full URL with /files/ endpoint
    return NextResponse.json({
      success: true,
      url: result.url, // https://worker.dev/files/folder/xxx.jpg
      filename: filename,
      sizeBytes: file.size,
      mimeType: file.type,
      ...(tracked
        ? {}
        : {
            untracked: true,
            warning:
              "File terunggah, tapi pencatatan ke database gagal — file ini tidak terlacak di halaman Penyimpanan.",
          }),
    });
  } catch (error) {
    console.error("[UPLOAD_API_ERROR]", error);
    return NextResponse.json(
      { error: "Gagal mengupload gambar" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let filename = searchParams.get("filename");

    if (!filename) {
      const body = await request.json().catch(() => ({}));
      filename = body?.filename;
    }

    if (!filename) {
      return NextResponse.json(
        { error: "Parameter 'filename' wajib diisi" },
        { status: 400 }
      );
    }

    // SECURITY FIX (Nov 2026, H7): hapus file sebelumnya bisa dilakukan
    // pengguna login mana pun dengan nama file bebas (termasuk `../`).
    // Sekarang hanya ADMIN/SUPER_ADMIN, dan nama file harus pola
    // `folder/nama.ext` tanpa path traversal.
    const role = (session.user as { role?: string }).role;
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: hanya admin yang bisa menghapus file" },
        { status: 403 }
      );
    }
    // FIX (22 Nov 2026, R2): terima URL penuh juga, bukan cuma key.
    // Pemanggil APK mengirim URL penuh (https://.../files/folder/x.jpg)
    // atau nama tanpa folder — keduanya dulu ditolak regex (400) sehingga
    // hapus dari APK TIDAK PERNAH berhasil, tapi UI sudah bilang "terhapus".
    // extractR2Filename dulu, baru validasi key hasilnya.
    const r2Key = extractR2Filename(filename) || filename;
    if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(?:-[a-zA-Z0-9_-]+)*\.(jpg|jpeg|png|webp)$/.test(r2Key)) {
      return NextResponse.json({ error: "Nama file tidak valid" }, { status: 400 });
    }
    filename = r2Key;

    // Call Cloudflare Worker delete endpoint
    // FIX (22 Nov 2026, pentest L3): sebelumnya respons SELALU success:true
    // walau hapus Worker gagal — UI mengira file terhapus padahal masih ada
    // di R2. Sekarang: Worker 404 = file sudah tidak ada (dianggap terhapus,
    // jejak ditandai DELETED); gagal lain = 502 dan jejak TIDAK ditandai.
    let workerOk = false;
    let workerStatus: number | null = null;
    let workerUnreachable = false;
    if (WORKER_URL) {
      try {
        const res = await fetch(`${WORKER_URL}/delete`, {
          method: "DELETE",
          headers: {
            "X-Filename": filename,
          },
        });
        workerOk = res.ok;
        workerStatus = res.status;
        if (!workerOk) {
          console.warn(`[WORKER_DELETE_WARN] Status ${res.status} saat menghapus ${filename}`);
        }
      } catch (err) {
        workerUnreachable = true;
        console.warn("[WORKER_DELETE_WARN] Could not delete from worker:", err);
      }
    }

    // Tandai baris pelacakan sebagai DELETED hanya kalau file benar-benar
    // sudah tidak ada di R2 (Worker OK, atau Worker 404 = memang tidak ada).
    if (workerOk || workerStatus === 404) {
      await markR2FilesDeletedByKeys([filename]);
    }

    if (workerOk) {
      return NextResponse.json({
        success: true,
        message: `File ${filename} berhasil dihapus dari Cloudflare R2`,
      });
    }

    if (workerStatus === 404) {
      return NextResponse.json({
        success: true,
        message: `File ${filename} sudah tidak ada di Cloudflare R2 (dianggap terhapus)`,
      });
    }

    return NextResponse.json(
      {
        error:
          "Gagal menghapus file dari Cloudflare R2. File masih ada — coba lagi nanti.",
        ...(workerStatus !== null ? { workerStatus } : {}),
        ...(workerUnreachable ? { workerUnreachable: true } : {}),
      },
      { status: 502 }
    );
  } catch (error) {
    console.error("[DELETE_API_ERROR]", error);
    return NextResponse.json(
      { error: "Gagal menghapus gambar" },
      { status: 500 }
    );
  }
}