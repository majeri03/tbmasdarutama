import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/utils/api";
import { db } from "@/lib/db";

/**
 * GET /api/mobile/update-check
 * Cek versi terbaru APK untuk in-app update
 * Endpoint ini aman karena memerlukan login
 */
export async function GET(req: NextRequest) {
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
    return NextResponse.json(info);
  } catch {
    return NextResponse.json({ error: "Format versi tidak valid" }, { status: 500 });
  }
}
