"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { startOfDay, endOfDay } from "date-fns";
import { SaleStatus, DebtStatus, PurchaseStatus } from "@prisma/client";
import { requirePermission } from "../utils/role";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Helper function to serialize Prisma data (convert Decimal to number)
function serializePrismaData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data, (key, value) =>
    typeof value === 'object' && value !== null && value.constructor.name === 'Decimal'
      ? Number(value)
      : value
  ));
}

// ==================== TYPES ====================
export type DateRangeFilter = {
  dateFrom?: Date;
  dateTo?: Date;
};

export type ReportFilters = DateRangeFilter & {
  customerId?: string;
  supplierId?: string;
  categoryId?: string;
  productId?: string;
  status?: string;
};

// ==================== LAPORAN PENJUALAN ====================
export async function getSalesReport(filters: ReportFilters) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "VIEW_REPORTS");
    const { dateFrom, dateTo, customerId, status } = filters;

    const sales = await prisma.sale.findMany({
      where: {
        AND: [
          dateFrom ? { saleDate: { gte: startOfDay(dateFrom) } } : {},
          dateTo ? { saleDate: { lte: endOfDay(dateTo) } } : {},
          customerId ? { customerId } : {},
          status ? { status: status as SaleStatus } : {},
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
      data: { sales: serializedSales, summary },
    };
  } catch (error) {
    console.error("Error getSalesReport:", error);
    return { success: false, error: "Gagal mengambil data laporan penjualan" };
  }
}

// ==================== LAPORAN INVENTORY/STOCK ====================
export async function getInventoryReport(filters: ReportFilters) {
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
        const categoryName = product.category.name;
        acc[categoryName] = (acc[categoryName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return {
      success: true,
      data: { products: serializedProducts, summary },
    };
  } catch (error) {
    console.error("Error getInventoryReport:", error);
    return { success: false, error: "Gagal mengambil data laporan inventory" };
  }
}

// ==================== LAPORAN KEUANGAN ====================
export async function getFinancialReport(filters: DateRangeFilter) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "VIEW_REPORTS");
    const { dateFrom, dateTo } = filters;

    const sales = await prisma.sale.findMany({
      where: {
        AND: [
          { status: "COMPLETED" },
          dateFrom ? { saleDate: { gte: startOfDay(dateFrom) } } : {},
          dateTo ? { saleDate: { lte: endOfDay(dateTo) } } : {},
        ],
      },
      include: {
        saleItems: {
          include: {
            product: {
              include: {
                productUnits: {
                  where: { isPrimary: true },
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
          dateFrom ? { purchaseDate: { gte: startOfDay(dateFrom) } } : {},
          dateTo ? { purchaseDate: { lte: endOfDay(dateTo) } } : {},
        ],
      },
    });

    const serializedSales = serializePrismaData(sales);
    const serializedPurchases = serializePrismaData(purchases);

    const totalRevenue = serializedSales.reduce((sum: number, sale: any) => sum + Number(sale.grandTotal), 0);
    const totalDiscount = serializedSales.reduce((sum: number, sale: any) => sum + Number(sale.discount), 0);

    const totalCOGS = serializedSales.reduce((sum: number, sale: any) => {
      const itemsCost = sale.saleItems.reduce((itemSum: number, item: any) => {
        const buyPrice = item.product.productUnits[0]?.buyPrice || 0;
        return itemSum + (item.quantity * Number(buyPrice));
      }, 0);
      return sum + itemsCost;
    }, 0);

    const totalPurchases = serializedPurchases.reduce((sum: number, purchase: any) => sum + Number(purchase.grandTotal), 0);

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
    };

    return {
      success: true,
      data: { sales: serializedSales, purchases: serializedPurchases, summary },
    };
  } catch (error) {
    console.error("Error getFinancialReport:", error);
    return { success: false, error: "Gagal mengambil data laporan keuangan" };
  }
}

// ==================== LAPORAN UTANG PIUTANG ====================
export async function getDebtsReport(filters: ReportFilters) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "VIEW_REPORTS");
    const { customerId, supplierId, status } = filters;

    const customerDebts = await prisma.customerDebt.findMany({
      where: {
        AND: [
          customerId ? { customerId } : {},
          status ? { status: status as DebtStatus } : {},
        ],
      },
      include: {
        customer: true,
        sale: true,
        debtPayments: {
          orderBy: { paymentDate: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const supplierDebts = await prisma.supplierDebt.findMany({
      where: {
        AND: [
          supplierId ? { supplierId } : {},
          status ? { status: status as DebtStatus } : {},
        ],
      },
      include: {
        supplier: true,
        purchase: true,
        debtPayments: {
          orderBy: { paymentDate: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const serializedCustomerDebts = serializePrismaData(customerDebts);
    const serializedSupplierDebts = serializePrismaData(supplierDebts);

    const customerDebtSummary = {
      totalDebt: serializedCustomerDebts.reduce((sum: number, debt: any) => sum + Number(debt.totalDebt), 0),
      totalPaid: serializedCustomerDebts.reduce((sum: number, debt: any) => sum + Number(debt.paidAmount), 0),
      totalRemaining: serializedCustomerDebts.reduce((sum: number, debt: any) => sum + Number(debt.remainingDebt), 0),
      count: serializedCustomerDebts.length,
    };

    const supplierDebtSummary = {
      totalDebt: serializedSupplierDebts.reduce((sum: number, debt: any) => sum + Number(debt.totalDebt), 0),
      totalPaid: serializedSupplierDebts.reduce((sum: number, debt: any) => sum + Number(debt.paidAmount), 0),
      totalRemaining: serializedSupplierDebts.reduce((sum: number, debt: any) => sum + Number(debt.remainingDebt), 0),
      count: serializedSupplierDebts.length,
    };

    return {
      success: true,
      data: {
        customerDebts: serializedCustomerDebts,
        supplierDebts: serializedSupplierDebts,
        customerDebtSummary,
        supplierDebtSummary,
      },
    };
  } catch (error) {
    console.error("Error getDebtsReport:", error);
    return { success: false, error: "Gagal mengambil data laporan utang" };
  }
}

// ==================== LAPORAN PEMBELIAN ====================
export async function getPurchasesReport(filters: ReportFilters) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "VIEW_REPORTS");
    const { dateFrom, dateTo, supplierId, status } = filters;

    const purchases = await prisma.purchase.findMany({
      where: {
        AND: [
          dateFrom ? { purchaseDate: { gte: startOfDay(dateFrom) } } : {},
          dateTo ? { purchaseDate: { lte: endOfDay(dateTo) } } : {},
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
        const supplierName = purchase.supplier.name;
        acc[supplierName] = (acc[supplierName] || 0) + Number(purchase.grandTotal);
        return acc;
      }, {} as Record<string, number>),
    };

    return {
      success: true,
      data: { purchases: serializedPurchases, summary },
    };
  } catch (error) {
    console.error("Error getPurchasesReport:", error);
    return { success: false, error: "Gagal mengambil data laporan pembelian" };
  }
}

// ==================== DAFTAR PRODUK ====================
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
      data: { products: serializedProducts },
    };
  } catch (error) {
    console.error("Error getProductListReport:", error);
    return { success: false, error: "Gagal mengambil data daftar produk" };
  }
}