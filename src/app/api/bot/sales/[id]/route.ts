import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma, PaymentMethod, SaleStatus } from "@prisma/client";
import {
  requireBotRead,
  requireBotWrite,
  botOk,
  botErr,
  sanitizeBotError,
  toNum,
  writeBotAudit,
  getBotActorUserId,
} from "@/lib/bot-auth";
import {
  loadCheckoutProducts,
  loadUnitNames,
  prepareCheckoutItems,
  computeGrandTotal,
  validatePaymentAndChange,
  decrementStockOrThrow,
  generateDebtNumber,
  primaryQuantityOrThrow,
  reverseCashIn,
  withUniqueRetry,
} from "@/lib/utils/stock-units";

// WS-D1 (28 Nov 2026) — detail / ubah / batalkan penjualan untuk API bot.
// - GET: baca saja, semua level.
// - PUT: Level 1 SAJA, meniru updateSale di src/lib/actions/sale.actions.ts
//   (EditTransaction web): hapus item lama + buat item baru, hitung ulang
//   dari harga master, selisih stok, cicilan lama dipertahankan (M-3),
//   utang disesuaikan, item Surat Jalan ikut diperbarui.
// - DELETE: Level 1 SAJA, BUKAN hard-delete — meniru cancelSale
//   (Tutup Buku): status CANCELLED, stok kembali, utang CREDIT yang belum
//   ada cicilannya DIHAPUS (DebtStatus tidak punya CANCELLED), kas dibalik,
//   Surat Jalan ikut CANCELLED. Penjualan lunas DITOLAK (lebih ketat dari
//   web — lihat catatan di handler DELETE).
// Poin TIDAK pernah diubah di PUT/DELETE — web juga tidak membalik poin
// saat edit/batal (hanya createSale yang memberi poin).
// File R2 bukti transfer [BUKTI_TF]: web menghapus file R2-nya kalau tag
// dihapus saat edit — bot tidak punya akses R2, jadi tag yang dihapus
// lewat PUT bisa meninggalkan file yatim (dicatat di NOTES).

type RouteContext = { params: Promise<{ id: string }> };

// Pesan auth gagal. 403 di PUT/DELETE hanya bisa dari Level 2/3
// (hanya Level 1 yang boleh) — pesannya menyebut itu.
function botAuthFail(status: 401 | 403 | 429) {
  if (status === 403)
    return botErr("Maaf, aksi ini hanya untuk Level 1.", 403);
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

// ---------------------------------------------------------------------------
// Validasi body (cermin createSaleSchema — tanpa total/harga dari klien).
// ---------------------------------------------------------------------------
type SaleItemInput = {
  productId: string;
  productUnitId: string;
  quantity: number;
  discount: number;
};

function parseSaleItems(
  value: unknown
): { ok: true; items: SaleItemInput[] } | { ok: false; error: string } {
  if (!Array.isArray(value))
    return { ok: false, error: "Daftar produk wajib diisi." };
  if (value.length < 1)
    return { ok: false, error: "Minimal harus ada 1 produk." };
  if (value.length > 200)
    return { ok: false, error: "Maksimal 200 produk per transaksi." };
  const seen = new Set<string>();
  const items: SaleItemInput[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null)
      return { ok: false, error: "Format item produk tidak valid." };
    const r = raw as Record<string, unknown>;
    const productId =
      typeof r.productId === "string" ? r.productId.trim() : "";
    if (!productId) return { ok: false, error: "Produk wajib dipilih." };
    const productUnitId =
      typeof r.productUnitId === "string" ? r.productUnitId.trim() : "";
    if (!productUnitId)
      return { ok: false, error: "Satuan wajib dipilih." };
    const quantity = asNumber(r.quantity);
    if (
      quantity === null ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 1_000_000
    )
      return {
        ok: false,
        error: "Jumlah tiap produk harus bilangan bulat 1 sampai 1.000.000.",
      };
    const discount = r.discount === undefined ? 0 : asNumber(r.discount);
    if (discount === null || discount < 0 || discount > 1_000_000_000)
      return { ok: false, error: "Diskon per item tidak boleh negatif." };
    const key = `${productId}-${productUnitId}`;
    if (seen.has(key))
      return {
        ok: false,
        error: "Tidak boleh ada produk dengan satuan yang sama lebih dari 1x.",
      };
    seen.add(key);
    items.push({ productId, productUnitId, quantity, discount });
  }
  return { ok: true, items };
}

