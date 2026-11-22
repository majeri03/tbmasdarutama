import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/utils/api";
import { trackUpload, markR2FilesDeletedByKeys } from "@/lib/utils/r2-tracking";
import { extractR2Filename } from "@/lib/utils/storage";

// ✅ Only need Worker URL
const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL;

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

    // Generate unique filename with optional custom folder (e.g., proofs_delivery, proofs_payment, products)
    const folder = (formData.get("folder") as string) || "products";
    const cleanFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "") || "products";
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const filename = `${cleanFolder}/${timestamp}-${randomString}.${extension}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();

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
    await trackUpload({
      r2Key: filename,
      url: result.url,
      sizeBytes: file.size,
      mimeType: file.type,
      folder: cleanFolder,
      uploadedById: session.user.id,
    });

    // ✅ Worker returns full URL with /files/ endpoint
    return NextResponse.json({
      success: true,
      url: result.url, // https://worker.dev/files/folder/xxx.jpg
      filename: filename,
      sizeBytes: file.size,
      mimeType: file.type,
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
    let workerOk = false;
    if (WORKER_URL) {
      try {
        const res = await fetch(`${WORKER_URL}/delete`, {
          method: "DELETE",
          headers: {
            "X-Filename": filename,
          },
        });
        workerOk = res.ok;
        if (!workerOk) {
          console.warn(`[WORKER_DELETE_WARN] Status ${res.status} saat menghapus ${filename}`);
        }
      } catch (err) {
        console.warn("[WORKER_DELETE_WARN] Could not delete from worker:", err);
      }
    }

    // Tandai baris pelacakan sebagai DELETED hanya kalau Worker berhasil.
    if (workerOk) {
      await markR2FilesDeletedByKeys([filename]);
    }

    return NextResponse.json({
      success: true,
      message: `File ${filename} berhasil dihapus dari Cloudflare R2`,
    });
  } catch (error) {
    console.error("[DELETE_API_ERROR]", error);
    return NextResponse.json(
      { error: "Gagal menghapus gambar" },
      { status: 500 }
    );
  }
}