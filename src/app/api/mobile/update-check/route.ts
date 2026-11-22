import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/utils/api";

/**
 * GET /api/mobile/update-check
 * Cek versi terbaru APK untuk in-app update
 * Endpoint ini aman karena memerlukan login
 */
export async function GET() {
  const session = await getAuthenticatedUser();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Baca version.json dari env atau file statis
  // Cara termudah: simpan di env APP_LATEST_VERSION_JSON setelah GitHub Actions release
  const versionJson = process.env.APP_LATEST_VERSION_JSON;

  if (!versionJson) {
    return NextResponse.json({ error: "Versi tidak tersedia" }, { status: 404 });
  }

  try {
    const info = JSON.parse(versionJson);
    // PENTEST FIX (22 Nov 2026, L19): jangan kembalikan isi env mentah —
    // hanya field yang dibutuhkan APK. Field lain yang kelak ditambah ke
    // APP_LATEST_VERSION_JSON sengaja tidak bocor.
    return NextResponse.json({
      version: typeof info.version === "string" ? info.version : null,
      versionCode: typeof info.versionCode === "number" ? info.versionCode : null,
      forceUpdate: info.forceUpdate === true,
      downloadUrl: typeof info.downloadUrl === "string" ? info.downloadUrl : null,
    });
  } catch {
    return NextResponse.json({ error: "Format versi tidak valid" }, { status: 500 });
  }
}