const PAYMENT_METHODS = [
  "CASH",
  "TRANSFER",
  "QRIS",
  "DEBIT_CARD",
  "CREDIT",
] as const;

function parsePaymentMethod(
  value: unknown
): { ok: true; method: string } | { ok: false; error: string } {
  if (typeof value !== "string" || !value.trim())
    return { ok: false, error: "Metode pembayaran wajib dipilih." };
  const m = value.trim().toUpperCase();
  if (m === "DP") return { ok: true, method: "CREDIT" };
  if ((PAYMENT_METHODS as readonly string[]).includes(m))
    return { ok: true, method: m };
  return {
    ok: false,
    error:
      "Metode pembayaran tidak valid. Pilih CASH, TRANSFER, QRIS, DEBIT_CARD, CREDIT, atau DP.",
  };
}

// ---------------------------------------------------------------------------
// Serializer — sama seperti route.ts (eksplisit per field; tanpa buyPrice).
// ---------------------------------------------------------------------------
async function fetchSaleDetail(id: string) {
  return prisma.sale.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          code: true,
          name: true,
          phone: true,
          address: true,
          type: true,
          points: true,
        },
      },
      cashier: { select: { name: true } },
      salesman: { select: { id: true, name: true } },
      saleItems: {
        include: {
          product: { select: { id: true, code: true, name: true } },
          unit: { select: { id: true, name: true, symbol: true } },
        },
      },
      customerDebts: {
        select: {
          id: true,
          debtNumber: true,
          totalDebt: true,
          paidAmount: true,
          remainingDebt: true,
          dueDate: true,
          status: true,
          notes: true,
        },
      },
      deliveryOrder: {
        select: {
          id: true,
          doNumber: true,
          status: true,
          driver: true,
          vehicle: true,
          deliveryDate: true,
        },
      },
    },
  });
}

type SaleDetail = NonNullable<Awaited<ReturnType<typeof fetchSaleDetail>>>;

function serializeSaleDetail(sale: SaleDetail) {
  return {
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    saleDate: sale.saleDate,
    totalAmount: toNum(sale.totalAmount),
    discount: toNum(sale.discount),
    tax: toNum(sale.tax),
    grandTotal: toNum(sale.grandTotal),
    paymentMethod: sale.paymentMethod,
    paidAmount: toNum(sale.paidAmount),
    changeAmount: toNum(sale.changeAmount),
    status: sale.status,
    notes: sale.notes,
    customer: sale.customer
      ? {
          id: sale.customer.id,
          code: sale.customer.code,
          name: sale.customer.name,
          phone: sale.customer.phone,
          address: sale.customer.address,
          type: sale.customer.type,
          points: sale.customer.points,
        }
      : null,
    cashier: { name: sale.cashier.name },
    salesman: sale.salesman
      ? { id: sale.salesman.id, name: sale.salesman.name }
      : null,
    items: sale.saleItems.map((item) => ({
      id: item.id,
      product: {
        id: item.product.id,
        code: item.product.code,
        name: item.product.name,
      },
      unit: { id: item.unit.id, name: item.unit.name, symbol: item.unit.symbol },
      quantity: item.quantity,
      unitPrice: toNum(item.unitPrice),
      discount: toNum(item.discount),
      subtotal: toNum(item.subtotal),
    })),
    debts: sale.customerDebts.map((d) => ({
      id: d.id,
      debtNumber: d.debtNumber,
      totalDebt: toNum(d.totalDebt),
      paidAmount: toNum(d.paidAmount),
      remainingDebt: toNum(d.remainingDebt),
      dueDate: d.dueDate,
      status: d.status,
      notes: d.notes,
    })),
    deliveryOrder: sale.deliveryOrder
      ? {
          id: sale.deliveryOrder.id,
          doNumber: sale.deliveryOrder.doNumber,
          status: sale.deliveryOrder.status,
          driver: sale.deliveryOrder.driver,
          vehicle: sale.deliveryOrder.vehicle,
          deliveryDate: sale.deliveryOrder.deliveryDate,
        }
      : null,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
  };
}

