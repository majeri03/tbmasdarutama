import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/utils/api";
import { runBackfill } from "@/lib/actions/storage.actions";

/**
 * POST /api/storage/backfill
 * Isi tabel R2File dari data yang sudah ada sebelum patch ini (foto DO,
 * bukti transfer, gambar produk, hero, logo). Wajib dijalankan SEKALI
 * setelah migrasi, supaya statistik kuota & rekonsiliasi mencakup file lama.
 */
export async function POST() {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role === "KASIR") {
      return NextResponse.json({ error: "Hanya Admin / Super Admin." }, { status: 403 });
    }
    const res = await runBackfill();
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: res.message, detail: res.detail });
  } catch (error) {
    console.error("[BACKFILL_ERROR]", error);
    return NextResponse.json({ error: "Gagal menjalankan backfill" }, { status: 500 });
  }
}
