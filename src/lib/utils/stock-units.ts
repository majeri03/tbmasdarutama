import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * Aturan satuan & checkout — FIX QA Nov 2026 (B-1, B-2, B-3, B-5, M-1, M-7, M-8).
 *
 * ATURAN SATUAN (penting, ini yang sempat membingungkan):
 * - Stok produk (currentStock) disimpan dalam SATUAN UTAMA (primary).
 *   Contoh: Semen Tonasa dihitung SAK, bukan Kg. Stok 15 = 15 Sak.
 * - conversionValue = jumlah satuan itu per 1 satuan utama.
 *   Contoh: Kg conversionValue-nya 50 (50 Kg = 1 Sak), Sak = 1, Dus = 10 (10 Pcs = 1 Dus).
 *   Ini sesuai data seed & validasi product.schema (primary harus conversionValue = 1).
 * - Maka jumlah dalam satuan utama = quantity / conversionValue (DIBAGI, bukan dikali).
 *   Kode lama di beberapa tempat memakai quantity * conversionValue — itu kebalik
 *   dan bisa membuat stok bertambah 5.000 dari terima 100 Kg.
 * - currentStock & StockMovement.quantity bertipe Int, jadi hasil konversi HARUS
 *   bilangan bulat. Kalau tidak bulat (mis. jual 10 Kg = 0,2 Sak), transaksi
 *   DITOLAK dengan pesan jelas — lebih baik ditolak daripada stok rusak diam-diam.
 *   Kalau mau jual eceran pecahan (10 Kg), butuh migrasi currentStock ke Decimal.
 */

export type CheckoutUnit = {
  id: string;
  unitId: string;
  conversionValue: number;
  sellPrice: number;
  isPrimary: boolean;
};

export type CheckoutProduct = {
  id: string;
  name: string;
  code: string;
  currentStock: number;
  productUnits: CheckoutUnit[];
};

/** Jumlah dalam satuan utama, atau null kalau hasilnya pecahan. */
export function toPrimaryQuantity(quantity: number, conversionValue: number): number | null {
  const conv = Number(conversionValue) || 1;
  if (quantity % conv !== 0) return null;
  return quantity / conv;
}

export function primaryQuantityOrThrow(args: {
  quantity: number;
  conversionValue: number;
  productName: string;
  unitName: string;
}): number {
  const result = toPrimaryQuantity(args.quantity, args.conversionValue);
  if (result === null) {
    const conv = Number(args.conversionValue) || 1;
    throw new Error(
      `Jumlah ${args.quantity} ${args.unitName} untuk ${args.productName} = ${
        args.quantity / conv
      } satuan utama — stok dihitung per satuan utama dan tidak bisa pecahan. Jual dalam kelipatan ${conv} ${args.unitName} (= 1 satuan utama).`
    );
  }
  return result;
}

/** Muat produk + satuannya untuk checkout (dipakai POS & penjualan manual). */
export async function loadCheckoutProducts(productIds: string[]): Promise<CheckoutProduct[]> {
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      currentStock: true,
      name: true,
      code: true,
      productUnits: {
        select: {
          id: true,
          unitId: true,
          conversionValue: true,
          sellPrice: true,
          isPrimary: true,
        },
      },
    },
  });
  return products.map((p) => ({
    ...p,
    currentStock: Number(p.currentStock),
    productUnits: p.productUnits.map((pu) => ({
      ...pu,
      conversionValue: Number(pu.conversionValue),
      sellPrice: Number(pu.sellPrice),
    })),
  }));
}

export async function loadUnitNames(): Promise<Map<string, string>> {
  const units = await prisma.unit.findMany({ select: { id: true, name: true } });
  return new Map(units.map((u) => [u.id, u.name]));
}

export type PreparedCheckoutItem = {
  productId: string;
  unitId: string;
  productUnitId: string;
  quantity: number;
  qtyPrimary: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
};

