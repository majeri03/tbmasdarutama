"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { SaleStatus, DebtStatus, PurchaseStatus } from "@prisma/client";
import { requirePermission, type AuthSession } from "../utils/role";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Zona waktu laporan: WITA (Asia/Makassar, UTC+8, tanpa DST) — item 142/147.
// Halaman laporan mengirim tanggal "yyyy-MM-dd" pilihan user (kalender
// WITA). startOfDay/endOfDay date-fns memakai zona lokal SERVER (Vercel =
// UTC), sehingga rentang "23-25 Nov" lama bergeser 8 jam dan transaksi
// sekitar tengah malam WITA masuk/keluar laporan yang salah. Helper di
// bawah menafsirkan tanggal pilihan sebagai hari kalender WITA:
// 00:00:00.000 WITA s.d. 23:59:59.999 WITA.
// ---------------------------------------------------------------------------
const WITA_TIME_ZONE = "Asia/Makassar";
const WITA_OFFSET_MS = 8 * 60 * 60 * 1000;

function witaDayParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: WITA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function startOfWitaDay(date: Date): Date {
  const { year, month, day } = witaDayParts(date);
  return new Date(Date.UTC(year, month - 1, day) - WITA_OFFSET_MS);
}

function endOfWitaDay(date: Date): Date {
  const { year, month, day } = witaDayParts(date);
  // Akhir hari WITA = awal hari WITA berikutnya dikurangi 1 ms
  // (23:59:59.999 WITA = 15:59:59.999 UTC).
  return new Date(Date.UTC(year, month - 1, day + 1) - WITA_OFFSET_MS - 1);
}

function startOfWitaMonth(date: Date): Date {
  const { year, month } = witaDayParts(date);
  return new Date(Date.UTC(year, month - 1, 1) - WITA_OFFSET_MS);
}

// Data toko untuk kop laporan (item 6): dibaca di sini, server-side, lalu
// diteruskan sebagai prop ke ReportHeader/ReportFooter. Dulu ReportHeader
// fetch client-side (getStoreSetting) dan sebelum fetch selesai kop sudah
// terlanjur tampil "Data toko belum diisi" — termasuk saat di-print/di-
// download PDF. Pengambilan di sini memakai izin VIEW_REPORTS yang sudah
// diperiksa tiap action laporan, bukan VIEW_SETTINGS.
async function getReportStoreInfo(): Promise<{
  name: string | null;
  address: string | null;
  phone: string | null;
}> {
  const setting = await prisma.storeSetting.findFirst({
    select: { name: true, address: true, phone: true },
  });
  return {
    name: setting?.name ?? null,
    address: setting?.address ?? null,
    phone: setting?.phone ?? null,
  };
}

// HPP per item penjualan (item 142).
// Aturan satuan (lihat src/lib/utils/stock-units.ts): stok & harga beli
// primer dinyatakan per SATUAN UTAMA; conversionValue = jumlah satuan itu
// per 1 satuan utama (mis. Kg = 50, Sak primer = 1). Jadi biaya per satuan
// jual = buyPrice primer / conversionValue satuan jual.
// Kode lama: quantity * buyPrice primer — untuk penjualan eceran (Kg) HPP
// membengkak conversionValue kali lipat (50x) sampai melebihi pendapatan
// (laporan 23-25 Nov: HPP Rp527.800 vs pendapatan Rp329.400).
// Pembagian boleh menghasilkan pecahan rupiah (biaya boleh pecahan walau
// stok harus bulat — beda dengan toPrimaryQuantity yang menolak pecahan).
function calcItemCogs(item: any): number {
  const quantity = Number(item.quantity) || 0;
  const units: any[] = item.product?.productUnits ?? [];
  const ownUnit = units.find((pu: any) => pu.unitId === item.unitId);
  const primaryUnit = units.find((pu: any) => pu.isPrimary);
  if (ownUnit && primaryUnit) {
    const conv = Number(ownUnit.conversionValue) || 1;
    return quantity * (Number(primaryUnit.buyPrice) / conv);
  }
  // Baris satuan tidak lengkap: pakai harga beli satuan itu sendiri,
  // terakhir harga primer (perilaku lama) supaya HPP tidak jadi nol diam-diam.
  if (ownUnit) return quantity * Number(ownUnit.buyPrice || 0);
  if (primaryUnit) return quantity * Number(primaryUnit.buyPrice || 0);
  return 0;
}