/**
 * GET /api/bot/sales/[id] — semua level boleh baca.
 * Detail penjualan + items + pelanggan + utang + Surat Jalan.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireBotRead(request);
    if (!auth.ok) return botAuthFail(auth.status);

    const { id } = await context.params;
    const sale = await fetchSaleDetail(id);
    if (!sale) return botErr("Penjualan tidak ditemukan.", 404);

    return botOk(serializeSaleDetail(sale));
  } catch (error) {
    console.error("[API_BOT_SALES_ID_GET_ERROR]", error);
    return botErr(sanitizeBotError(error), 500);
  }
}

/**
 * PUT /api/bot/sales/[id] — Level 1 SAJA.
 * Ubah penjualan (state baru LENGKAP, cermin updateSale web):
 * - items WAJIB (daftar baru penuh); customerId/paymentMethod/paidAmount/
 *   discount/tax/notes bila kosong = dipertahankan dari yang lama;
 *   salesmanId: string = ganti, null = kosongkan, kosong = dipertahankan.
 * - harga/total dihitung ulang dari sellPrice master; selisih stok
 *   (satuan utama) dicek lalu diterapkan atomik + StockMovement.
 * - cicilan yang sudah dibayar dipertahankan (M-3): total baru tidak boleh
 *   lebih kecil dari yang sudah dibayar; utang disesuaikan/dibuat/dilunasi
 *   mengikuti perubahan metode bayar (persis web).
 * - DITOLAK bila: tidak ditemukan, sudah CANCELLED/RETURN, Surat Jalan
 *   sudah IN_TRANSIT/DELIVERED, stok tidak cukup, satuan lama hilang
 *   dari master, atau total baru < cicilan yang sudah dibayar.
 * - Poin & kas TIDAK diubah saat edit (web juga tidak).
 * - Prefix "Auto-Invoice DO:" di notes dipertahankan (penjualan otomatis
 *   Surat Jalan — guard stok hantu web).
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

    const itemsParsed = parseSaleItems(body.items);
    if (!itemsParsed.ok) return botErr(itemsParsed.error, 400);
    const items = itemsParsed.items;

    // Field opsional: kosong = pertahankan nilai lama.
    const customerIdRaw =
      typeof body.customerId === "string" && body.customerId.trim() !== ""
        ? body.customerId.trim()
        : null;

    let paymentMethodRaw: string | null = null;
    if (body.paymentMethod !== undefined && body.paymentMethod !== null) {
      const parsed = parsePaymentMethod(body.paymentMethod);
      if (!parsed.ok) return botErr(parsed.error, 400);
      paymentMethodRaw = parsed.method;
    }

    const discountRaw =
      body.discount === undefined || body.discount === null
        ? null
        : asNumber(body.discount);
    if (discountRaw !== null && (discountRaw < 0 || discountRaw > 1_000_000_000))
      return botErr("Diskon tidak boleh negatif.", 400);

    const taxRaw =
      body.tax === undefined || body.tax === null ? null : asNumber(body.tax);
    if (taxRaw !== null && (taxRaw < 0 || taxRaw > 100_000_000))
      return botErr("Pajak tidak boleh negatif.", 400);

    let paidAmountRaw: number | null = null;
    if (body.paidAmount !== undefined && body.paidAmount !== null) {
      const n = asNumber(body.paidAmount);
      if (n === null || n < 0 || n > 1_000_000_000)
        return botErr("Jumlah bayar tidak valid.", 400);
      paidAmountRaw = n;
    }

    const notesRaw =
      typeof body.notes === "string" && body.notes.trim() !== ""
        ? body.notes.trim()
        : null;
    if (notesRaw && notesRaw.length > 500)
      return botErr("Catatan maksimal 500 karakter.", 400);

    // salesmanId: ada string = ganti; null eksplisit = kosongkan;
    // tidak ada di body = pertahankan.
    let salesmanId: string | null | undefined;
    if ("salesmanId" in body) {
      if (body.salesmanId === null) salesmanId = null;
      else if (
        typeof body.salesmanId === "string" &&
        body.salesmanId.trim() !== ""
      )
        salesmanId = body.salesmanId.trim();
      else if (typeof body.salesmanId === "string") salesmanId = null;
      else return botErr("Salesman tidak valid.", 400);
    }

    // --- Muat penjualan lama + relasi (cermin updateSale) ---
    const existing = await prisma.sale.findUnique({
      where: { id },
      include: {
        saleItems: true,
        deliveryOrder: { include: { deliveryItems: true } },
        customerDebts: true,
      },
    });
    if (!existing) return botErr("Penjualan tidak ditemukan.", 404);
    if (
      existing.status === "CANCELLED" ||
      existing.status === "RETURN"
    )
      return botErr(
        "Tidak dapat mengubah transaksi yang dibatalkan/return.",
        400
      );
    if (
      existing.deliveryOrder &&
      (existing.deliveryOrder.status === "IN_TRANSIT" ||
        existing.deliveryOrder.status === "DELIVERED")
    )
      return botErr(
        "Tidak dapat mengubah transaksi karena Surat Jalan sudah di jalan (IN_TRANSIT) atau Selesai.",
        400
      );

    // --- Resolve nilai baru (default = nilai lama) ---
    const newCustomerId = customerIdRaw ?? existing.customerId;
    if (!newCustomerId)
      return botErr("Customer wajib dipilih.", 400);
    const customer = await prisma.customer.findUnique({
      where: { id: newCustomerId },
      select: { id: true, type: true },
    });
    if (!customer) return botErr("Customer tidak ditemukan.", 400);

    if (salesmanId) {
      const salesman = await prisma.salesman.findUnique({
        where: { id: salesmanId },
        select: { id: true, isActive: true },
      });
      if (!salesman) return botErr("Salesman tidak ditemukan.", 400);
      if (!salesman.isActive)
        return botErr("Salesman sudah nonaktif, pilih salesman lain.", 400);
    }
    const newSalesmanId =
      salesmanId === undefined ? existing.salesmanId : salesmanId;

    const newPaymentMethod = paymentMethodRaw ?? existing.paymentMethod;
    const newDiscount = discountRaw ?? Number(existing.discount);
    const newTax = taxRaw ?? Number(existing.tax);
    const newPaidAmount = paidAmountRaw ?? Number(existing.paidAmount);

    // --- Hitung ulang dari harga master ---
    const productIds = items.map((i) => i.productId);
    const oldProductIds = existing.saleItems.map((i) => i.productId);
    const allProductIds = Array.from(
      new Set([...productIds, ...oldProductIds])
    );
    const checkoutProducts = await loadCheckoutProducts(allProductIds);
    const unitNames = await loadUnitNames();
    const productMap = new Map(checkoutProducts.map((p) => [p.id, p]));

    let prepared;
    try {
      prepared = prepareCheckoutItems(items, checkoutProducts, unitNames);
    } catch (e) {
      return botErr(
        e instanceof Error ? e.message : "Item tidak valid.",
        400
      );
    }
    const totals = computeGrandTotal(
      prepared.totalAmount,
      newDiscount,
      newTax
    );
    if (newTax > prepared.totalAmount * 0.25)
      return botErr("Pajak maksimal 25% dari total.", 400);

    let changeAmount: number;
    try {
      ({ changeAmount } = validatePaymentAndChange({
        paymentMethod: newPaymentMethod,
        customerType: customer.type,
        grandTotal: totals.grandTotal,
        paidAmount: newPaidAmount,
      }));
    } catch (e) {
      return botErr(
        e instanceof Error ? e.message : "Pembayaran tidak valid.",
        400
      );
    }

    // Cicilan yang sudah dibayar tidak boleh hilang saat edit (M-3).
    const existingDebt = existing.customerDebts?.[0] ?? null;
    const preservedPaid = existingDebt ? Number(existingDebt.paidAmount) : 0;
    if (preservedPaid > totals.grandTotal) {
      return botErr(
        `Total baru (Rp ${totals.grandTotal.toLocaleString("id-ID")}) lebih kecil dari yang sudah dibayar (Rp ${preservedPaid.toLocaleString("id-ID")}). Kurangi pembayaran dulu di menu Hutang sebelum mengedit.`,
        400
      );
    }
    const effectivePaid =
      newPaymentMethod === PaymentMethod.CREDIT
        ? Math.max(preservedPaid, newPaidAmount)
        : newPaidAmount;

    // Selisih stok (satuan utama): item lama dikurangi, item baru ditambah.
    const stockDiff = new Map<string, number>();
    for (const oldItem of existing.saleItems) {
      const oldProduct = productMap.get(oldItem.productId);
      const oldPu = oldProduct?.productUnits.find(
        (pu) => pu.unitId === oldItem.unitId
      );
      if (!oldPu) {
        return botErr(
          `Satuan lama untuk ${oldProduct?.name || "produk"} tidak ditemukan di master. Perbaiki data produk dulu sebelum mengedit transaksi ini.`,
          400
        );
      }
      let qtyPrimaryOld: number;
      try {
        qtyPrimaryOld = primaryQuantityOrThrow({
          quantity: oldItem.quantity,
          conversionValue: oldPu.conversionValue,
          productName: oldProduct?.name || "Produk",
          unitName: unitNames.get(oldItem.unitId) || "satuan",
        });
      } catch (e) {
        return botErr(
          e instanceof Error ? e.message : "Item lama tidak valid.",
          400
        );
      }
      stockDiff.set(
        oldItem.productId,
        (stockDiff.get(oldItem.productId) || 0) - qtyPrimaryOld
      );
    }
    for (const [pId, qtyPrimary] of prepared.qtyPrimaryByProduct.entries()) {
      stockDiff.set(pId, (stockDiff.get(pId) || 0) + qtyPrimary);
    }
    for (const [pId, diffQty] of stockDiff.entries()) {
      if (diffQty > 0) {
        const product = productMap.get(pId);
        if (!product) return botErr("Produk tidak ditemukan.", 400);
        if (product.currentStock < diffQty) {
          return botErr(
            `Stok ${product.name} tidak mencukupi untuk penambahan.`,
            400
          );
        }
      }
    }

    // Prefix penjualan otomatis Surat Jalan dipertahankan (cermin web).
    const isAutoSaleEdit = !!existing.notes?.startsWith("Auto-Invoice DO:");
    const autoSalePrefix = isAutoSaleEdit
      ? (existing.notes!.match(/^Auto-Invoice DO:\s*\S+\.\s*/)?.[0] ??
        "Auto-Invoice DO: ")
      : "";
    const finalNotes = !isAutoSaleEdit
      ? (notesRaw || existing.notes)
      : notesRaw
        ? notesRaw.startsWith("Auto-Invoice DO:")
          ? notesRaw
          : `${autoSalePrefix}${notesRaw}`
        : existing.notes;

    const actorId = await getBotActorUserId();
    if (!actorId) return botErr("Terjadi kesalahan internal server.", 500);

    const beforeSummary = {
      invoiceNumber: existing.invoiceNumber,
      customerId: existing.customerId,
      grandTotal: Number(existing.grandTotal),
      paymentMethod: existing.paymentMethod,
      paidAmount: Number(existing.paidAmount),
      status: existing.status,
      itemCount: existing.saleItems.length,
    };

    // --- Transaksi (cermin updateSale) ---
    try {
      await withUniqueRetry(() =>
        prisma.$transaction(
          async (tx) => {
            await tx.saleItem.deleteMany({ where: { saleId: id } });
            if (existing.deliveryOrder) {
              await tx.deliveryItem.deleteMany({
                where: { deliveryOrderId: existing.deliveryOrder.id },
              });
            }

            const status =
              newPaymentMethod === PaymentMethod.CREDIT
                ? effectivePaid >= totals.grandTotal
                  ? SaleStatus.COMPLETED
                  : SaleStatus.PENDING
                : SaleStatus.COMPLETED;

            await tx.sale.update({
              where: { id },
              data: {
                customerId: newCustomerId,
                salesmanId: newSalesmanId,
                totalAmount: prepared.totalAmount,
                discount: totals.discount,
                tax: totals.tax,
                grandTotal: totals.grandTotal,
                paymentMethod: newPaymentMethod as PaymentMethod,
                paidAmount: effectivePaid,
                changeAmount,
                status,
                notes: finalNotes,
                saleItems: {
                  create: prepared.lines.map((item) => ({
                    productId: item.productId,
                    unitId: item.unitId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    subtotal: item.subtotal,
                  })),
                },
              },
            });

            if (existing.deliveryOrder) {
              await tx.deliveryOrder.update({
                where: { id: existing.deliveryOrder.id },
                data: {
                  customerId: newCustomerId,
                  deliveryItems: {
                    create: prepared.lines.map((item) => ({
                      productId: item.productId,
                      unitId: item.unitId,
                      quantity: item.quantity,
                    })),
                  },
                },
              });
            }

            // Selisih stok + log (penambahan dicek atomik).
            for (const [pId, diffQty] of stockDiff.entries()) {
              if (diffQty !== 0) {
                if (diffQty > 0) {
                  const product = checkoutProducts.find((p) => p.id === pId);
                  await decrementStockOrThrow(
                    tx,
                    pId,
                    diffQty,
                    product?.name || "Produk"
                  );
                } else {
                  await tx.product.update({
                    where: { id: pId },
                    data: { currentStock: { increment: -diffQty } },
                  });
                }
                await tx.stockMovement.create({
                  data: {
                    productId: pId,
                    type: diffQty > 0 ? "OUT" : "IN",
                    quantity: Math.abs(diffQty),
                    notes: `Edit Penjualan ${existing.invoiceNumber} (via bot)`,
                    referenceType: "Sale Edit",
                    referenceId: id,
                    createdById: actorId,
                  },
                });
              }
            }

            // Utang (M-3: cicilan dipertahankan).
            if (newPaymentMethod === PaymentMethod.CREDIT) {
              const remainingDebt = totals.grandTotal - effectivePaid;
              const debtStatus =
                remainingDebt <= 0
                  ? "PAID"
                  : effectivePaid > 0
                    ? "PARTIAL"
                    : "UNPAID";
              if (existingDebt) {
                await tx.customerDebt.update({
                  where: { id: existingDebt.id },
                  data: {
                    customerId: newCustomerId,
                    totalDebt: totals.grandTotal,
                    paidAmount: effectivePaid,
                    remainingDebt,
                    status: debtStatus,
                  },
                });
              } else if (remainingDebt > 0) {
                const debtNumber = await generateDebtNumber(tx);
                await tx.customerDebt.create({
                  data: {
                    debtNumber,
                    saleId: id,
                    customerId: newCustomerId,
                    totalDebt: totals.grandTotal,
                    paidAmount: effectivePaid,
                    remainingDebt,
                    status: debtStatus,
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    notes: `Utang dari edit penjualan ${existing.invoiceNumber}`,
                  },
                });
              }
            } else if (existingDebt) {
              await tx.customerDebt.update({
                where: { id: existingDebt.id },
                data: {
                  paidAmount: totals.grandTotal,
                  status: "PAID",
                  remainingDebt: 0,
                  notes: `[LUNAS KARENA EDIT METODE PEMBAYARAN KE ${newPaymentMethod}]`,
                },
              });
            }
          },
          { maxWait: 10000, timeout: 30000 }
        )
      );
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Stok "))
        return botErr(error.message, 400);
      throw error;
    }

    const full = await fetchSaleDetail(id);
    if (!full) return botErr("Terjadi kesalahan internal server.", 500);

    await auditSafe({
      level: auth.level,
      sender: auth.sender,
      method: "PUT",
      endpoint: "/api/bot/sales/[id]",
      entityType: "Sale",
      entityId: id,
      before: beforeSummary,
      after: {
        invoiceNumber: existing.invoiceNumber,
        customerId: newCustomerId,
        grandTotal: totals.grandTotal,
        paymentMethod: newPaymentMethod,
        paidAmount: effectivePaid,
        status: full.status,
        itemCount: items.length,
      },
      success: true,
    });

    return botOk(serializeSaleDetail(full));
  } catch (error) {
    console.error("[API_BOT_SALES_ID_PUT_ERROR]", error);
    return botErr(sanitizeBotError(error), 500);
  }
}

