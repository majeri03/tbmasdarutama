import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CashType } from "@prisma/client";

/**
 * GET /api/cash-movements
 * Daftar arus kas dengan filter tanggal dan agregasi
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom")
    ? new Date(searchParams.get("dateFrom")!)
    : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
  const dateTo = searchParams.get("dateTo")
    ? new Date(searchParams.get("dateTo")!)
    : new Date();
  const typeParam = searchParams.get("type"); // IN | OUT | null

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
}

/**
 * POST /api/cash-movements
 * Catat kas masuk / keluar manual
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, amount, description, category } = await req.json();

  if (!type || !amount || !description) {
    return NextResponse.json(
      { error: "type, amount, description wajib diisi" },
      { status: 400 }
    );
  }

  const movement = await db.cashMovement.create({
    data: {
      type: type as CashType,
      amount: Number(amount),
      description,
      category,
      userId: session.user.id!,
    },
  });

  return NextResponse.json({ success: true, data: movement });
}
