/**
 * storage.ts — Cloudflare R2 Helper for deleting files and extracting keys
 */

const WORKER_URL = process.env.CLOUDFLARE_WORKER_URL;

/**
 * Ekstrak key / relative filename dari URL R2
 * Contoh: https://worker.../files/proofs_delivery/123.jpg -> proofs_delivery/123.jpg
 */
export function extractR2Filename(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname;
    if (pathname.startsWith("/files/")) {
      return pathname.replace("/files/", "");
    }
    return pathname.startsWith("/") ? pathname.substring(1) : pathname;
  } catch {
    return trimmed.replace(/^.*\/files\//, "");
  }
}

/**
 * Hapus file fisik dari Cloudflare R2 via Worker
 */
export async function deleteFromR2(filenameOrUrl: string | null | undefined): Promise<boolean> {
  if (!filenameOrUrl || !WORKER_URL) return false;

  const filename = extractR2Filename(filenameOrUrl) || filenameOrUrl;

  try {
    const res = await fetch(`${WORKER_URL}/delete`, {
      method: "DELETE",
      headers: {
        "X-Filename": filename,
      },
    });

    if (res.ok) {
      console.log(`[R2_DELETE_SUCCESS] File ${filename} berhasil dihapus dari Cloudflare R2.`);
      return true;
    } else {
      console.warn(`[R2_DELETE_WARN] Status ${res.status} saat menghapus ${filename} dari Cloudflare R2.`);
      return false;
    }
  } catch (err: any) {
    console.warn(`[R2_DELETE_ERROR] Gagal menghapus ${filename} dari Cloudflare R2:`, err?.message);
    return false;
  }
}
