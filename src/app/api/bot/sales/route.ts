import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma, PaymentMethod, SaleStatus } from "@prisma/client";
import {
  requireBotRead,
  requireBotWrite,
  botOk,
  botErr,
  sanitizeBotError,
  parseBotPagination,
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
  recordCashIn,
  withUniqueRetry,
} from "@/lib/utils/stock-units";

// WS-D1 (28 Nov 2026) — penjualan untuk API bot Madama Agent.
// Meniru logika web PERSIS (bukan karangan baru):
// - createSale di src/lib/actions/sale.actions.ts (harga master, konversi
//   satuan utama, utang CREDIT, poin, nomor INV-YYYYMMDD-XXXX WITA, kas).
// - getSales di file yang sama (pencarian nomor invoice dua format,
//   filter status/paymentMethod/customer/tanggal).
// Harga TIDAK PERNAH dipercaya dari body: prepareCheckoutItems selalu
// memakai sellPrice master (perbaikan QA M-1/M-8 di web). Body yang
// mengirim total/harga sendiri diabaikan — total dihitung ulang server.
// buyPrice TIDAK PERNAH dikembalikan di respons mana pun.
// "DP" bukan nilai enum PaymentMethod di skema web — di sini diterima
// sebagai alias CREDIT (uang muka = CREDIT dengan paidAmount > 0).

// Pesan auth gagal — sama dengan yang dipakai WS-B/WS-C (GET/POST):
// 401 "Kunci bot tidak valid.", 429 "Terlalu banyak permintaan...".
// 403 di POST hanya bisa dari Level 3 (Level 1 & 2 boleh tulis).
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

// Audit log tidak boleh menggagalkan request yang sudah berhasil ditulis:
// kalau pencatatan audit gagal, catat di log server dan tetap kembalikan sukses.
async function auditSafe(
  entry: Parameters<typeof writeBotAudit>[0]
): Promise<void> {
  try {
    await writeBotAudit(entry);
  } catch (error) {
    console.error("[API_BOT_AUDIT_ERROR]", error);
  }
}

// Angka dari body JSON: terima number, atau string numerik ("10000").
function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Nomor invoice & tanggal — salinan pola sale.actions.ts (bukan format baru).
// Format: INV-YYYYMMDD-XXXX, prefiks tanggal WITA (Asia/Makassar, UTC+8).
// Format POS (INV/YYYYMMDD-XXXX) adalah urutan terpisah di web dan TIDAK
// dipakai di sini — bot mengikuti format penjualan manual (createSale).
// ---------------------------------------------------------------------------
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

