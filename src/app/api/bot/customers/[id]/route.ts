import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { CustomerType, PaymentMethod } from "@prisma/client";
import {
  requireBotRead,
  requireBotWrite,
  botOk,
  botErr,
  sanitizeBotError,
  toNum,
  writeBotAudit,
} from "@/lib/bot-auth";

type RouteContext = { params: Promise<{ id: string }> };

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
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

/**
 * GET /api/bot/customers/[id]
 * Detail pelanggan + ringkasan utang + total belanja.
 * Total belanja mengikuti definisi getCustomers (WS-8): grandTotal
 * penjualan COMPLETED dengan paymentMethod BUKAN CREDIT.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireBotRead(request);
    if (!auth.ok) return botAuthFail(auth.status);

    const { id } = await context.params;
    const customer = await prisma.customer.findUnique({
      where: { id },
    });
    if (!customer) return botErr("Customer tidak ditemukan.", 404);

    const [openDebts, belanja] = await Promise.all([
      prisma.customerDebt.findMany({
        where: { customerId: id, remainingDebt: { gt: 0 } },
        select: {
          id: true,
          debtNumber: true,
          saleId: true,
          totalDebt: true,
          paidAmount: true,
          remainingDebt: true,
          dueDate: true,
          status: true,
          createdAt: true,
        },
        orderBy: { dueDate: "asc" },
      }),
      prisma.sale.aggregate({
        where: {
          customerId: id,
          status: "COMPLETED",
          paymentMethod: { not: PaymentMethod.CREDIT },
        },
        _sum: { grandTotal: true },
      }),
    ]);

    const totalRemaining = openDebts.reduce(
      (sum, d) => sum + (toNum(d.remainingDebt) ?? 0),
      0
    );

    return botOk({
      ...serializeCustomer(customer),
      totalBelanja: Number(belanja._sum.grandTotal ?? 0),
      openDebts: {
        count: openDebts.length,
        totalRemaining,
        items: openDebts.map((d) => ({
          id: d.id,
          debtNumber: d.debtNumber,
          saleId: d.saleId,
          totalDebt: toNum(d.totalDebt),
          paidAmount: toNum(d.paidAmount),
          remainingDebt: toNum(d.remainingDebt),
          dueDate: d.dueDate,
          status: d.status,
          createdAt: d.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("[API_BOT_CUSTOMER_ID_GET_ERROR]", error);
    return botErr(sanitizeBotError(error), 500);
  }
}

/**
 * PUT /api/bot/customers/[id] — Level 1 saja.
 * Ubah nama, telepon, email, alamat, kota, provinsi, type.
 * Type TIDAK BOLEH diubah menjadi UMUM (hanya satu customer Umum).
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireBotWrite(request, [1]);
    if (!auth.ok) return botAuthFail(auth.status);

    const { id } = await context.params;
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return botErr("Customer tidak ditemukan.", 404);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return botErr("Format data (JSON) tidak valid.", 400);
    }

    const data: {
      name?: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      city?: string | null;
      province?: string | null;
      type?: CustomerType;
    } = {};
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    const setField = <K extends keyof typeof data>(
      key: K,
      current: unknown,
      next: unknown
    ) => {
      if (next !== current) {
        (data as Record<string, unknown>)[key] = next;
        before[key as string] = current;
        after[key as string] = next;
      }
    };

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 3)
        return botErr("Nama pelanggan minimal 3 karakter.", 400);
      if (name.length > 100)
        return botErr("Nama pelanggan maksimal 100 karakter.", 400);
      // Nama duplikat (di luar diri sendiri) ditolak — seperti web.
      if (name.toLowerCase() !== customer.name.toLowerCase()) {
        const duplicate = await prisma.customer.findFirst({
          where: {
            name: { equals: name, mode: "insensitive" },
            id: { not: id },
          },
        });
        if (duplicate)
          return botErr(`Customer dengan nama "${name}" sudah ada.`, 400);
      }
      setField("name", customer.name, name);
    }

    if (body.phone !== undefined) {
      const phone =
        typeof body.phone === "string" ? body.phone.trim() : "";
      if (phone !== "" && (phone.length < 10 || phone.length > 15))
        return botErr(
          "Nomor telepon minimal 10 digit dan maksimal 15 digit.",
          400
        );
      setField("phone", customer.phone, phone === "" ? null : phone);
    }

    if (body.email !== undefined) {
      const email =
        typeof body.email === "string" ? body.email.trim() : "";
      if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return botErr("Format email tidak valid.", 400);
      setField("email", customer.email, email === "" ? null : email);
    }

    if (body.address !== undefined) {
      const address =
        typeof body.address === "string" ? body.address.trim() : "";
      if (address.length > 255)
        return botErr("Alamat maksimal 255 karakter.", 400);
      setField("address", customer.address, address === "" ? null : address);
    }

    if (body.city !== undefined) {
      const city = typeof body.city === "string" ? body.city.trim() : "";
      if (city.length > 100)
        return botErr("Kota maksimal 100 karakter.", 400);
      setField("city", customer.city, city === "" ? null : city);
    }

    if (body.province !== undefined) {
      const province =
        typeof body.province === "string" ? body.province.trim() : "";
      if (province.length > 100)
        return botErr("Provinsi maksimal 100 karakter.", 400);
      setField(
        "province",
        customer.province,
        province === "" ? null : province
      );
    }

    if (body.type !== undefined) {
      const typeRaw =
        typeof body.type === "string" ? body.type.trim().toUpperCase() : "";
      if (!CUSTOMER_TYPES.includes(typeRaw as CustomerType))
        return botErr("Tipe customer tidak dikenal.", 400);
      if (typeRaw === "UMUM")
        return botErr(
          "Tipe customer tidak bisa diubah menjadi UMUM. Hanya satu customer Umum yang boleh ada di toko.",
          400
        );
      setField("type", customer.type, typeRaw as CustomerType);
    }

    if (Object.keys(data).length === 0)
      return botErr("Tidak ada data yang diubah.", 400);

    const updated = await prisma.customer.update({
      where: { id },
      data,
    });

    await auditSafe({
      level: auth.level,
      sender: auth.sender,
      method: "PUT",
      endpoint: `/api/bot/customers/${id}`,
      entityType: "Customer",
      entityId: id,
      before,
      after,
      success: true,
    });

    return botOk(serializeCustomer(updated));
  } catch (error) {
    console.error("[API_BOT_CUSTOMER_ID_PUT_ERROR]", error);
    return botErr(sanitizeBotError(error), 500);
  }
}

/**
 * DELETE /api/bot/customers/[id] — Level 1 saja.
 * Soft-delete: isActive=false. DITOLAK bila pelanggan masih punya utang
 * dengan remainingDebt > 0, dan bila pelanggan itu adalah customer UMUM
 * (satu-satunya, dipakai POS untuk penjualan cepat).
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireBotWrite(request, [1]);
    if (!auth.ok) return botAuthFail(auth.status);

    const { id } = await context.params;
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return botErr("Customer tidak ditemukan.", 404);

    if (customer.type === "UMUM")
      return botErr(
        "Customer Umum tidak bisa dihapus. Customer ini dipakai POS untuk penjualan cepat.",
        400
      );

    if (!customer.isActive)
      return botErr(`Customer "${customer.name}" sudah nonaktif.`, 400);

    const openDebt = await prisma.customerDebt.aggregate({
      where: { customerId: id, remainingDebt: { gt: 0 } },
      _sum: { remainingDebt: true },
    });
    const remaining = Number(openDebt._sum.remainingDebt ?? 0);
    if (remaining > 0)
      return botErr(
        `Customer "${customer.name}" masih punya sisa utang sebesar ${remaining} yang belum lunas. Selesaikan utang terlebih dahulu.`,
        400
      );

    await prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });

    await auditSafe({
      level: auth.level,
      sender: auth.sender,
      method: "DELETE",
      endpoint: `/api/bot/customers/${id}`,
      entityType: "Customer",
      entityId: id,
      before: { name: customer.name, code: customer.code, isActive: true },
      after: { isActive: false },
      success: true,
    });

    return botOk({
      id: customer.id,
      code: customer.code,
      name: customer.name,
      isActive: false,
    });
  } catch (error) {
    console.error("[API_BOT_CUSTOMER_ID_DELETE_ERROR]", error);
    return botErr(sanitizeBotError(error), 500);
  }
}
