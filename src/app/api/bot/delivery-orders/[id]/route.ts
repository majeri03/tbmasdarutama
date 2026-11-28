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
  serializeBotData,
  toNum,
} from "@/lib/bot-auth";
import {
  loadUnitNames,
  primaryQuantityOrThrow,
  decrementStockOrThrow,
} from "@/lib/utils/stock-units";
import { DeliveryStatus, Prisma } from "@prisma/client";

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

// Sentinel: status DO berubah di tengah transaksi (klaim updateMany kena
// 0 baris — pola web di updateDeliveryStatus / cancelDeliveryOrder).
const STATUS_CHANGED = "STATUS_CHANGED";

// ---------------------------------------------------------------------------
// Validasi pasangan sopir-kendaraan (WS-4, disalin dari
// delivery-order.actions.ts validateDriverVehiclePair) — lihat route.ts
// induk untuk penjelasan lengkap.
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

// Helper pengekstrak Bukti Pengiriman dari field proofImage atau tag di
// notes (disalin dari delivery-order.actions.ts resolveProofImage).
function resolveProofImage(
  proofImage?: string | null,
  notes?: string | null
): string | null {
  if (proofImage && proofImage.trim()) return proofImage.trim();
  if (!notes) return null;
  const buktiMatch = notes.match(/\[BUKTI_KIRIM\]:\s*([^\s\]\n]+)/);
  if (buktiMatch && buktiMatch[1]) return buktiMatch[1].trim();
  const lokasiMatch = notes.match(/\[FOTO_LOKASI\]:\s*([^\s\]\n]+)/);
  if (lokasiMatch && lokasiMatch[1]) return lokasiMatch[1].trim();
  return null;
}

type DetailInclude = {
  customer: {
    select: { id: true; code: true; name: true; phone: true; address: true };
  };
  sale: {
    select: {
      id: true;
      invoiceNumber: true;
      saleDate: true;
      grandTotal: true;
      status: true;
    };
  };
  createdBy: { select: { id: true; name: true } };
  deliveryItems: {
    include: {
      product: { select: { id: true; code: true; name: true } };
      unit: { select: { id: true; name: true; symbol: true } };
    };
  };
  deliveryPhotos: {
    orderBy: { createdAt: "desc" };
    select: { id: true; url: true; filename: true; createdAt: true };
  };
};

// Include dipakai inline di tiap query (bukan konstanta bersama) supaya
// inferensi payload Prisma tetap presisi — konstanta bersama melebarkan
// `select: true` jadi boolean dan merusak tipe hasil query.

type DeliveryDetailRow = Prisma.DeliveryOrderGetPayload<{
  include: DetailInclude;
}>;

function serializeDetail(order: DeliveryDetailRow) {
  return serializeBotData({
    id: order.id,
    doNumber: order.doNumber,
    customer: order.customer,
    sale: order.sale
      ? {
          id: order.sale.id,
          invoiceNumber: order.sale.invoiceNumber,
          saleDate: order.sale.saleDate,
          grandTotal: toNum(order.sale.grandTotal),
          status: order.sale.status,
        }
      : null,
    deliveryDate: order.deliveryDate,
    driver: order.driver,
    vehicle: order.vehicle,
    status: order.status,
    receivedBy: order.receivedBy,
    receivedDate: order.receivedDate,
    proofImage: resolveProofImage(order.proofImage, order.notes),
    notes: order.notes,
    createdBy: order.createdBy,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.deliveryItems.map((item) => ({
      id: item.id,
      product: item.product,
      unit: item.unit,
      quantity: toNum(item.quantity),
      notes: item.notes,
    })),
    photos: order.deliveryPhotos.map((p) => ({
      id: p.id,
      url: p.url,
      filename: p.filename,
      createdAt: p.createdAt,
    })),
  });
}