/**
 * Validasi & hitung ulang item checkout dari harga master (M-1, M-8, M-30):
 * - productUnitId harus milik produk itu sendiri (tidak bisa pakai satuan produk lain)
 * - harga diambil dari master (sellPrice), BUKAN dari HP/klien
 * - diskon per item dibatasi maksimal = harga kotor item (tidak boleh negatif)
 * - jumlah dikonversi ke satuan utama (dibagi, harus bulat)
 */
export function prepareCheckoutItems(
  items: Array<{ productId: string; productUnitId: string; quantity: number; discount?: number }>,
  products: CheckoutProduct[],
  unitNames: Map<string, string>
): { lines: PreparedCheckoutItem[]; qtyPrimaryByProduct: Map<string, number>; totalAmount: number } {
  const productMap = new Map(products.map((p) => [p.id, p]));
  const lines: PreparedCheckoutItem[] = [];
  const qtyPrimaryByProduct = new Map<string, number>();
  let totalAmount = 0;

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) throw new Error(`Produk tidak ditemukan: ${item.productId}`);
    const pu = product.productUnits.find((u) => u.id === item.productUnitId);
    if (!pu) {
      throw new Error(`Satuan tidak valid untuk produk ${product.name}. Pilih satuan dari daftar produk tersebut.`);
    }
    const unitName = unitNames.get(pu.unitId) || "satuan";
    const qtyPrimary = primaryQuantityOrThrow({
      quantity: item.quantity,
      conversionValue: pu.conversionValue,
      productName: product.name,
      unitName,
    });
    const unitPrice = Number(pu.sellPrice ?? 0);
    const gross = unitPrice * item.quantity;
    const discount = Math.min(Math.max(item.discount ?? 0, 0), gross);
    const subtotal = gross - discount;
    lines.push({
      productId: item.productId,
      unitId: pu.unitId,
      productUnitId: item.productUnitId,
      quantity: item.quantity,
      qtyPrimary,
      unitPrice,
      discount,
      subtotal,
    });
    qtyPrimaryByProduct.set(item.productId, (qtyPrimaryByProduct.get(item.productId) ?? 0) + qtyPrimary);
    totalAmount += subtotal;
  }

  return { lines, qtyPrimaryByProduct, totalAmount };
}

/** Hitung grand total dari total item (diskon total & pajak dibatasi supaya tidak negatif). */
export function computeGrandTotal(totalAmount: number, discount: number, tax: number): { discount: number; tax: number; grandTotal: number } {
  const safeDiscount = Math.min(Math.max(discount, 0), totalAmount);
  const safeTax = Math.max(tax, 0);
  return { discount: safeDiscount, tax: safeTax, grandTotal: totalAmount - safeDiscount + safeTax };
}

/**
 * Validasi pembayaran (B-3): dipakai POS & penjualan manual.
 * - CREDIT untuk pelanggan UMUM ditolak (hutang tanpa identitas tidak tertagih)
 * - Non-CREDIT (tunai/transfer/QRIS/kartu) harus lunas (paid >= grandTotal)
 * - CREDIT tidak boleh bayar lebih (paid > grandTotal = sisa hutang negatif)
 */
export function validatePaymentAndChange(args: {
  paymentMethod: string;
  customerType?: string | null;
  grandTotal: number;
  paidAmount: number;
}): { changeAmount: number } {
  if (args.paymentMethod === "CREDIT" && args.customerType === "UMUM") {
    throw new Error("Pembayaran CREDIT tidak tersedia untuk Pelanggan Umum. Pilih pelanggan terdaftar atau bayar tunai.");
  }
  if (args.paymentMethod !== "CREDIT" && args.paidAmount < args.grandTotal) {
    throw new Error("Jumlah bayar kurang dari total. Untuk tunai/transfer/QRIS/kartu, pembayaran harus lunas.");
  }
  if (args.paymentMethod === "CREDIT" && args.paidAmount > args.grandTotal) {
    throw new Error("Jumlah bayar melebihi total. Kelebihan bayar tidak bisa dicatat sebagai hutang negatif.");
  }
  return { changeAmount: args.paymentMethod === "CREDIT" ? 0 : args.paidAmount - args.grandTotal };
}

