import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/utils/api";
import {
  getReconcileInfo,
  reconcileWithKeyList,
  deleteOrphanR2Files,
} from "@/lib/actions/storage.actions";

/**
 * GET /api/storage/reconcile
 * Info rekonsiliasi: jumlah yatim di DB + status env untuk listing R2
 * langsung (butuh R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 * R2_BUCKET_NAME — saat ini tidak ada di env, lihat getReconcileInfo).
 */
export async function GET() {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role === "KASIR") {
      return NextResponse.json({ error: "Hanya Admin / Super Admin." }, { status: 403 });
    }
    const res = await getReconcileInfo();
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: res.data });
  } catch (error) {
    console.error("[RECONCILE_GET_ERROR]", error);
    return NextResponse.json({ error: "Gagal memuat info rekonsiliasi" }, { status: 500 });
  }
}

/**
 * POST /api/storage/reconcile
 * Body:
 *   { keys: [{ key, sizeBytes? }] } — bandingkan daftar key R2 (export dari
 *     dashboard Cloudflare / wrangler) dengan DB; yatim dicatat ORPHANED.
 *   { action: "deleteOrphans", keys: ["k1", "k2"] } — hapus file yatim dari R2.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role === "KASIR") {
      return NextResponse.json({ error: "Hanya Admin / Super Admin." }, { status: 403 });
    }
    const body = await request.json();

    if (body?.action === "deleteOrphans" && Array.isArray(body.keys)) {
      const res = await deleteOrphanR2Files(body.keys);
      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: res.message, detail: res.detail });
    }

    if (!Array.isArray(body?.keys)) {
      return NextResponse.json(
        { error: "Body harus berisi { keys: [{ key, sizeBytes }] } atau { action: 'deleteOrphans', keys: [...] }." },
        { status: 400 }
      );
    }
    const res = await reconcileWithKeyList(body.keys);
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: res.message, data: res.data });
  } catch (error) {
    console.error("[RECONCILE_POST_ERROR]", error);
    return NextResponse.json({ error: "Gagal menjalankan rekonsiliasi" }, { status: 500 });
  }
}