async function generateInvoiceNumber(
  tx: Prisma.TransactionClient
): Promise<string> {
  const prefix = `INV-${getWitaDatePrefix()}`;
  const lastSale = await tx.sale.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const nextNum = lastSale
    ? parseInt(lastSale.invoiceNumber.split("-").pop() || "0", 10) + 1
    : 1;
  return `${prefix}-${String(nextNum).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Validasi body penjualan (cermin createSaleSchema di
// src/lib/validations/sale.schema.ts — tanpa total/harga dari klien).
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
  // "DP" bukan enum di skema web — alias ke CREDIT (uang muka).
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
// Serializer — eksplisit per field (Decimal -> number via toNum) supaya
// TIDAK ADA buyPrice / fee salesman / field internal lain yang bocor.
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

// ---------------------------------------------------------------------------
// Pencarian list — cermin buildSaleSearchWhere di sale.actions.ts:
// cocokkan nomor invoice (kedua format INV/... dan INV-...), nama/kode customer.
// ---------------------------------------------------------------------------
function buildSearchWhere(search: string): Prisma.SaleWhereInput {
  const term = search.trim();
  if (!term) return {};
  const variants = Array.from(
    new Set([
      term,
      term.split("/").join("-"),
      term.split("-").join("/"),
    ])
  );
  return {
    OR: [
      ...variants.map((v) => ({
        invoiceNumber: { contains: v, mode: "insensitive" as const },
      })),
      { customer: { name: { contains: term, mode: "insensitive" as const } } },
      { customer: { code: { contains: term, mode: "insensitive" as const } } },
    ],
  };
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

/**
 * GET /api/bot/sales — semua level boleh baca.
 * List penjualan: search (nomor invoice / nama / kode customer),
 * filter status / paymentMethod / customerId / tanggal (dateFrom, dateTo),
 * page/limit default 20 maks 50.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireBotRead(request);
    if (!auth.ok) return botAuthFail(auth.status);

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parseBotPagination(searchParams);
    const search = searchParams.get("search")?.trim() || "";

    const statusRaw = searchParams.get("status")?.trim().toUpperCase() || "";
    if (
      statusRaw &&
      !["PENDING", "COMPLETED", "CANCELLED", "RETURN"].includes(statusRaw)
    )
      return botErr(
        "Status tidak valid. Pilih PENDING, COMPLETED, CANCELLED, atau RETURN.",
        400
      );

    const paymentRaw =
      searchParams.get("paymentMethod")?.trim().toUpperCase() || "";
    if (
      paymentRaw &&
      !(PAYMENT_METHODS as readonly string[]).includes(paymentRaw)
    )
      return botErr(
        "Metode pembayaran tidak valid. Pilih CASH, TRANSFER, QRIS, DEBIT_CARD, atau CREDIT.",
        400
      );

    const customerId = searchParams.get("customerId")?.trim() || "";

    let dateFrom: Date | null = null;
    let dateTo: Date | null = null;
    const dateFromRaw = searchParams.get("dateFrom")?.trim() || "";
    const dateToRaw = searchParams.get("dateTo")?.trim() || "";
    if (dateFromRaw) {
      const d = new Date(dateFromRaw);
      if (Number.isNaN(d.getTime()))
        return botErr("Format dateFrom tidak valid (pakai YYYY-MM-DD).", 400);
      dateFrom = d;
    }
    if (dateToRaw) {
      const d = new Date(dateToRaw);
      if (Number.isNaN(d.getTime()))
        return botErr("Format dateTo tidak valid (pakai YYYY-MM-DD).", 400);
      dateTo = d;
    }

    const where: Prisma.SaleWhereInput = {
      ...(search ? buildSearchWhere(search) : {}),
      ...(statusRaw ? { status: statusRaw as SaleStatus } : {}),
      ...(paymentRaw ? { paymentMethod: paymentRaw as PaymentMethod } : {}),
      ...(customerId ? { customerId } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: startOfDay(dateFrom) } : {}),
              ...(dateTo ? { lte: endOfDay(dateTo) } : {}),
            },
          }
        : {}),
    };

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
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
      }),
      prisma.sale.count({ where }),
    ]);

    return botOk(
      sales.map((s) => serializeSaleDetail(s)),
      { page, limit, total, totalPages: Math.ceil(total / limit) }
    );
  } catch (error) {
    console.error("[API_BOT_SALES_GET_ERROR]", error);
    return sanitizeBotError(error);
  }
}

/**
 * POST /api/bot/sales — Level 1 & 2 (Level 3 -> 403 sopan).
 * Buat penjualan lengkap. Meniru createSale (sale.actions.ts) + POS:
 * - total dihitung server dari sellPrice master; harga/total dari body diabaikan
 * - qty dikonversi ke satuan utama (dibagi conversionValue, harus bulat)
 * - stok dikurangi atomik + StockMovement OUT per item (semua-atau-tidak-sama-sekali)
 * - CREDIT (termasuk DP) dengan sisa > 0 -> CustomerDebt, jatuh tempo +30 hari
 * - CREDIT untuk customer UMUM ditolak; UMUM tidak dapat poin
 * - poin hanya bila lunas non-CREDIT, bukan UMUM, grandTotal > 0
 *   (rate dari StoreSetting, default aktif Rp 10.000/poin)
 * - nomor invoice server-generated INV-YYYYMMDD-XXXX (WITA)
 * - kas masuk dicatat (CREDIT: sebesar paidAmount; lainnya: grandTotal)
 * - salesmanId opsional, harus ada + aktif bila diisi
 * - customerId boleh kosong -> dipakai customer UMUM (satu-satunya)
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

    // --- Validasi bentuk body ---
    const itemsParsed = parseSaleItems(body.items);
    if (!itemsParsed.ok) return botErr(itemsParsed.error, 400);
    const items = itemsParsed.items;

    const methodParsed = parsePaymentMethod(body.paymentMethod);
    if (!methodParsed.ok) return botErr(methodParsed.error, 400);
    const paymentMethod = methodParsed.method;

    const discount =
      body.discount === undefined ? 0 : asNumber(body.discount);
    if (discount === null || discount < 0 || discount > 1_000_000_000)
      return botErr("Diskon tidak boleh negatif.", 400);

    const tax = body.tax === undefined ? 0 : asNumber(body.tax);
    if (tax === null || tax < 0 || tax > 100_000_000)
      return botErr("Pajak tidak boleh negatif.", 400);

    const notes =
      typeof body.notes === "string" && body.notes.trim() !== ""
        ? body.notes.trim()
        : null;
    if (notes && notes.length > 500)
      return botErr("Catatan maksimal 500 karakter.", 400);

    const salesmanId =
      typeof body.salesmanId === "string" && body.salesmanId.trim() !== ""
        ? body.salesmanId.trim()
        : null;

    const customerIdRaw =
      typeof body.customerId === "string" && body.customerId.trim() !== ""
        ? body.customerId.trim()
        : null;

    // --- Validasi relasi: customer (atau Umum) + salesman ---
    let customer: { id: string; type: string; name: string };
    if (customerIdRaw) {
      const found = await prisma.customer.findUnique({
        where: { id: customerIdRaw },
        select: { id: true, type: true, name: true },
      });
      if (!found) return botErr("Customer tidak ditemukan.", 400);
      customer = found;
    } else {
      // Tanpa customerId -> customer UMUM (satu-satunya, pola POS).
      // Kalau belum ada, jangan buat diam-diam — minta customerId.
      const umum = await prisma.customer.findFirst({
        where: { type: "UMUM" },
        orderBy: { createdAt: "asc" },
        select: { id: true, type: true, name: true },
      });
      if (!umum)
        return botErr(
          "Customer Umum belum ada. Kirim customerId pelanggan terdaftar.",
          400
        );
      customer = umum;
    }

    if (salesmanId) {
      const salesman = await prisma.salesman.findUnique({
        where: { id: salesmanId },
        select: { id: true, isActive: true },
      });
      if (!salesman) return botErr("Salesman tidak ditemukan.", 400);
      if (!salesman.isActive)
        return botErr("Salesman sudah nonaktif, pilih salesman lain.", 400);
    }

    // --- Hitung ulang dari harga master (harga/total body diabaikan) ---
    const productIds = items.map((i) => i.productId);
    const checkoutProducts = await loadCheckoutProducts(productIds);
    const unitNames = await loadUnitNames();
    let prepared;
    try {
      prepared = prepareCheckoutItems(items, checkoutProducts, unitNames);
    } catch (e) {
      return botErr(
        e instanceof Error ? e.message : "Item tidak valid.",
        400
      );
    }
    const totals = computeGrandTotal(prepared.totalAmount, discount, tax);
    if (tax > prepared.totalAmount * 0.25)
      return botErr("Pajak maksimal 25% dari total.", 400);

    // paidAmount: kosong -> lunas penuh (non-CREDIT) atau 0 (CREDIT).
    let paidAmount: number;
    if (body.paidAmount === undefined || body.paidAmount === null) {
      paidAmount = paymentMethod === "CREDIT" ? 0 : totals.grandTotal;
    } else {
      const n = asNumber(body.paidAmount);
      if (n === null || n < 0 || n > 1_000_000_000)
        return botErr("Jumlah bayar tidak valid.", 400);
      paidAmount = n;
    }

    let changeAmount: number;
    try {
      ({ changeAmount } = validatePaymentAndChange({
        paymentMethod,
        customerType: customer.type,
        grandTotal: totals.grandTotal,
        paidAmount,
      }));
    } catch (e) {
      return botErr(
        e instanceof Error ? e.message : "Pembayaran tidak valid.",
        400
      );
    }

    // Cek cepat stok (angka final tetap dicek atomik di dalam transaksi).
    for (const [productId, qtyPrimary] of prepared.qtyPrimaryByProduct.entries()) {
      const product = checkoutProducts.find((p) => p.id === productId);
      if (!product || product.currentStock < qtyPrimary) {
        return botErr(
          `Stok ${product?.name || "Produk"} tidak cukup. Tersedia: ${product?.currentStock ?? 0} (satuan utama), dibutuhkan: ${qtyPrimary}.`,
          400
        );
      }
    }

    const actorId = await getBotActorUserId();
    if (!actorId) return botErr("Terjadi kesalahan internal server.", 500);

    // --- Tulis dalam satu transaksi (diulang kalau nomor tabrakan) ---
    let createdId: string;
    let pointsEarned = 0;
    let debtCreated = false;
    try {
      const result = await withUniqueRetry(() =>
        prisma.$transaction(
          async (tx) => {
            // Reset penanda tiap percobaan: withUniqueRetry bisa mengulang
            // transaksi yang di-rollback — nilai dari percobaan gagal
            // tidak boleh terbawa ke percobaan berikutnya.
            pointsEarned = 0;
            debtCreated = false;

            const invoiceNumber = await generateInvoiceNumber(tx);

            const newSale = await tx.sale.create({
              data: {
                invoiceNumber,
                customerId: customer.id,
                cashierId: actorId,
                salesmanId: salesmanId || null,
                totalAmount: prepared.totalAmount,
                discount: totals.discount,
                tax: totals.tax,
                grandTotal: totals.grandTotal,
                paymentMethod: paymentMethod as PaymentMethod,
                paidAmount,
                changeAmount,
                status:
                  paymentMethod === "CREDIT" &&
                  paidAmount < totals.grandTotal
                    ? SaleStatus.PENDING
                    : SaleStatus.COMPLETED,
                notes: notes || "POS Transaction",
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

            // Kurangi stok atomik + catat log per baris item.
            for (const [productId, qtyPrimary] of prepared.qtyPrimaryByProduct.entries()) {
              const product = checkoutProducts.find((p) => p.id === productId);
              await decrementStockOrThrow(
                tx,
                productId,
                qtyPrimary,
                product?.name || "Produk"
              );
            }
            for (const item of prepared.lines) {
              await tx.stockMovement.create({
                data: {
                  productId: item.productId,
                  type: "OUT",
                  quantity: item.qtyPrimary,
                  referenceType: "Sale",
                  referenceId: newSale.id,
                  createdById: actorId,
                  notes: `Penjualan ${invoiceNumber} (via bot)`,
                },
              });
            }

            // Catat kas masuk (CREDIT: sebesar yang dibayar; lainnya: grandTotal).
            // Deskripsi HARUS persis "Penjualan <nomor>" supaya reverseCashIn
            // saat pembatalan menemukannya (pola web).
            await recordCashIn(tx, {
              amount:
                paymentMethod === "CREDIT" ? paidAmount : totals.grandTotal,
              description: `Penjualan ${invoiceNumber}`,
              userId: actorId,
            });

            // Utang (CREDIT) — hanya kalau masih ada sisa (m-9).
            if (paymentMethod === "CREDIT") {
              const remainingDebt = totals.grandTotal - paidAmount;
              if (remainingDebt > 0) {
                const debtStatus = paidAmount > 0 ? "PARTIAL" : "UNPAID";
                await tx.customerDebt.create({
                  data: {
                    debtNumber: await generateDebtNumber(tx),
                    saleId: newSale.id,
                    customerId: customer.id,
                    totalDebt: totals.grandTotal,
                    paidAmount,
                    remainingDebt,
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    status: debtStatus,
                    notes: `Utang dari penjualan ${invoiceNumber}`,
                  },
                });
                debtCreated = true;
              }
            }

            // Poin loyalitas — HANYA bila lunas non-CREDIT, bukan UMUM,
            // grandTotal > 0 (persis createSale; Umum & CREDIT tidak dapat poin).
            if (
              paymentMethod !== "CREDIT" &&
              customer.type !== "UMUM" &&
              totals.grandTotal > 0
            ) {
              const setting = await tx.storeSetting.findFirst({
                select: { pointsEnabled: true, pointsRupiahPerPoint: true },
              });
              const pointsEnabled = setting?.pointsEnabled ?? true;
              const rate = setting?.pointsRupiahPerPoint ?? 10000;
              if (pointsEnabled && rate > 0) {
                const earned = Math.floor(totals.grandTotal / rate);
                if (earned > 0) {
                  await tx.customer.update({
                    where: { id: customer.id },
                    data: { points: { increment: earned } },
                  });
                  pointsEarned = earned;
                }
              }
            }

            return newSale.id;
          },
          { maxWait: 5000, timeout: 20000 }
        )
      );
      createdId = result;
    } catch (error) {
      // decrementStockOrThrow melempar pesan "Stok ... tidak cukup ..." yang
      // aman diteruskan; error lain (Prisma/SQL) tetap generik.
      if (error instanceof Error && error.message.startsWith("Stok "))
        return botErr(error.message, 400);
      throw error;
    }

    const full = await fetchSaleDetail(createdId);
    if (!full) return botErr("Terjadi kesalahan internal server.", 500);

    await auditSafe({
      level: auth.level,
      sender: auth.sender,
      method: "POST",
      endpoint: "/api/bot/sales",
      entityType: "Sale",
      entityId: createdId,
      before: null,
      after: {
        invoiceNumber: full.invoiceNumber,
        customerId: customer.id,
        customerName: customer.name,
        grandTotal: totals.grandTotal,
        paymentMethod,
        paidAmount,
        itemCount: items.length,
        pointsEarned,
        debtCreated,
      },
      success: true,
    });

    return botOk({ ...serializeSaleDetail(full), pointsEarned });
  } catch (error) {
    console.error("[API_BOT_SALES_POST_ERROR]", error);
    return sanitizeBotError(error);
  }
}
