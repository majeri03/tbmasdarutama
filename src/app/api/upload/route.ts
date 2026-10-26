import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/utils/api";

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
    if (!file.type.startsWith("image/")) {
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
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
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

    // Call Cloudflare Worker delete endpoint
    if (WORKER_URL) {
      try {
        await fetch(`${WORKER_URL}/delete`, {
          method: "DELETE",
          headers: {
            "X-Filename": filename,
          },
        });
      } catch (err) {
        console.warn("[WORKER_DELETE_WARN] Could not delete from worker:", err);
      }
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