// Helper function to serialize Prisma data (convert Decimal to number)
function serializePrismaData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data, (key, value) =>
    typeof value === 'object' && value !== null && value.constructor.name === 'Decimal'
      ? Number(value)
      : value
  ));
}

export type DateRangeFilter = {
  dateFrom?: Date;
  dateTo?: Date;
  period?: 'daily' | 'weekly' | 'monthly';
};

export type ReportFilters = DateRangeFilter & {
  customerId?: string;
  supplierId?: string;
  categoryId?: string;
  productId?: string;
  status?: string;
  // PENTEST FIX (22 Nov 2026, M20): paging untuk laporan utang (dulu
  // tanpa take/skip — seluruh piutang+utang + riwayat bayar dimuat).
  page?: number;
  limit?: number;
};

export async function getSalesReport(filters: ReportFilters, externalSession?: AuthSession | null) {
  try {
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "VIEW_REPORTS");
    const { dateFrom, dateTo, customerId, status } = filters;

    const sales = await prisma.sale.findMany({
      where: {
        AND: [
          dateFrom ? { saleDate: { gte: startOfWitaDay(new Date(dateFrom)) } } : {},
          dateTo ? { saleDate: { lte: endOfWitaDay(new Date(dateTo)) } } : {},
          customerId ? { customerId } : {},
          // Aturan bersama laporan (item 142): hanya CANCELLED yang
          // dikeluarkan. Filter status eksplisit (mis. untuk melihat yang
          // dibatalkan) tetap dihormati.
          status ? { status: status as SaleStatus } : { status: { not: SaleStatus.CANCELLED } },
        ],
      },
      include: {
        customer: true,
        cashier: {
          select: { name: true },
        },
        saleItems: {
          include: {
            product: true,
            unit: true,
          },
        },
      },
      orderBy: { saleDate: "desc" },
    });

    const serializedSales = serializePrismaData(sales);

    const summary = {
      totalTransactions: serializedSales.length,
      totalRevenue: serializedSales.reduce((sum: number, sale: any) => sum + Number(sale.grandTotal), 0),
      totalDiscount: serializedSales.reduce((sum: number, sale: any) => sum + Number(sale.discount), 0),
      totalTax: serializedSales.reduce((sum: number, sale: any) => sum + Number(sale.tax), 0),
      paymentMethods: serializedSales.reduce((acc: Record<string, number>, sale: any) => {
        acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + Number(sale.grandTotal);
        return acc;
      }, {} as Record<string, number>),
    };

    return {
      success: true,
      data: { sales: serializedSales, summary, store: await getReportStoreInfo() },
    };
  } catch (error) {
    console.error("Error getSalesReport:", error);
    return { success: false, error: "Gagal mengambil data laporan penjualan" };
  }
}

