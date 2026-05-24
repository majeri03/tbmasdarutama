import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const setting = await prisma.storeSetting.findFirst();
    const data = {
      name: setting?.name || "TB Masdar Utama",
      tagline: setting?.tagline || null,
      logoUrl: setting?.logoUrl || null,
    };
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[API_SETTINGS_PUBLIC_GET_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil logo dan info toko." },
      { status: 500 }
    );
  }
}
