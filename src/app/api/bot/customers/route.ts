import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma, CustomerType, PaymentMethod } from "@prisma/client";
import {
  requireBotRead,
  requireBotWrite,
  botOk,
  botErr,
  sanitizeBotError,
  parseBotPagination,
  writeBotAudit,
} from "@/lib/bot-auth";

function botAuthFail(status: 401 | 403 | 429) {
  if (status === 403)
    return botErr(
      "Maaf, akun ini hanya bisa melihat, tidak bisa mengubah data.",
      403
    );
  if (status === 429)
    return botErr("Terlalu banyak permintaan. Coba lagi sebentar lagi.", 429);
  return botErr("Kunci bot tidak valid.", 401);
}

async function auditSafe(
  entry: Parameters<typeof writeBotAudit>[0]
): Promise<void> {
  try {
    await writeBotAudit(entry);
  } catch (error) {
    console.error("[API_BOT_AUDIT_ERROR]", error);
  }
}

const CUSTOMER_TYPES: CustomerType[] = [
  "UMUM",
  "REGULER",
  "GROSIR",
  "PROYEK",
];

function serializeCustomer(c: {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  type: CustomerType;
  points: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  totalBelanja?: number;
}) {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    city: c.city,
    province: c.province,
    type: c.type,
    points: c.points,
    isActive: c.isActive,
    totalBelanja: c.totalBelanja ?? 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

// Total belanja — definisi yang sama dengan getCustomers di
// customer.actions.ts (WS-8): grandTotal penjualan COMPLETED dengan
// paymentMethod BUKAN CREDIT. Dipakai supaya total belanja sejalan dengan
// syarat dapat poin.
async function totalBelanjaByIds(ids: string[]) {
  if (ids.length === 0) return new Map<string, number>();
  const totals = await prisma.sale.groupBy({
    by: ["customerId"],
    where: {
      customerId: { in: ids },
      status: "COMPLETED",
      paymentMethod: { not: PaymentMethod.CREDIT },
    },
    _sum: { grandTotal: true },
  });
  return new Map(
    totals.map((t) => [
      t.customerId as string,
      Number(t._sum.grandTotal ?? 0),
    ])
  );
}

// Pola yang sama dengan generateCustomerCode di
// src/lib/actions/customer.actions.ts: pindai semua kode CUST-, ambil angka
// akhir terbesar, +1, format CUST-xxxxx (5 digit).
async function generateCustomerCode(
  tx: Prisma.TransactionClient
): Promise<string> {
  const customers = await tx.customer.findMany({
    where: { code: { startsWith: "CUST-" } },
    select: { code: true },
  });
  let maxNumber = 0;
  for (const customer of customers) {
    const match = customer.code.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!Number.isNaN(num) && num > maxNumber) maxNumber = num;
    }
  }
  return `CUST-${String(maxNumber + 1).padStart(5, "0")}`;
}

// Validasi kolom pelanggan mengikuti customer.schema.ts di web:
// nama min 3 karakter, telepon 10-15 digit bila diisi, email valid bila diisi.
function validateCustomerFields(body: Record<string, unknown>): {
  ok: true;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
} | { ok: false; error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 3)
    return { ok: false, error: "Nama pelanggan minimal 3 karakter." };
  if (name.length > 100)
    return { ok: false, error: "Nama pelanggan maksimal 100 karakter." };

  const phoneRaw =
    typeof body.phone === "string" ? body.phone.trim() : "";
  if (phoneRaw !== "" && (phoneRaw.length < 10 || phoneRaw.length > 15))
    return {
      ok: false,
      error: "Nomor telepon minimal 10 digit dan maksimal 15 digit.",
    };

  const emailRaw =
    typeof body.email === "string" ? body.email.trim() : "";
  if (emailRaw !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw))
    return { ok: false, error: "Format email tidak valid." };

  const addressRaw =
    typeof body.address === "string" ? body.address.trim() : "";
  if (addressRaw.length > 255)
    return { ok: false, error: "Alamat maksimal 255 karakter." };

  const cityRaw = typeof body.city === "string" ? body.city.trim() : "";
  if (cityRaw.length > 100)
    return { ok: false, error: "Kota maksimal 100 karakter." };

  const provinceRaw =
    typeof body.province === "string" ? body.province.trim() : "";
  if (provinceRaw.length > 100)
    return { ok: false, error: "Provinsi maksimal 100 karakter." };

  return {
    ok: true,
    name,
    phone: phoneRaw === "" ? null : phoneRaw,
    email: emailRaw === "" ? null : emailRaw,
    address: addressRaw === "" ? null : addressRaw,
    city: cityRaw === "" ? null : cityRaw,
    province: provinceRaw === "" ? null : provinceRaw,
  };
}