export async function getInventoryReport(filters: ReportFilters, externalSession?: AuthSession | null) {
  try {
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "VIEW_REPORTS");
    const { categoryId, supplierId } = filters;

    const products = await prisma.product.findMany({
      where: {
        AND: [
          { deletedAt: null },
          categoryId ? { categoryId } : {},
          supplierId ? { supplierId } : {},
        ],
      },
      include: {
        category: true,
        subCategory: true,
        supplier: true,
        productUnits: {
          include: {
            unit: true,
          },
          where: { isPrimary: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const serializedProducts = serializePrismaData(products);

    const summary = {
      totalProducts: serializedProducts.length,
      totalStockValue: serializedProducts.reduce((sum: number, product: any) => {
        const primaryUnit = product.productUnits[0];
        if (primaryUnit) {
          return sum + (product.currentStock * Number(primaryUnit.buyPrice));
        }
        return sum;
      }, 0),
      lowStockProducts: serializedProducts.filter((p: any) => p.currentStock <= p.minStock).length,
      outOfStockProducts: serializedProducts.filter((p: any) => p.currentStock === 0).length,
      categoriesBreakdown: serializedProducts.reduce((acc: Record<string, number>, product: any) => {
        // Kategori wajib di schema, tapi jangan jatuhkan seluruh laporan
        // kalau ada produk yang referensinya hilang (item 141).
        const categoryName = product.category?.name ?? "Tanpa Kategori";
        acc[categoryName] = (acc[categoryName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return {
      success: true,
      data: { products: serializedProducts, summary, store: await getReportStoreInfo() },
    };
  } catch (error) {
    console.error("Error getInventoryReport:", error);
    return { success: false, error: "Gagal mengambil data laporan inventory" };
  }
}

export async function getFinancialReport(filters: DateRangeFilter, externalSession?: AuthSession | null) {
  try {
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "VIEW_REPORTS");

    let dateFrom = filters.dateFrom;
    let dateTo = filters.dateTo;
    const period = filters.period;

    if (period) {
      const now = new Date();
      dateTo = endOfWitaDay(now);

      if (period === 'daily') {
        dateFrom = startOfWitaDay(now);
      } else if (period === 'weekly') {
        const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        dateFrom = startOfWitaDay(sevenDaysAgo);
      } else if (period === 'monthly') {
        dateFrom = startOfWitaMonth(now);
      }
    }

    const sales = await prisma.sale.findMany({
      where: {
        AND: [
          // Aturan bersama laporan (item 142): hanya CANCELLED yang
          // dikeluarkan — sama seperti Laporan Penjualan. Dulu hanya
          // COMPLETED, sehingga laporan keuangan menghitung 7 transaksi
          // sementara laporan penjualan menghitung 10 (selisih Rp7.650).
          { status: { not: SaleStatus.CANCELLED } },
          dateFrom ? { saleDate: { gte: startOfWitaDay(new Date(dateFrom)) } } : {},
          dateTo ? { saleDate: { lte: endOfWitaDay(new Date(dateTo)) } } : {},
        ],
      },
      include: {
        saleItems: {
          include: {
            product: {
              include: {
                // SEMUA satuan, bukan hanya primer: HPP butuh
                // conversionValue satuan jual (lihat calcItemCogs).
                productUnits: {
                  select: {
                    unitId: true,
                    buyPrice: true,
                    conversionValue: true,
                    isPrimary: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const purchases = await prisma.purchase.findMany({
      where: {
        AND: [
          { status: "RECEIVED" },
          dateFrom ? { purchaseDate: { gte: startOfWitaDay(new Date(dateFrom)) } } : {},
          dateTo ? { purchaseDate: { lte: endOfWitaDay(new Date(dateTo)) } } : {},
        ],
      },
    });

    const customerDebts = await prisma.customerDebt.findMany({
      where: {
        AND: [
          dateFrom ? { createdAt: { gte: startOfWitaDay(new Date(dateFrom)) } } : {},
          dateTo ? { createdAt: { lte: endOfWitaDay(new Date(dateTo)) } } : {},
        ],
      },
    });

    const serializedSales = serializePrismaData(sales);
    const serializedPurchases = serializePrismaData(purchases);
    const serializedCustomerDebts = serializePrismaData(customerDebts);

    const totalRevenue = serializedSales.reduce((sum: number, sale: any) => sum + Number(sale.grandTotal), 0);
    const totalDiscount = serializedSales.reduce((sum: number, sale: any) => sum + Number(sale.discount), 0);

    // HPP dihitung dari harga beli primer PER SATUAN UTAMA dengan konversi
    // satuan jual (calcItemCogs) — bukan quantity * buyPrice primer.
    const totalCOGS = serializedSales.reduce((sum: number, sale: any) => {
      const itemsCost = sale.saleItems.reduce((itemSum: number, item: any) => {
        return itemSum + calcItemCogs(item);
      }, 0);
      return sum + itemsCost;
    }, 0);

    const totalPurchases = serializedPurchases.reduce((sum: number, purchase: any) => sum + Number(purchase.grandTotal), 0);
    const totalCustomerDebt = serializedCustomerDebts.reduce((sum: number, debt: any) => sum + Number(debt.remainingDebt), 0);

    const grossProfit = totalRevenue - totalCOGS;
    const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    const summary = {
      totalRevenue,
      totalDiscount,
      netRevenue: totalRevenue - totalDiscount,
      totalCOGS,
      grossProfit,
      grossProfitMargin,
      totalPurchases,
      netProfit: grossProfit,
      transactionCount: serializedSales.length,
      purchaseCount: serializedPurchases.length,
      totalCustomerDebt,
    };

    return {
      success: true,
      data: { sales: serializedSales, purchases: serializedPurchases, summary, store: await getReportStoreInfo() },
    };
  } catch (error) {
    console.error("Error getFinancialReport:", error);
    return { success: false, error: "Gagal mengambil data laporan keuangan" };
  }
}

export async function getDebtsReport(filters: ReportFilters, externalSession?: AuthSession | null) {
  try {
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "VIEW_REPORTS");
    const { customerId, supplierId, status } = filters;
    // PENTEST FIX (M20): paging di-clamp (1-100, default 100) supaya
    // laporan tidak bisa dipakai dump massal.
    const page = Number.isFinite(filters.page) ? Math.min(10000, Math.max(1, filters.page!)) : 1;
    const limit = Number.isFinite(filters.limit) ? Math.min(100, Math.max(1, filters.limit!)) : 100;
    const skip = (page - 1) * limit;

    const customerWhere = {
      AND: [
        customerId ? { customerId } : {},
        status ? { status: status as DebtStatus } : {},
      ],
    };
    const supplierWhere = {
      AND: [
        supplierId ? { supplierId } : {},
        status ? { status: status as DebtStatus } : {},
      ],
    };

    const [customerDebts, supplierDebts, customerCount, supplierCount, customerAgg, supplierAgg] =
      await Promise.all([
        prisma.customerDebt.findMany({
          where: customerWhere,
          include: {
            customer: true,
            sale: true,
            debtPayments: {
              orderBy: { paymentDate: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.supplierDebt.findMany({
          where: supplierWhere,
          include: {
            supplier: true,
            purchase: true,
            debtPayments: {
              orderBy: { paymentDate: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.customerDebt.count({ where: customerWhere }),
        prisma.supplierDebt.count({ where: supplierWhere }),
        // Ringkasan dihitung dari AGREGAT (bukan dari baris halaman ini)
        // supaya total tetap benar walau daftarnya dipaging.
        prisma.customerDebt.aggregate({
          where: customerWhere,
          _sum: { totalDebt: true, paidAmount: true, remainingDebt: true },
        }),
        prisma.supplierDebt.aggregate({
          where: supplierWhere,
          _sum: { totalDebt: true, paidAmount: true, remainingDebt: true },
        }),
      ]);

    const serializedCustomerDebts = serializePrismaData(customerDebts);
    const serializedSupplierDebts = serializePrismaData(supplierDebts);

    const customerDebtSummary = {
      totalDebt: Number(customerAgg._sum.totalDebt ?? 0),
      totalPaid: Number(customerAgg._sum.paidAmount ?? 0),
      totalRemaining: Number(customerAgg._sum.remainingDebt ?? 0),
      count: customerCount,
    };

    const supplierDebtSummary = {
      totalDebt: Number(supplierAgg._sum.totalDebt ?? 0),
      totalPaid: Number(supplierAgg._sum.paidAmount ?? 0),
      totalRemaining: Number(supplierAgg._sum.remainingDebt ?? 0),
      count: supplierCount,
    };

    return {
      success: true,
      data: {
        customerDebts: serializedCustomerDebts,
        supplierDebts: serializedSupplierDebts,
        customerDebtSummary,
        supplierDebtSummary,
        store: await getReportStoreInfo(),
        pagination: {
          page,
          limit,
          totalCustomerDebts: customerCount,
          totalSupplierDebts: supplierCount,
          totalPages: Math.ceil(Math.max(customerCount, supplierCount) / limit),
        },
      },
    };
  } catch (error) {
    console.error("Error getDebtsReport:", error);
    return { success: false, error: "Gagal mengambil data laporan utang" };
  }
}

export async function getPurchasesReport(filters: ReportFilters, externalSession?: AuthSession | null) {
  try {
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "VIEW_REPORTS");
    const { dateFrom, dateTo, supplierId, status } = filters;

    const purchases = await prisma.purchase.findMany({
      where: {
        AND: [
          dateFrom ? { purchaseDate: { gte: startOfWitaDay(new Date(dateFrom)) } } : {},
          dateTo ? { purchaseDate: { lte: endOfWitaDay(new Date(dateTo)) } } : {},
          supplierId ? { supplierId } : {},
          status ? { status: status as PurchaseStatus } : {},
        ],
      },
      include: {
        supplier: true,
        admin: {
          select: { name: true },
        },
        purchaseItems: {
          include: {
            product: true,
            unit: true,
          },
        },
      },
      orderBy: { purchaseDate: "desc" },
    });

    const serializedPurchases = serializePrismaData(purchases);

    const summary = {
      totalPurchases: serializedPurchases.length,
      totalAmount: serializedPurchases.reduce((sum: number, purchase: any) => sum + Number(purchase.grandTotal), 0),
      totalDiscount: serializedPurchases.reduce((sum: number, purchase: any) => sum + Number(purchase.discount), 0),
      totalPaid: serializedPurchases.reduce((sum: number, purchase: any) => sum + Number(purchase.paidAmount), 0),
      totalUnpaid: serializedPurchases.reduce((sum: number, purchase: any) => sum + (Number(purchase.grandTotal) - Number(purchase.paidAmount)), 0),
      supplierBreakdown: serializedPurchases.reduce((acc: Record<string, number>, purchase: any) => {
        const supplierName = purchase.supplier?.name ?? "Tanpa Supplier";
        acc[supplierName] = (acc[supplierName] || 0) + Number(purchase.grandTotal);
        return acc;
      }, {} as Record<string, number>),
    };

    return {
      success: true,
      data: { purchases: serializedPurchases, summary, store: await getReportStoreInfo() },
    };
  } catch (error) {
    console.error("Error getPurchasesReport:", error);
    return { success: false, error: "Gagal mengambil data laporan pembelian" };
  }
}

export async function getProductListReport(filters: ReportFilters) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "VIEW_REPORTS");
    const { categoryId, supplierId } = filters;

    const products = await prisma.product.findMany({
      where: {
        AND: [
          { deletedAt: null },
          { isActive: true },
          categoryId ? { categoryId } : {},
          supplierId ? { supplierId } : {},
        ],
      },
      include: {
        category: true,
        subCategory: true,
        supplier: true,
        productUnits: {
          include: {
            unit: true,
          },
        },
        productImages: {
          where: { isPrimary: true },
          take: 1,
        },
      },
      orderBy: { code: "asc" },
    });

    const serializedProducts = serializePrismaData(products);

    return {
      success: true,
      data: { products: serializedProducts, store: await getReportStoreInfo() },
    };
  } catch (error) {
    console.error("Error getProductListReport:", error);
    return { success: false, error: "Gagal mengambil data daftar produk" };
  }
}