import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/utils/api";
import { hasMinimumRole } from "@/lib/utils/role";
import { db } from "@/lib/db";
import { CashType } from "@prisma/client";

// PENTEST FIX (22 Nov 2026, L11): batas wajar untuk input kas manual.
const MAX_AMOUNT = 1_000_000_000_000; // Rp 1 triliun
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_CATEGORY_LENGTH = 100;

/**
 * GET /api/cash-movements
 * Daftar arus kas dengan filter tanggal dan agregasi
 *
 * PENTEST FIX (22 Nov 2026, M19): dulu tanpa cek role — KASIR mana pun
 * bisa melihat saldo kas + 100 transaksi terakhir. Sekarang ADMIN+ saja.
 * PENTEST FIX (L12): GET dibungkus try/catch + validasi type & tanggal
 * (dulu ?type=XXX / ?dateFrom=asdf jadi 500 dari Prisma).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthenticatedUser();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasMinimumRole(session, "ADMIN")) {
      return NextResponse.json(
        { error: "Forbidden: hanya admin yang bisa melihat arus kas" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const dateFromRaw = searchParams.get("dateFrom");
    const dateToRaw = searchParams.get("dateTo");
    const dateFrom = dateFromRaw
      ? new Date(dateFromRaw)
      : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
    const dateTo = dateToRaw ? new Date(dateToRaw) : new Date();
    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
      return NextResponse.json({ error: "Format tanggal tidak valid" }, { status: 400 });
    }
    const typeParam = searchParams.get("type"); // IN | OUT | null
    if (typeParam && typeParam !== CashType.IN && typeParam !== CashType.OUT) {
      return NextResponse.json({ error: "type harus IN atau OUT" }, { status: 400 });
    }

    const where = {
      createdAt: { gte: dateFrom, lte: dateTo },
      ...(typeParam ? { type: typeParam as CashType } : {}),
    };

    const [transactions, agg] = await Promise.all([
      db.cashMovement.findMany({
        where,
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.cashMovement.groupBy({
        by: ["type"],
        _sum: { amount: true },
        where,
      }),
    ]);

    const totalIn  = Number(agg.find((r) => r.type === CashType.IN)?._sum?.amount  ?? 0);
    const totalOut = Number(agg.find((r) => r.type === CashType.OUT)?._sum?.amount ?? 0);

    // Saldo — total semua IN - total semua OUT
    const balanceAgg = await db.cashMovement.groupBy({
      by: ["type"],
      _sum: { amount: true },
    });
    const allIn  = Number(balanceAgg.find((r) => r.type === CashType.IN)?._sum?.amount  ?? 0);
    const allOut = Number(balanceAgg.find((r) => r.type === CashType.OUT)?._sum?.amount ?? 0);

    return NextResponse.json({
      success: true,
      data: {
        balance: allIn - allOut,
        totalIn,
        totalOut,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transactions: transactions.map((t: any) => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount),
          description: t.description,
          category: t.category,
          createdAt: t.createdAt,
          createdByName: t.user?.name ?? "-",
        })),
      },
    });
  } catch (error) {
    console.error("[API_CASH_MOVEMENTS_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memuat arus kas" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cash-movements
 * Catat kas masuk / keluar manual
 *
 * PENTEST FIX (22 Nov 2026, L12): cek role manual (string) diganti
 * hasMinimumRole(session, "ADMIN") supaya konsisten dengan PERMISSIONS.
 */
export async function POST(req: NextRequest) {
  const session = await getAuthenticatedUser();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SECURITY FIX (Nov 2026, H6): sebelumnya pengguna login mana pun (kasir)
  // bisa mencatat kas masuk/keluar bebas — saldo kas bisa dipalsukan.
  // Catatan kas manual hanya untuk ADMIN/SUPER_ADMIN.
  if (!hasMinimumRole(session, "ADMIN")) {
    return NextResponse.json({ error: "Forbidden: hanya admin yang bisa mencatat kas manual" }, { status: 403 });
  }

  const { type, amount, description, category } = await req.json();

  if (!type || !amount || !description) {
    return NextResponse.json(
      { error: "type, amount, description wajib diisi" },
      { status: 400 }
    );
  }

  // Validasi: tipe harus IN/OUT, jumlah harus angka positif yang wajar.
  if (type !== CashType.IN && type !== CashType.OUT) {
    return NextResponse.json({ error: "type harus IN atau OUT" }, { status: 400 });
  }
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0 || amountNum > MAX_AMOUNT) {
    return NextResponse.json({ error: "amount harus angka lebih dari 0 dan wajar" }, { status: 400 });
  }
  // PENTEST FIX (L11): string bebas dibatasi panjangnya.
  if (typeof description !== "string" || description.trim().length === 0 || description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json({ error: `description wajib diisi, maksimal ${MAX_DESCRIPTION_LENGTH} karakter` }, { status: 400 });
  }
  if (category !== undefined && category !== null && (typeof category !== "string" || category.length > MAX_CATEGORY_LENGTH)) {
    return NextResponse.json({ error: `category maksimal ${MAX_CATEGORY_LENGTH} karakter` }, { status: 400 });
  }

  const movement = await db.cashMovement.create({
    data: {
      type: type as CashType,
      amount: amountNum,
      description: description.trim(),
      category: typeof category === "string" ? category.trim() || null : null,
      userId: session.user.id!,
    },
  });

  return NextResponse.json({ success: true, data: movement });
}
