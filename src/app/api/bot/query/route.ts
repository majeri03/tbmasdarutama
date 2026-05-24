import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function authCheck(request: Request) {
  const clientApiKey = request.headers.get("x-api-key");
  return clientApiKey && clientApiKey === process.env.BOT_API_KEY;
}

// Daftar kata kunci berbahaya yang HARUS diblokir
const BLOCKED_KEYWORDS = [
  "DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "TRUNCATE",
  "CREATE", "GRANT", "REVOKE", "EXEC", "EXECUTE", "MERGE",
  "CALL", "SET ", "COPY", "VACUUM", "REINDEX", "CLUSTER",
];

// POST /api/bot/query — Raw SQL SELECT only
export async function POST(request: Request) {
  if (!authCheck(request)) {
    return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
  }

  try {
    const body = await request.json();
    let { sql } = body;

    if (!sql || typeof sql !== "string") {
      return NextResponse.json({ status: "error", message: "Field 'sql' wajib diisi" }, { status: 400 });
    }

    sql = sql.trim();

    // Validasi: HARUS dimulai dengan SELECT
    if (!sql.toUpperCase().startsWith("SELECT")) {
      return NextResponse.json(
        { status: "error", message: "Hanya query SELECT yang diizinkan" },
        { status: 403 }
      );
    }

    // Validasi: TIDAK BOLEH mengandung kata kunci berbahaya
    const upperSql = sql.toUpperCase();
    for (const keyword of BLOCKED_KEYWORDS) {
      // Cek sebagai kata terpisah (bukan bagian dari nama kolom)
      const regex = new RegExp(`\\b${keyword}\\b`, "i");
      if (regex.test(upperSql)) {
        return NextResponse.json(
          { status: "error", message: `Query mengandung perintah terlarang: ${keyword}` },
          { status: 403 }
        );
      }
    }

    // Blokir semicolon (mencegah multi-statement)
    if (sql.includes(";")) {
      return NextResponse.json(
        { status: "error", message: "Multi-statement query tidak diizinkan" },
        { status: 403 }
      );
    }

    // Tambahkan LIMIT jika belum ada
    if (!upperSql.includes("LIMIT")) {
      sql += " LIMIT 20";
    }

    // Jalankan query dengan timeout
    const result = await prisma.$queryRawUnsafe(sql);

    // Serialize BigInt dan Decimal
    const serialized = JSON.parse(
      JSON.stringify(result, (_, value) =>
        typeof value === "bigint"
          ? Number(value)
          : value && typeof value === "object" && value.constructor?.name === "Decimal"
          ? Number(value)
          : value
      )
    );

    return NextResponse.json({
      status: "success",
      count: Array.isArray(serialized) ? serialized.length : 1,
      data: serialized,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Query gagal";
    console.error("[BOT] Error query:", errMsg);
    return NextResponse.json(
      { status: "error", message: `Query error: ${errMsg.substring(0, 200)}` },
      { status: 400 }
    );
  }
}