/**
 * GET /api/bot/customers
 * Daftar pelanggan (semua level boleh baca). Search nama/telepon/kode,
 * filter type, page/limit. Poin disertakan.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireBotRead(request);
    if (!auth.ok) return botAuthFail(auth.status);

    const { searchParams } = new URL(request.url);
    const { page, limit } = parseBotPagination(searchParams);
    const search = searchParams.get("search")?.trim() || "";
    const typeParam = searchParams.get("type")?.trim().toUpperCase() || "";
    const skip = (page - 1) * limit;

    let type: CustomerType | undefined;
    if (typeParam) {
      if (!CUSTOMER_TYPES.includes(typeParam as CustomerType))
        return botErr("Tipe customer tidak dikenal.", 400);
      type = typeParam as CustomerType;
    }

    const where: Prisma.CustomerWhereInput = {
      AND: [
        search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
              ],
            }
          : {},
        type ? { type } : {},
      ],
    };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    const belanja = await totalBelanjaByIds(customers.map((c) => c.id));

    return botOk(
      customers.map((c) =>
        serializeCustomer({ ...c, totalBelanja: belanja.get(c.id) ?? 0 })
      ),
      { page, limit, total, totalPages: Math.ceil(total / limit) }
    );
  } catch (error) {
    console.error("[API_BOT_CUSTOMERS_GET_ERROR]", error);
    return sanitizeBotError(error);
  }
}

/**
 * POST /api/bot/customers — Level 1 saja.
 * Buat pelanggan baru. Kode dibuat server (CUST-xxxxx).
 * Tipe UMUM DITOLAK: hanya satu customer Umum yang boleh ada di toko
 * (dipakai POS untuk penjualan cepat) — pola ensureUmumCustomer /
 * createCustomer di customer.actions.ts.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireBotWrite(request, [1]);
    if (!auth.ok) return botAuthFail(auth.status);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return botErr("Format data (JSON) tidak valid.", 400);
    }

    const typeRaw =
      typeof body.type === "string" && body.type.trim() !== ""
        ? body.type.trim().toUpperCase()
        : "REGULER";
    if (!CUSTOMER_TYPES.includes(typeRaw as CustomerType))
      return botErr("Tipe customer tidak dikenal.", 400);
    if (typeRaw === "UMUM")
      return botErr(
        "Customer Umum sudah ada dan tidak boleh dibuat lagi. Hanya satu customer Umum yang boleh ada di toko.",
        400
      );
    const type = typeRaw as CustomerType;

    const validated = validateCustomerFields(body);
    if (!validated.ok) return botErr(validated.error, 400);

    const duplicate = await prisma.customer.findFirst({
      where: { name: { equals: validated.name, mode: "insensitive" } },
    });
    if (duplicate)
      return botErr(
        `Customer dengan nama "${validated.name}" sudah ada.`,
        400
      );

    const created = await prisma.$transaction(async (tx) => {
      const code = await generateCustomerCode(tx);
      return tx.customer.create({
        data: {
          code,
          name: validated.name,
          phone: validated.phone,
          email: validated.email,
          address: validated.address,
          city: validated.city,
          province: validated.province,
          type,
        },
      });
    });

    await auditSafe({
      level: auth.level,
      sender: auth.sender,
      method: "POST",
      endpoint: "/api/bot/customers",
      entityType: "Customer",
      entityId: created.id,
      before: {},
      after: { code: created.code, name: created.name, type },
      success: true,
    });

    return botOk(serializeCustomer(created));
  } catch (error) {
    console.error("[API_BOT_CUSTOMERS_POST_ERROR]", error);
    return sanitizeBotError(error);
  }
}