/**
 * GET /api/bot/delivery-orders/[id] — semua level.
 * Detail satu surat jalan + item + penjualan terkait (bila ada).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireBotRead(request);
    if (!auth.ok) return botAuthFail(auth.status);

    const { id } = await context.params;

    const order = await prisma.deliveryOrder.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, code: true, name: true, phone: true, address: true },
        },
        sale: {
          select: {
            id: true,
            invoiceNumber: true,
            saleDate: true,
            grandTotal: true,
            status: true,
          },
        },
        createdBy: { select: { id: true, name: true } },
        deliveryItems: {
          include: {
            product: { select: { id: true, code: true, name: true } },
            unit: { select: { id: true, name: true, symbol: true } },
          },
        },
        deliveryPhotos: {
          orderBy: { createdAt: "desc" },
          select: { id: true, url: true, filename: true, createdAt: true },
        },
      },
    });
    if (!order) return botErr("Surat Jalan tidak ditemukan.", 404);

    return botOk(serializeDetail(order));
  } catch (error) {
    console.error("[API_BOT_DELIVERY_ORDERS_ID_GET_ERROR]", error);
    return botErr(sanitizeBotError(error), 500);
  }
}

/**
 * PUT /api/bot/delivery-orders/[id] — Level 1 SAJA.
 * Ubah surat jalan. Bot menggabungkan dua fungsi web (lihat NOTES.md):
 * - Edit metadata (updateDeliveryOrder): deliveryDate / driver / vehicle /
 *   notes. Status & tanda terima TIDAK bisa diubah lewat jalur ini saja.
 * - Ubah status (updateDeliveryStatus): state machine PENDING ->
 *   IN_TRANSIT / DELIVERED / CANCELLED, IN_TRANSIT -> DELIVERED /
 *   CANCELLED; status terminal (DELIVERED / CANCELLED) tidak bisa diubah
 *   lagi. DELIVERED memotong stok (kecuali penjualan terkait sudah
 *   memotongnya saat dibuat — cek B-5); CANCELLED memakai pola batalkan
 *   web (lihat DELETE di bawah).
 * Aturan web yang ditiru: DO CANCELLED tidak bisa diedit sama sekali;
 * DO DELIVERED masih boleh diedit metadata-nya (tanpa ubah status);
 * validasi pasangan sopir-plat (WS-4) bila driver/vehicle diubah;
 * klaim status di DALAM transaksi (updateMany where status = lama).
 * receivedBy / receivedDate hanya boleh diisi bersamaan dengan perubahan
 * status (bukan saat edit metadata saja).
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireBotWrite(request, [1]);
    if (!auth.ok) return botAuthFail(auth.status);

    const { id } = await context.params;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return botErr("Format data (JSON) tidak valid.", 400);
    }

    const hasDeliveryDate =
      body.deliveryDate !== undefined &&
      body.deliveryDate !== null &&
      body.deliveryDate !== "";
    let deliveryDate: Date | null = null;
    if (hasDeliveryDate) {
      deliveryDate = new Date(String(body.deliveryDate));
      if (Number.isNaN(deliveryDate.getTime()))
        return botErr("Tanggal pengiriman tidak valid.", 400);
    }

    // null eksplisit = kosongkan field (skema web mengizinkan nullable);
    // undefined = tidak diubah.
    let driverValue: string | null | undefined;
    if (body.driver !== undefined) {
      if (body.driver === null) driverValue = null;
      else {
        const t = asText(body.driver, 100);
        if (t === null)
          return botErr("Nama sopir maksimal 100 karakter.", 400);
        driverValue = t;
      }
    }
    const driverProvided = driverValue !== undefined;

    let vehicleValue: string | null | undefined;
    if (body.vehicle !== undefined) {
      if (body.vehicle === null) vehicleValue = null;
      else {
        const t = asText(body.vehicle, 100);
        if (t === null)
          return botErr("Kendaraan maksimal 100 karakter.", 400);
        vehicleValue = t;
      }
    }
    const vehicleProvided = vehicleValue !== undefined;

    let notes: string | null | undefined;
    if (body.notes !== undefined) {
      if (body.notes === null) notes = null;
      else {
        const t = asText(body.notes, 1000);
        if (t === null)
          return botErr("Catatan maksimal 1000 karakter.", 400);
        notes = t;
      }
    }
    const notesProvided = notes !== undefined;

    let statusTarget: DeliveryStatus | null = null;
    if (
      body.status !== undefined &&
      body.status !== null &&
      body.status !== ""
    ) {
      const raw =
        typeof body.status === "string" ? body.status.trim() : "";
      if (!VALID_STATUSES.includes(raw as DeliveryStatus))
        return botErr(
          "Status tidak valid. Pilihan: PENDING, IN_TRANSIT, DELIVERED, CANCELLED.",
          400
        );
      statusTarget = raw as DeliveryStatus;
    }

    const hasReceivedBy =
      body.receivedBy !== undefined && body.receivedBy !== null;
    const receivedBy = hasReceivedBy ? asText(body.receivedBy, 100) : null;
    if (hasReceivedBy && receivedBy === null)
      return botErr("Nama penerima maksimal 100 karakter.", 400);
    const hasReceivedDate =
      body.receivedDate !== undefined &&
      body.receivedDate !== null &&
      body.receivedDate !== "";
    let receivedDate: Date | null = null;
    if (hasReceivedDate) {
      receivedDate = new Date(String(body.receivedDate));
      if (Number.isNaN(receivedDate.getTime()))
        return botErr("Tanggal terima tidak valid.", 400);
    }

    // Tanda terima hanya bisa diisi saat mengubah status (aturan web di
    // updateDeliveryOrder); edit metadata saja tidak boleh menyentuhnya.
    if (!statusTarget && (hasReceivedBy || hasReceivedDate))
      return botErr(
        "Penerima / tanggal terima hanya bisa diisi saat mengubah status.",
        400
      );

    const hasMetadata =
      hasDeliveryDate || driverProvided || vehicleProvided || notesProvided;
    if (!statusTarget && !hasMetadata)
      return botErr("Tidak ada perubahan yang dikirim.", 400);

    const order = await prisma.deliveryOrder.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true } },
        deliveryItems: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
        sale: {
          select: {
            id: true,
            notes: true,
            customerDebts: { select: { paidAmount: true } },
          },
        },
      },
    });
    if (!order) return botErr("Surat Jalan tidak ditemukan.", 404);

    // FIX WS-H (batch 4 item 118): DO yang sudah DIBATALKAN tidak bisa
    // diedit sama sekali.
    if (order.status === DeliveryStatus.CANCELLED)
      return botErr(
        "Surat Jalan yang sudah dibatalkan tidak bisa diedit.",
        400
      );

    const from = order.status;
    const isAutoSale = !!order.sale?.notes?.startsWith("Auto-Invoice DO:");

    // WS-4: validasi pasangan sopir-kendaraan hanya bila salah satunya
    // diubah — pasangan efektif (nilai baru + nilai lama yang tersisa).
    if (driverProvided || vehicleProvided) {
      const effDriver =
        driverValue !== undefined ? driverValue : order.driver;
      const effVehicle =
        vehicleValue !== undefined ? vehicleValue : order.vehicle;
      const pairError = await validateDriverVehiclePair(
        effDriver,
        effVehicle
      );
      if (pairError) return botErr(pairError, 400);
    }

    // State machine web (FIX QA M-9): hanya transisi yang masuk akal, dan
    // status terminal tidak bisa diubah lagi. Pengecualian web
    // DELIVERED -> DELIVERED ("refresh" bukti/penerima) TIDAK didukung
    // bot — bot tidak menerima proofImage, jadi refresh itu no-op.
    if (statusTarget) {
      const ALLOWED: Record<string, string[]> = {
        PENDING: ["IN_TRANSIT", "DELIVERED", "CANCELLED"],
        IN_TRANSIT: ["DELIVERED", "CANCELLED"],
        DELIVERED: [],
        CANCELLED: [],
      };
      if (!ALLOWED[from].includes(statusTarget)) {
        if (from === DeliveryStatus.DELIVERED)
          return botErr(
            "Surat Jalan yang sudah terkirim tidak bisa diubah statusnya.",
            400
          );
        return botErr(
          `Status ${from} tidak bisa diubah ke ${statusTarget}.`,
          400
        );
      }
    }

    const before = {
      doNumber: order.doNumber,
      status: order.status,
      driver: order.driver,
      vehicle: order.vehicle,
      deliveryDate: order.deliveryDate,
    };

    // Aktor hanya dibutuhkan untuk StockMovement saat DELIVERED.
    let actorId: string | null = null;
    if (statusTarget === DeliveryStatus.DELIVERED) {
      actorId = await getBotActorUserId();
      if (!actorId)
        return botErr("Terjadi kesalahan internal server.", 500);
    }

    let updated;
    try {
      if (statusTarget === DeliveryStatus.CANCELLED) {
        // ---- CANCELLED: pola cancelDeliveryOrder. Proteksi pembayaran
        // hanya untuk penjualan otomatis DO ini (penjualan POS asli tidak
        // ikut dibatalkan, jadi cicilannya bukan urusan DO).
        if (isAutoSale && order.sale) {
          const paid = order.sale.customerDebts.find(
            (d) => Number(d.paidAmount) > 0
          );
          if (paid)
            return botErr(
              `Tidak dapat membatalkan: hutang ini sudah dibayar Rp ${Number(
                paid.paidAmount
              ).toLocaleString("id-ID")}. Harap hapus pembayaran dulu di menu Hutang.`,
              400
            );
        }
        updated = await prisma.$transaction(async (tx) => {
          const claimed = await tx.deliveryOrder.updateMany({
            where: { id, status: from },
            data: { status: DeliveryStatus.CANCELLED },
          });
          if (claimed.count === 0) throw new Error(STATUS_CHANGED);
          // Hapus hutang HANYA kalau penjualannya dibuat otomatis oleh DO.
          if (isAutoSale && order.saleId) {
            await tx.customerDebt.deleteMany({
              where: { saleId: order.saleId },
            });
            await tx.sale.update({
              where: { id: order.saleId },
              data: {
                status: "CANCELLED",
                totalAmount: 0,
                grandTotal: 0,
                notes: `Dibatalkan dari DO: ${order.doNumber}`,
              },
            });
          }
          const notesBase =
            notesProvided && notes !== null ? notes : order.notes;
          return tx.deliveryOrder.update({
            where: { id },
            data: {
              status: DeliveryStatus.CANCELLED,
              notes: `${notesBase || ""} [DIBATALKAN]`.trim(),
              ...(hasDeliveryDate
                ? { deliveryDate: deliveryDate as Date }
                : {}),
              ...(driverValue !== undefined
                ? { driver: driverValue }
                : {}),
              ...(vehicleValue !== undefined
                ? { vehicle: vehicleValue }
                : {}),
            },
            include: {
              customer: {
                select: { id: true, code: true, name: true, phone: true, address: true },
              },
              sale: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  saleDate: true,
                  grandTotal: true,
                  status: true,
                },
              },
              createdBy: { select: { id: true, name: true } },
              deliveryItems: {
                include: {
                  product: { select: { id: true, code: true, name: true } },
                  unit: { select: { id: true, name: true, symbol: true } },
                },
              },
              deliveryPhotos: {
                orderBy: { createdAt: "desc" },
                select: { id: true, url: true, filename: true, createdAt: true },
              },
            },
          });
        });
      } else {
        // ---- IN_TRANSIT / DELIVERED / edit metadata: satu transaksi.
        updated = await prisma.$transaction(async (tx) => {
          if (statusTarget) {
            const claimed = await tx.deliveryOrder.updateMany({
              where: { id, status: from },
              data: { status: statusTarget as DeliveryStatus },
            });
            if (claimed.count === 0) throw new Error(STATUS_CHANGED);
          }

          if (statusTarget === DeliveryStatus.DELIVERED) {
            // Potong stok (M-14, disalin dari updateDeliveryStatus).
            // Apakah penjualan terkait sudah memotong stok saat dibuat?
            // (B-5) Kalau ya (penjualan POS / manual), DO tidak boleh
            // memotong lagi.
            let saleAlreadyDeducted = false;
            if (order.saleId) {
              const saleMovements = await tx.stockMovement.findMany({
                where: {
                  referenceId: order.saleId,
                  referenceType: { in: ["Sale", "POS_SALE", "Sale Edit"] },
                  type: "OUT",
                },
                select: { id: true },
                take: 1,
              });
              saleAlreadyDeducted = saleMovements.length > 0;
            }

            if (!saleAlreadyDeducted) {
              const unitNames = await loadUnitNames();
              const needByProduct = new Map<
                string,
                { qtyPrimary: number; name: string }
              >();
              for (const item of order.deliveryItems) {
                const pu = await tx.productUnit.findFirst({
                  where: {
                    productId: item.productId,
                    unitId: item.unitId,
                  },
                });
                if (!pu) {
                  throw new Error(
                    `Satuan untuk ${
                      item.product?.name || "produk"
                    } tidak ditemukan di master.`
                  );
                }
                const qtyPrimary = primaryQuantityOrThrow({
                  quantity: Number(item.quantity),
                  conversionValue: Number(pu.conversionValue),
                  productName: item.product?.name || "Produk",
                  unitName: unitNames.get(item.unitId) || "satuan",
                });
                const prev = needByProduct.get(item.productId);
                needByProduct.set(item.productId, {
                  qtyPrimary: (prev?.qtyPrimary ?? 0) + qtyPrimary,
                  name: item.product?.name || "Produk",
                });
              }
              for (const [productId, need] of needByProduct.entries()) {
                await decrementStockOrThrow(
                  tx,
                  productId,
                  need.qtyPrimary,
                  need.name
                );
                await tx.stockMovement.create({
                  data: {
                    productId,
                    type: "OUT",
                    quantity: need.qtyPrimary,
                    referenceType: "DELIVERY_ORDER",
                    referenceId: order.id,
                    notes: `Pengiriman ke ${order.customer.name}`,
                    createdById: actorId as string,
                  },
                });
              }
            }
          }

          const data: Prisma.DeliveryOrderUpdateInput = {};
          if (statusTarget) data.status = statusTarget;
          if (hasDeliveryDate)
            data.deliveryDate = deliveryDate as Date;
          if (driverValue !== undefined) data.driver = driverValue;
          if (vehicleValue !== undefined) data.vehicle = vehicleValue;
          if (notesProvided && notes !== undefined) data.notes = notes;
          if (hasReceivedBy) data.receivedBy = receivedBy;
          if (hasReceivedDate)
            data.receivedDate = receivedDate as Date;

          return tx.deliveryOrder.update({
            where: { id },
            data,
            include: {
              customer: {
                select: { id: true, code: true, name: true, phone: true, address: true },
              },
              sale: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  saleDate: true,
                  grandTotal: true,
                  status: true,
                },
              },
              createdBy: { select: { id: true, name: true } },
              deliveryItems: {
                include: {
                  product: { select: { id: true, code: true, name: true } },
                  unit: { select: { id: true, name: true, symbol: true } },
                },
              },
              deliveryPhotos: {
                orderBy: { createdAt: "desc" },
                select: { id: true, url: true, filename: true, createdAt: true },
              },
            },
          });
        });
      }
    } catch (error) {
      if (error instanceof Error && error.message === STATUS_CHANGED)
        return botErr(
          "Status surat jalan sudah berubah, muat ulang dulu.",
          400
        );
      // Pesan user-safe dari helper stok web (primaryQuantityOrThrow /
      // decrementStockOrThrow / satuan tidak ditemukan) — tampilkan apa
      // adanya; sisanya jadi error generik.
      if (
        error instanceof Error &&
        (error.message.startsWith("Jumlah ") ||
          error.message.startsWith("Stok ") ||
          error.message.startsWith("Satuan untuk "))
      )
        return botErr(error.message, 400);
      throw error;
    }

    await auditSafe({
      level: auth.level,
      sender: auth.sender,
      method: "PUT",
      endpoint: "/api/bot/delivery-orders/[id]",
      entityType: "DeliveryOrder",
      entityId: id,
      before,
      after: {
        status: updated.status,
        driver: updated.driver,
        vehicle: updated.vehicle,
        deliveryDate: updated.deliveryDate,
        receivedBy: updated.receivedBy,
      },
      success: true,
    });

    return botOk(serializeDetail(updated));
  } catch (error) {
    console.error("[API_BOT_DELIVERY_ORDERS_ID_PUT_ERROR]", error);
    return botErr(sanitizeBotError(error), 500);
  }
}

/**
 * DELETE /api/bot/delivery-orders/[id] — Level 1 SAJA.
 * BATALKAN surat jalan (status CANCELLED), BUKAN hard-delete. Meniru
 * cancelDeliveryOrder di delivery-order.actions.ts:
 * - DELIVERED ditolak (sudah terkirim tidak bisa dibatalkan lewat bot);
 *   CANCELLED ditolak (sudah batal).
 * - Proteksi pembayaran: kalau penjualan OTOMATIS DO ini sudah ada
 *   cicilan masuk (paidAmount > 0), tolak — hapus pembayaran dulu di
 *   menu Hutang. Penjualan POS asli tidak ikut dibatalkan.
 * - Stok TIDAK dikembalikan (M-12): DO yang bisa dibatalkan masih
 *   PENDING / IN_TRANSIT, dan di status itu stok belum pernah dipotong.
 * - Bila penjualan otomatis: hutangnya dihapus, Sale jadi CANCELLED
 *   dengan total 0. Berbeda dengan deleteDeliveryOrder web (hard-delete
 *   DO + Sale + item) — bot TIDAK PERNAH hard-delete.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireBotWrite(request, [1]);
    if (!auth.ok) return botAuthFail(auth.status);

    const { id } = await context.params;

    const order = await prisma.deliveryOrder.findUnique({
      where: { id },
      select: {
        id: true,
        doNumber: true,
        status: true,
        saleId: true,
        notes: true,
        sale: {
          select: {
            id: true,
            notes: true,
            customerDebts: { select: { paidAmount: true } },
          },
        },
      },
    });
    if (!order) return botErr("Surat Jalan tidak ditemukan.", 404);
    if (order.status === DeliveryStatus.DELIVERED)
      return botErr(
        "Surat Jalan yang sudah terkirim (DITERIMA) tidak bisa dibatalkan.",
        400
      );
    if (order.status === DeliveryStatus.CANCELLED)
      return botErr("Surat Jalan ini sudah dibatalkan sebelumnya.", 400);

    const isAutoSale = !!order.sale?.notes?.startsWith("Auto-Invoice DO:");
    if (isAutoSale && order.sale) {
      const paid = order.sale.customerDebts.find(
        (d) => Number(d.paidAmount) > 0
      );
      if (paid)
        return botErr(
          `Tidak dapat membatalkan: hutang ini sudah dibayar Rp ${Number(
            paid.paidAmount
          ).toLocaleString("id-ID")}. Harap hapus pembayaran dulu di menu Hutang.`,
          400
        );
    }

    const from = order.status;
    let cancelled;
    try {
      cancelled = await prisma.$transaction(async (tx) => {
        const claimed = await tx.deliveryOrder.updateMany({
          where: { id, status: from },
          data: { status: DeliveryStatus.CANCELLED },
        });
        if (claimed.count === 0) throw new Error(STATUS_CHANGED);
        if (isAutoSale && order.saleId) {
          await tx.customerDebt.deleteMany({
            where: { saleId: order.saleId },
          });
          await tx.sale.update({
            where: { id: order.saleId },
            data: {
              status: "CANCELLED",
              totalAmount: 0,
              grandTotal: 0,
              notes: `Dibatalkan dari DO: ${order.doNumber}`,
            },
          });
        }
        return tx.deliveryOrder.update({
          where: { id },
          data: {
            status: DeliveryStatus.CANCELLED,
            notes: `${order.notes || ""} [DIBATALKAN]`.trim(),
          },
          select: { id: true, doNumber: true, status: true },
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message === STATUS_CHANGED)
        return botErr(
          "Status surat jalan sudah berubah, muat ulang dulu.",
          400
        );
      throw error;
    }

    await auditSafe({
      level: auth.level,
      sender: auth.sender,
      method: "DELETE",
      endpoint: "/api/bot/delivery-orders/[id]",
      entityType: "DeliveryOrder",
      entityId: id,
      before: { doNumber: order.doNumber, status: from },
      after: { status: "CANCELLED" },
      success: true,
    });

    return botOk({
      id: cancelled.id,
      doNumber: cancelled.doNumber,
      status: cancelled.status,
    });
  } catch (error) {
    console.error("[API_BOT_DELIVERY_ORDERS_ID_DELETE_ERROR]", error);
    return botErr(sanitizeBotError(error), 500);
  }
}
