import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireBotRead,
  requireBotWrite,
  botOk,
  botErr,
  sanitizeBotError,
  writeBotAudit,
  getBotActorUserId,
  parseBotPagination,
  serializeBotData,
  toNum,
} from "@/lib/bot-auth";
import {
  withUniqueRetry,
  primaryQuantityOrThrow,
} from "@/lib/utils/stock-units";
import { DeliveryStatus, Prisma } from "@prisma/client";

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

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.length > maxLength) return null;
  return text;
}

const VALID_STATUSES: DeliveryStatus[] = [
  "PENDING",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
];

// ---------------------------------------------------------------------------
// Validasi pasangan sopir-kendaraan (WS-4, disalin dari
// delivery-order.actions.ts validateDriverVehiclePair): plat kendaraan
// adalah TURUNAN sopir — DO tidak boleh menyimpan sopir A dengan plat
// sopir B. Sopir yang TIDAK ada di data armada dibiarkan lolos (sopir
// luar/borongan, plat diisi manual) — yang dicegah hanyalah plat milik
// sopir armada lain.
// ---------------------------------------------------------------------------
function extractPlateNumber(vehicle: string): string {
  return vehicle.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function normalizePlateNumber(plate: string): string {
  return plate.trim().toUpperCase().replace(/\s+/g, " ");
}

async function validateDriverVehiclePair(
  driver: string | null | undefined,
  vehicle: string | null | undefined
): Promise<string | null> {
  const driverName = (driver || "").trim();
  const vehicleRaw = (vehicle || "").trim();
  if (!driverName || !vehicleRaw) return null;
  const plate = normalizePlateNumber(extractPlateNumber(vehicleRaw));
  if (!plate) return null;
  const fleet = await prisma.fleetVehicle.findMany({
    where: {
      driverName: { equals: driverName, mode: "insensitive" },
      isActive: true,
    },
    select: { driverName: true, plateNumber: true },
  });
  const mine = fleet.filter(
    (f) => f.driverName.trim().toLowerCase() === driverName.toLowerCase()
  );
  if (mine.length === 0) return null;
  const ok = mine.some(
    (f) => normalizePlateNumber(f.plateNumber) === plate
  );
  if (ok) return null;
  const plates = mine.map((f) => f.plateNumber).join(", ");
  return `Plat ${plate} bukan kendaraan sopir ${driverName}. Kendaraan ${driverName}: ${plates}.`;
}

// FIX (25 Nov 2026, ws-j2 item 139 — disalin dari
// delivery-order.actions.ts getWitaDatePrefix): prefiks tanggal nomor
// dokumen memakai WITA (Asia/Makassar, UTC+8), bukan tanggal lokal server.
function getWitaDatePrefix(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${value("year")}${value("month")}${value("day")}`;
}

// Nomor Surat Jalan DO/YYYYMM/NNNN (disalin dari generateDONumber di
// delivery-order.actions.ts): DO memakai YYYYMM saja (bukan YYYYMMDD) —
// 6 digit pertama prefiks WITA.
async function generateDONumber(tx: Prisma.TransactionClient): Promise<string> {
  const prefix = `DO/${getWitaDatePrefix().slice(0, 6)}`;
  const lastDO = await tx.deliveryOrder.findFirst({
    where: { doNumber: { startsWith: prefix } },
    orderBy: { doNumber: "desc" },
  });
  let nextNumber = 1;
  if (lastDO) {
    const parts = lastDO.doNumber.split("/");
    const lastNumberVal = parseInt(parts[parts.length - 1]);
    if (!isNaN(lastNumberVal)) nextNumber = lastNumberVal + 1;
  }
  return `${prefix}/${String(nextNumber).padStart(4, "0")}`;
}

/**
 * GET /api/bot/delivery-orders — semua level.
 * Daftar surat jalan. Meniru getAllDeliveryOrders (search: no. DO / nama
 * pelanggan / sopir / kendaraan; filter status & customerId; terbaru dulu).
 * WS-B tidak membangun GET delivery — dilengkapi di sini.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireBotRead(request);
    if (!auth.ok) return botAuthFail(auth.status);

    const searchParams = request.nextUrl.searchParams;
    const { page, limit, skip } = parseBotPagination(searchParams);

    const search = searchParams.get("search")?.trim() || "";
    const statusParam = searchParams.get("status")?.trim() || "";
    const customerId = searchParams.get("customerId")?.trim() || "";

    let status: DeliveryStatus | undefined;
    if (statusParam) {
      if (!VALID_STATUSES.includes(statusParam as DeliveryStatus)) {
        return botErr(
          "Status tidak valid. Pilihan: PENDING, IN_TRANSIT, DELIVERED, CANCELLED.",
          400
        );
      }
      status = statusParam as DeliveryStatus;
    }

    const where: Prisma.DeliveryOrderWhereInput = {};
    if (search) {
      where.OR = [
        { doNumber: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { driver: { contains: search, mode: "insensitive" } },
        { vehicle: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const [orders, total] = await Promise.all([
      prisma.deliveryOrder.findMany({
        where,
        select: {
          id: true,
          doNumber: true,
          deliveryDate: true,
          driver: true,
          vehicle: true,
          status: true,
          receivedBy: true,
          receivedDate: true,
          notes: true,
          createdAt: true,
          customer: { select: { id: true, name: true, phone: true } },
          sale: { select: { id: true, invoiceNumber: true } },
          _count: { select: { deliveryItems: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.deliveryOrder.count({ where }),
    ]);

    return botOk(
      serializeBotData(
        orders.map((o) => ({
          id: o.id,
          doNumber: o.doNumber,
          customer: o.customer,
          sale: o.sale,
          deliveryDate: o.deliveryDate,
          driver: o.driver,
          vehicle: o.vehicle,
          status: o.status,
          receivedBy: o.receivedBy,
          receivedDate: o.receivedDate,
          itemCount: o._count.deliveryItems,
          notes: o.notes,
          createdAt: o.createdAt,
        }))
      ),
      { page, limit, total, totalPages: Math.ceil(total / limit) }
    );
  } catch (error) {
    console.error("[API_BOT_DELIVERY_ORDERS_GET_ERROR]", error);
    return botErr(sanitizeBotError(error), 500);
  }
}

type CreateItemInput = {
  productId: string;
  unitId: string;
  quantity: number;
  notes: string | null;
};

/**
 * POST /api/bot/delivery-orders — Level 1 & 2.
 * Buat surat jalan dari SATU penjualan POS/manual yang sudah ada.
 * Meniru createDeliveryOrder di delivery-order.actions.ts, dengan dua
 * perbedaan yang disengaja (lihat NOTES.md):
 * - saleId WAJIB dan sale harus ada (bot TIDAK membuat auto-invoice +
 *   auto-hutang seperti DO manual web); customerId diambil dari sale
 *   (bukan dari body) supaya DO tidak bisa nyambung ke pelanggan lain.
 * - proofImage TIDAK diterima (bot tidak punya jalur upload + pelacakan
 *   R2; bukti kirim tetap diisi lewat web/APK).
 * Aturan web yang ditiru persis: validasi pasangan sopir-plat (WS-4),
 * satu sale hanya boleh punya satu DO, sale CANCELLED/RETURN ditolak,
 * cek kecukupan stok per produk dalam satuan utama (agregat), doNumber
 * DO/YYYYMM/NNNN dibuat server, status awal PENDING, createdById dari
 * getBotActorUserId(). Stok TIDAK dipotong saat DO dibuat (web baru
 * memotong saat status jadi DELIVERED — lihat PUT).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireBotWrite(request, [1, 2]);
    if (!auth.ok) return botAuthFail(auth.status);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return botErr("Format data (JSON) tidak valid.", 400);
    }

    const saleId =
      typeof body.saleId === "string" ? body.saleId.trim() : "";
    if (!saleId)
      return botErr("Penjualan (saleId) wajib diisi.", 400);

    let deliveryDate: Date;
    if (
      body.deliveryDate === undefined ||
      body.deliveryDate === null ||
      body.deliveryDate === ""
    ) {
      return botErr("Tanggal pengiriman wajib diisi.", 400);
    }
    deliveryDate = new Date(String(body.deliveryDate));
    if (Number.isNaN(deliveryDate.getTime()))
      return botErr("Tanggal pengiriman tidak valid.", 400);

    const driver =
      body.driver === undefined || body.driver === null
        ? null
        : asText(body.driver, 100);
    if (body.driver !== undefined && body.driver !== null && driver === null)
      return botErr("Nama sopir maksimal 100 karakter.", 400);
    const vehicle =
      body.vehicle === undefined || body.vehicle === null
        ? null
        : asText(body.vehicle, 100);
    if (
      body.vehicle !== undefined &&
      body.vehicle !== null &&
      vehicle === null
    )
      return botErr("Kendaraan maksimal 100 karakter.", 400);
    const notes =
      body.notes === undefined || body.notes === null
        ? null
        : asText(body.notes, 1000);
    if (body.notes !== undefined && body.notes !== null && notes === null)
      return botErr("Catatan maksimal 1000 karakter.", 400);

    // Items: wajib min 1, maks 200 (sama seperti createDeliveryOrderSchema).
    if (!Array.isArray(body.items) || body.items.length === 0)
      return botErr("Minimal 1 item barang wajib diisi.", 400);
    if (body.items.length > 200)
      return botErr("Maksimal 200 item barang.", 400);
    const items: CreateItemInput[] = [];
    for (const raw of body.items as unknown[]) {
      const item = raw as Record<string, unknown>;
      const productId =
        typeof item?.productId === "string" ? item.productId.trim() : "";
      const unitId =
        typeof item?.unitId === "string" ? item.unitId.trim() : "";
      if (!productId || !unitId)
        return botErr("Setiap item wajib punya productId dan unitId.", 400);
      const quantity = asNumber(item?.quantity);
      if (quantity === null || quantity <= 0)
        return botErr("Jumlah item harus angka lebih dari 0.", 400);
      if (quantity > 1_000_000)
        return botErr("Jumlah item terlalu besar.", 400);
      const itemNotes =
        item?.notes === undefined || item?.notes === null
          ? null
          : asText(item.notes, 500);
      if (
        item?.notes !== undefined &&
        item?.notes !== null &&
        itemNotes === null
      )
        return botErr("Catatan item maksimal 500 karakter.", 400);
      items.push({ productId, unitId, quantity, notes: itemNotes });
    }

    // 1b. WS-4: plat harus milik sopir yang dipilih.
    const pairError = await validateDriverVehiclePair(driver, vehicle);
    if (pairError) return botErr(pairError, 400);

    // 2. Validasi stok (FIX QA B-1, disalin dari createDeliveryOrder):
    // konversi DIBAGI ke satuan utama, agregat per produk supaya 2 baris
    // produk yang sama tidak lolos sendiri-sendiri.
    {
      const productIds = Array.from(new Set(items.map((i) => i.productId)));
      const checkProducts = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          currentStock: true,
          productUnits: { include: { unit: true } },
        },
      });
      const needByProduct = new Map<string, number>();
      for (const item of items) {
        const product = checkProducts.find((p) => p.id === item.productId);
        if (!product)
          return botErr(`Produk tidak ditemukan: ${item.productId}`, 400);
        const itemUnit = product.productUnits.find(
          (pu) => pu.unitId === item.unitId
        );
        if (!itemUnit)
          return botErr(
            `Satuan tidak valid untuk produk: ${product.name}`,
            400
          );
        let qtyPrimary: number;
        try {
          qtyPrimary = primaryQuantityOrThrow({
            quantity: item.quantity,
            conversionValue: Number(itemUnit.conversionValue),
            productName: product.name,
            unitName: itemUnit.unit?.name || "satuan",
          });
        } catch (e) {
          return botErr(
            e instanceof Error ? e.message : "Item tidak valid.",
            400
          );
        }
        needByProduct.set(
          item.productId,
          (needByProduct.get(item.productId) || 0) + qtyPrimary
        );
      }
      for (const [productId, need] of needByProduct.entries()) {
        const product = checkProducts.find((p) => p.id === productId)!;
        if (Number(product.currentStock) < need) {
          return botErr(
            `Stok ${product.name} tidak cukup. Tersedia: ${product.currentStock} (satuan utama), Butuh: ${need}`,
            400
          );
        }
      }
    }

    // 3. Sale harus ada, belum batal/return, belum punya DO, dan
    // customerId diambil dari sale (bukan dari body).
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      select: { id: true, customerId: true, status: true },
    });
    if (!sale) return botErr("Transaksi penjualan tidak ditemukan.", 404);
    if (sale.status === "CANCELLED" || sale.status === "RETURN")
      return botErr(
        "Transaksi penjualan sudah dibatalkan / di-return.",
        400
      );
    if (!sale.customerId)
      return botErr("Penjualan ini tidak punya pelanggan.", 400);
    const existingDO = await prisma.deliveryOrder.findFirst({
      where: { saleId },
      select: { id: true },
    });
    if (existingDO)
      return botErr("Transaksi ini sudah dibuatkan Surat Jalan.", 400);

    const actorId = await getBotActorUserId();
    if (!actorId) return botErr("Terjadi kesalahan internal server.", 500);

    let created;
    try {
      created = await withUniqueRetry(() =>
        prisma.$transaction(async (tx) => {
          const doNumber = await generateDONumber(tx);

          // Cek duplikasi lagi DI DALAM transaksi: cek di luar bisa lolos
          // kalau dua pengirim kirim bersamaan.
          const dupInTx = await tx.deliveryOrder.findFirst({
            where: { saleId },
            select: { id: true },
          });
          if (dupInTx)
            throw new Error("SALE_ALREADY_HAS_DO");

          return tx.deliveryOrder.create({
            data: {
              doNumber,
              customerId: sale.customerId as string,
              saleId,
              deliveryDate,
              driver,
              vehicle,
              notes,
              status: "PENDING",
              createdById: actorId,
              deliveryItems: {
                create: items.map((item) => ({
                  productId: item.productId,
                  unitId: item.unitId,
                  quantity: item.quantity,
                  notes: item.notes,
                })),
              },
            },
            include: {
              customer: {
                select: { id: true, name: true, phone: true },
              },
              sale: { select: { id: true, invoiceNumber: true } },
              deliveryItems: {
                include: {
                  product: {
                    select: { id: true, code: true, name: true },
                  },
                  unit: {
                    select: { id: true, name: true, symbol: true },
                  },
                },
              },
            },
          });
        })
      );
    } catch (error) {
      if (error instanceof Error && error.message === "SALE_ALREADY_HAS_DO")
        return botErr("Transaksi ini sudah dibuatkan Surat Jalan.", 400);
      throw error;
    }

    await auditSafe({
      level: auth.level,
      sender: auth.sender,
      method: "POST",
      endpoint: "/api/bot/delivery-orders",
      entityType: "DeliveryOrder",
      entityId: created.id,
      before: undefined,
      after: {
        doNumber: created.doNumber,
        saleId,
        customerId: sale.customerId,
        status: created.status,
        itemCount: items.length,
        driver,
        vehicle,
      },
      success: true,
    });

    return botOk(
      serializeBotData({
        id: created.id,
        doNumber: created.doNumber,
        customer: created.customer,
        sale: created.sale,
        deliveryDate: created.deliveryDate,
        driver: created.driver,
        vehicle: created.vehicle,
        status: created.status,
        receivedBy: created.receivedBy,
        receivedDate: created.receivedDate,
        notes: created.notes,
        createdAt: created.createdAt,
        items: created.deliveryItems.map((item) => ({
          id: item.id,
          product: item.product,
          unit: item.unit,
          quantity: toNum(item.quantity),
          notes: item.notes,
        })),
      })
    );
  } catch (error) {
    console.error("[API_BOT_DELIVERY_ORDERS_POST_ERROR]", error);
    return botErr(sanitizeBotError(error), 500);
  }
}