/**
 * Kurangi stok secara atomik: hanya berhasil kalau stok saat ini masih cukup
 * (B-2 — dua checkout bersamaan tidak bisa sama-sama lolos dan membuat stok negatif).
 * Kembalikan false kalau stok tidak cukup (kemungkinan berubah di tengah jalan).
 */
export async function atomicDecrementStock(
  tx: Prisma.TransactionClient,
  productId: string,
  qtyPrimary: number
): Promise<boolean> {
  const res = await tx.product.updateMany({
    where: { id: productId, currentStock: { gte: qtyPrimary } },
    data: { currentStock: { decrement: qtyPrimary } },
  });
  return res.count === 1;
}

export async function decrementStockOrThrow(
  tx: Prisma.TransactionClient,
  productId: string,
  qtyPrimary: number,
  productName: string
): Promise<void> {
  const ok = await atomicDecrementStock(tx, productId, qtyPrimary);
  if (!ok) {
    throw new Error(`Stok ${productName} tidak cukup atau berubah saat transaksi diproses. Coba lagi.`);
  }
}

/** Nomor hutang pelanggan (dipakai POS & penjualan manual; retry di luar menangani tabrakan). */
export async function generateDebtNumber(tx: Prisma.TransactionClient): Promise<string> {
  const lastDebt = await tx.customerDebt.findFirst({
    where: { debtNumber: { startsWith: "DEBT-CUST-" } },
    orderBy: { debtNumber: "desc" },
    select: { debtNumber: true },
  });
  if (!lastDebt) return "DEBT-CUST-001";
  const lastNumber = parseInt(lastDebt.debtNumber.split("-")[2]);
  const next = (Number.isFinite(lastNumber) ? lastNumber : 0) + 1;
  return `DEBT-CUST-${String(next).padStart(3, "0")}`;
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Ulangi satu operasi kalau gagal karena nomor unik tabrakan (M-2 — dua transaksi
 * bersamaan bisa menghasilkan nomor invoice/hutang yang sama). Transaksi yang gagal
 * di-rollback penuh oleh Prisma, jadi aman diulang.
 */
export async function withUniqueRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isUniqueViolation(e) || attempt === maxAttempts - 1) throw e;
      lastError = e;
    }
  }
  throw lastError;
}

/** Catat kas masuk dari penjualan (M-7 — dulu checkout tidak pernah mencatat kas). */
export async function recordCashIn(
  tx: Prisma.TransactionClient,
  args: { amount: number; description: string; userId: string }
): Promise<void> {
  if (args.amount <= 0) return;
  await tx.cashMovement.create({
    data: {
      type: "IN",
      amount: args.amount,
      description: args.description,
      category: "Penjualan",
      userId: args.userId,
    },
  });
}

/** Balikkan kas masuk saat penjualan dibatalkan/dihapus (pasangan recordCashIn). */
export async function reverseCashIn(
  tx: Prisma.TransactionClient,
  args: { invoiceNumber: string; userId: string }
): Promise<void> {
  const original = await tx.cashMovement.findFirst({
    where: { description: `Penjualan ${args.invoiceNumber}`, type: "IN" },
  });
  if (!original) return;
  const already = await tx.cashMovement.findFirst({
    where: { description: `Pembatalan ${args.invoiceNumber}`, type: "OUT" },
  });
  if (already) return;
  await tx.cashMovement.create({
    data: {
      type: "OUT",
      amount: original.amount,
      description: `Pembatalan ${args.invoiceNumber}`,
      category: "Penjualan",
      userId: args.userId,
    },
  });
}