// Sentinel untuk klaim pembatalan di dalam transaksi (dua pembatalan
// bersamaan tidak boleh mengembalikan stok 2x — pola cancelSale web).
const ALREADY_CANCELLED = "ALREADY_CANCELLED";

/**
 * DELETE /api/bot/sales/[id] — Level 1 SAJA. MEMBATALKAN (Tutup Buku),
 * BUKAN hard-delete: status CANCELLED, stok kembali, utang CREDIT yang
 * belum ada cicilannya DIHAPUS, kas dibalik, Surat Jalan ikut CANCELLED.
 * Body opsional: { "reason": "..." } (default "Dibatalkan via bot").
 *
 * DITOLAK bila: tidak ditemukan, sudah CANCELLED/RETURN, Surat Jalan
 * sudah IN_TRANSIT/DELIVERED, utang sudah ada cicilannya (M-4),
 * ATAU penjualan sudah lunas. Aturan lunas (instruksi WS-D1, LEBIH
 * KETAT dari cancelSale web — web mengizinkan batal tunai lunas karena
 * kasnya dibalik via reverseCashIn): tolak bila ada utang berstatus
 * PAID, atau paidAmount >= grandTotal (metode bayar apa pun — termasuk
 * CREDIT yang dibayar lunas saat checkout dan tidak punya baris utang;
 * celah ini DITUTUP koordinator WS-D, lihat NOTES gabungan).
 * Praktisnya: bot DELETE hanya untuk penjualan CREDIT yang masih
 * PENDING dan belum ada cicilan.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireBotWrite(request, [1]);
    if (!auth.ok) return botAuthFail(auth.status);

    const { id } = await context.params;

    let reason = "Dibatalkan via bot";
    try {
      const body = (await request.json()) as Record<string, unknown>;
      if (typeof body.reason === "string" && body.reason.trim() !== "") {
        reason = body.reason.trim();
      }
      if (reason.length > 500)
        return botErr("Alasan pembatalan maksimal 500 karakter.", 400);
    } catch {
      // Body kosong / bukan JSON -> pakai alasan default.
    }

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        saleItems: true,
        deliveryOrder: true,
        customerDebts: true,
      },
    });
    if (!sale) return botErr("Penjualan tidak ditemukan.", 404);

    if (sale.status === SaleStatus.CANCELLED)
      return botErr("Transaksi sudah dibatalkan sebelumnya.", 400);
    if (sale.status === SaleStatus.RETURN)
      return botErr(
        "Transaksi yang sudah di-return tidak dapat dibatalkan.",
        400
      );
    if (
      sale.deliveryOrder &&
      (sale.deliveryOrder.status === "IN_TRANSIT" ||
        sale.deliveryOrder.status === "DELIVERED")
    )
      return botErr(
        "Tidak dapat membatalkan transaksi karena Surat Jalan sedang dikirim (IN_TRANSIT) atau sudah terkirim (DELIVERED).",
        400
      );

    // M-4 (web): hutang yang sudah ada cicilannya tidak boleh dibatalkan
    // diam-diam — cicilan itu uang yang sudah masuk.
    const paidDebt = sale.customerDebts.find(
      (d) => Number(d.paidAmount) > 0
    );
    if (paidDebt) {
      return botErr(
        `Tidak dapat membatalkan: hutang ini sudah dibayar Rp ${Number(paidDebt.paidAmount).toLocaleString("id-ID")}. Hapus pembayaran dulu di menu Hutang.`,
        400
      );
    }

    // Guard lunas khusus bot (lebih ketat dari web — lihat docstring).
    // Ditutup koordinator WS-D: CREDIT yang dibayar lunas saat checkout
    // (tanpa baris utang) ikut ditolak — penjualan lunas tidak boleh
    // dibatalkan lewat bot, metode bayar apa pun.
    const debtPaid = sale.customerDebts.some((d) => d.status === "PAID");
    const fullyPaid =
      Number(sale.paidAmount) >= Number(sale.grandTotal);
    if (debtPaid || fullyPaid) {
      return botErr(
        "Maaf, penjualan yang sudah lunas tidak dapat dibatalkan lewat bot. Pembatalan penjualan lunas hanya bisa dilakukan di dashboard web.",
        400
      );
    }

    const actorId = await getBotActorUserId();
    if (!actorId) return botErr("Terjadi kesalahan internal server.", 500);

    // Guard stok hantu (web): penjualan otomatis Surat Jalan TIDAK PERNAH
    // memotong stok, jadi membatalkannya tidak boleh mengembalikan stok.
    const isAutoSale = !!sale.notes?.startsWith("Auto-Invoice DO:");
    const restoreItems: Array<{
      productId: string;
      qtyPrimary: number;
      productName: string;
    }> = [];
    if (!isAutoSale) {
      const productIds = Array.from(
        new Set(sale.saleItems.map((i) => i.productId))
      );
      const checkoutProducts = await loadCheckoutProducts(productIds);
      const unitNames = await loadUnitNames();
      for (const item of sale.saleItems) {
        const product = checkoutProducts.find((p) => p.id === item.productId);
        const pu = product?.productUnits.find(
          (u) => u.unitId === item.unitId
        );
        if (!product || !pu) {
          return botErr(
            `Satuan untuk ${product?.name || "produk"} tidak ditemukan di master. Perbaiki data produk dulu.`,
            400
          );
        }
        let qtyPrimary: number;
        try {
          qtyPrimary = primaryQuantityOrThrow({
            quantity: item.quantity,
            conversionValue: pu.conversionValue,
            productName: product.name,
            unitName: unitNames.get(item.unitId) || "satuan",
          });
        } catch (e) {
          return botErr(
            e instanceof Error ? e.message : "Item tidak valid.",
            400
          );
        }
        restoreItems.push({
          productId: item.productId,
          qtyPrimary,
          productName: product.name,
        });
      }
    }

    const beforeSummary = {
      invoiceNumber: sale.invoiceNumber,
      grandTotal: Number(sale.grandTotal),
      paymentMethod: sale.paymentMethod,
      paidAmount: Number(sale.paidAmount),
      status: sale.status,
      itemCount: sale.saleItems.length,
    };

    try {
      await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // Klaim di DALAM transaksi: dua pembatalan bersamaan tidak boleh
          // mengembalikan stok 2x.
          const claimed = await tx.sale.updateMany({
            where: { id, status: { not: SaleStatus.CANCELLED } },
            data: { status: SaleStatus.CANCELLED },
          });
          if (claimed.count === 0) throw new Error(ALREADY_CANCELLED);
          await tx.sale.update({
            where: { id },
            data: {
              status: SaleStatus.CANCELLED,
              notes: `${sale.notes || ""}\n[CANCELLED] ${reason}`.trim(),
            },
          });

          // Kembalikan stok (satuan utama) + catat log.
          for (const item of restoreItems) {
            await tx.product.update({
              where: { id: item.productId },
              data: { currentStock: { increment: item.qtyPrimary } },
            });
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: "IN",
                quantity: item.qtyPrimary,
                notes: `Pembatalan penjualan ${sale.invoiceNumber} - ${reason} (via bot)`,
                referenceType: "Sale Cancellation",
                referenceId: sale.id,
                createdById: actorId,
              },
            });
          }

          // Utang yang dibatalkan DIHAPUS (belum ada pembayaran),
          // bukan ditandai PAID — menandai PAID membuat laporan hutang salah.
          if (sale.paymentMethod === PaymentMethod.CREDIT) {
            await tx.customerDebt.deleteMany({
              where: { saleId: sale.id },
            });
          }

          // Balikkan kas masuk dari penjualan ini.
          await reverseCashIn(tx, {
            invoiceNumber: sale.invoiceNumber,
            userId: actorId,
          });

          // Surat Jalan ikut CANCELLED bila ada.
          if (sale.deliveryOrder) {
            await tx.deliveryOrder.update({
              where: { id: sale.deliveryOrder.id },
              data: {
                status: "CANCELLED",
                notes: `${sale.deliveryOrder.notes || ""}\n[DIBATALKAN KARENA TRANSAKSI DIBATALKAN: ${reason}]`.trim(),
              },
            });
          }
        },
        { maxWait: 5000, timeout: 20000 }
      );
    } catch (error) {
      if (error instanceof Error && error.message === ALREADY_CANCELLED)
        return botErr("Transaksi sudah dibatalkan, muat ulang dulu.", 400);
      throw error;
    }

    await auditSafe({
      level: auth.level,
      sender: auth.sender,
      method: "DELETE",
      endpoint: "/api/bot/sales/[id]",
      entityType: "Sale",
      entityId: id,
      before: beforeSummary,
      after: {
        invoiceNumber: sale.invoiceNumber,
        status: "CANCELLED",
        reason,
      },
      success: true,
    });

    return botOk({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      status: "CANCELLED",
      reason,
    });
  } catch (error) {
    console.error("[API_BOT_SALES_ID_DELETE_ERROR]", error);
    return botErr(sanitizeBotError(error), 500);
  }
}
