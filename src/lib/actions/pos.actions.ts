"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateSearchQuery } from "@/lib/utils/pos-helpers";
import { PaymentMethod, Prisma, SaleStatus } from "@prisma/client";
import { requirePermission } from "../utils/role";
import { CreateSaleInput, createSaleSchema } from "../validations/sale.schema";
import { revalidatePath } from "next/cache";
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

// Get products for POS
export async function getPOSProducts(search?: string, categoryId?: string) {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }
    requirePermission(session, "ACCESS_POS");

    //Proper typing
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      currentStock: { gt: 0 },
    };

    // Search by barcode, code, or name
    if (search && search.trim()) {
      const searchQuery = generateSearchQuery(search);

      where.OR = [];
      if (searchQuery.barcode) {
        where.OR.push({
          barcode: { equals: searchQuery.barcode, mode: "insensitive" },
        });
      }
      if (searchQuery.code) {
        where.OR.push({
          code: { contains: searchQuery.code, mode: "insensitive" },
        });
      }
      if (searchQuery.name) {
        where.OR.push({
          name: { contains: searchQuery.name, mode: "insensitive" },
        });
      }
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const products = await prisma.product.findMany({
      where,
      take: 20,
      orderBy: { name: "asc" },
      include: {
        productUnits: {
          include: {
            unit: true,
          },
          orderBy: {
            isPrimary: "desc",
          },
        },
        productImages: {
          where: { isPrimary: true },
          take: 1,
        },
        category: {
          select: {
            name: true,
          },
        },
      },
    });

    //Convert Decimal to number before sending to client
    const serializedProducts = products.map((product) => ({
      ...product,
      productUnits: product.productUnits.map((pu) => ({
        ...pu,
        buyPrice: parseFloat(pu.buyPrice.toString()),
        sellPrice: parseFloat(pu.sellPrice.toString()),
      })),
    }));

    return {
      success: true,
      data: serializedProducts,
    };
  } catch (error) {
    console.error("Get POS products error:", error);
    return {
      success: false,
      error: "Gagal mengambil data produk",
    };
  }
}

// Get product by barcode (for scanner)
export async function getProductByBarcode(barcode: string) {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }
    requirePermission(session, "ACCESS_POS");
    const product = await prisma.product.findFirst({
      where: {
        barcode: { equals: barcode, mode: "insensitive" },
        isActive: true,
        currentStock: { gt: 0 },
      },
      include: {
        productUnits: {
          include: {
            unit: true,
          },
          orderBy: {
            isPrimary: "desc",
          },
        },
        productImages: {
          where: { isPrimary: true },
          take: 1,
        },
      },
    });

    if (!product) {
      return {
        success: false,
        error: "Produk tidak ditemukan atau stock habis",
      };
    }

    //Convert Decimal to number
    const serializedProduct = {
      ...product,
      productUnits: product.productUnits.map((pu) => ({
        ...pu,
        buyPrice: parseFloat(pu.buyPrice.toString()),
        sellPrice: parseFloat(pu.sellPrice.toString()),
      })),
    };

    return {
      success: true,
      data: serializedProduct,
    };
  } catch (error) {
    console.error("Get product by barcode error:", error);
    return {
      success: false,
      error: "Gagal mencari produk",
    };
  }
}

// Get customers for selector (active only)
export async function getPOSCustomers(search?: string) {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }
    requirePermission(session, "ACCESS_POS");

    //FIXED: Proper typing
    const where: Prisma.CustomerWhereInput = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      take: 20,
      orderBy: [{ code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        phone: true,
      },
    });

    return {
      success: true,
      data: customers,
    };
  } catch (error) {
    console.error("Get POS customers error:", error);
    return {
      success: false,
      error: "Gagal mengambil data customer",
    };
  }
}
// Fungsi ini dikhususkan untuk POS agar cepat dan return datanya siap untuk Invoice
export async function createPosTransaction(data: CreateSaleInput) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    requirePermission(session, "ACCESS_POS");

    const validated = createSaleSchema.parse(data);

    // A. Validasi & hitung ulang dari harga master (FIX QA B-1/B-3/M-1/M-8/M-30).
    // Harga, diskon, dan total dari HP tidak lagi dipercaya mentah-mentah.
    const productIds = validated.items.map((i) => i.productId);
    const customer = await prisma.customer.findUnique({
      where: { id: validated.customerId },
      select: { id: true, type: true },
    });
    if (!customer) {
      return { success: false, error: "Customer tidak ditemukan." };
    }
    const checkoutProducts = await loadCheckoutProducts(productIds);
    const unitNames = await loadUnitNames();
    let prepared;
    try {
      prepared = prepareCheckoutItems(validated.items, checkoutProducts, unitNames);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Item tidak valid." };
    }
    const totals = computeGrandTotal(prepared.totalAmount, validated.discount, validated.tax);
    let changeAmount: number;
    try {
      ({ changeAmount } = validatePaymentAndChange({
        paymentMethod: validated.paymentMethod,
        customerType: customer.type,
        grandTotal: totals.grandTotal,
        paidAmount: validated.paidAmount,
      }));
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Pembayaran tidak valid." };
    }
    
    // Cek cepat stok (angka final tetap dicek atomik di dalam transaksi).
    for (const [productId, qtyPrimary] of prepared.qtyPrimaryByProduct.entries()) {
      const product = checkoutProducts.find((p) => p.id === productId);
      if (!product || product.currentStock < qtyPrimary) {
        return {
          success: false,
          error: `Stok ${product?.name || "Produk"} tidak cukup. Tersedia: ${product?.currentStock ?? 0} (satuan utama), dibutuhkan: ${qtyPrimary}.`,
        };
      }
    }

    // B. Generate Invoice Helper
    const generateInvoiceNumber = async (tx: Prisma.TransactionClient) => {
        const date = new Date();
        const prefix = `INV/${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
        const lastSale = await tx.sale.findFirst({
            where: { invoiceNumber: { startsWith: prefix } },
            orderBy: { createdAt: 'desc' },
            select: { invoiceNumber: true }
        });
        const nextNum = lastSale ? parseInt(lastSale.invoiceNumber.split('-').pop() || '0') + 1 : 1;
        return `${prefix}-${String(nextNum).padStart(4, '0')}`;
    };

    // C. DATABASE TRANSACTION (diulang kalau nomor invoice tabrakan — M-2)
    const sale = await withUniqueRetry(() =>
      prisma.$transaction(async (tx) => {
        const invoiceNumber = await generateInvoiceNumber(tx);

        // 1. Create Sale + Items (Nested Write)
        const newSale = await tx.sale.create({
            data: {
                invoiceNumber,
                customerId: validated.customerId,
                cashierId: session.user.id,
                totalAmount: prepared.totalAmount,
                discount: totals.discount,
                tax: totals.tax,
                grandTotal: totals.grandTotal,
                paymentMethod: validated.paymentMethod,
                paidAmount: validated.paidAmount,
                changeAmount,
                status: (validated.paymentMethod === PaymentMethod.CREDIT && validated.paidAmount < totals.grandTotal)
                    ? SaleStatus.PENDING
                    : SaleStatus.COMPLETED,
                notes: "POS Transaction",
                saleItems: {
                    create: prepared.lines.map((item) => ({
                        productId: item.productId,
                        unitId: item.unitId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        discount: item.discount,
                        subtotal: item.subtotal,
                    }))
                }
            },
            include: {
                customer: true,
                cashier: { select: { name: true } },
                saleItems: {
                    include: { 
                        product: { select: { name: true, code: true } }, 
                        unit: { select: { name: true, symbol: true } } 
                    }
                }
            }
        });

        // 2. Kurangi stok secara atomik per produk (FIX QA B-1/B-2).
        // qtyPrimary sudah dalam satuan utama; updateMany bersyarat memastikan
        // stok tidak bisa minus kalau ada 2 kasir checkout bersamaan.
        for (const [productId, qtyPrimary] of prepared.qtyPrimaryByProduct.entries()) {
          const product = checkoutProducts.find((p) => p.id === productId);
          await decrementStockOrThrow(tx, productId, qtyPrimary, product?.name || "Produk");
        }
        // Catat log per baris item (jumlah dalam satuan utama)
        for (const item of prepared.lines) {
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: "OUT",
              quantity: item.qtyPrimary,
              referenceType: "POS_SALE",
              referenceId: newSale.id,
              createdById: session.user.id,
              notes: `POS ${invoiceNumber}`,
            },
          });
        }

        // 2b. Catat kas masuk (FIX QA M-7 — dulu checkout tidak pernah mencatat kas).
        await recordCashIn(tx, {
          amount: validated.paymentMethod === PaymentMethod.CREDIT ? validated.paidAmount : totals.grandTotal,
          description: `Penjualan ${invoiceNumber}`,
          userId: session.user.id,
        });

        // 3. Handle Debt (Jika Kredit) — hanya kalau masih ada sisa hutang (m-9:
        // CREDIT yang langsung lunas tidak membuat baris hutang nol yang abadi).
        if (validated.paymentMethod === PaymentMethod.CREDIT) {
          const remainingDebt = totals.grandTotal - validated.paidAmount;
          if (remainingDebt > 0) {
            const debtStatus = validated.paidAmount > 0 ? "PARTIAL" : "UNPAID";
            await tx.customerDebt.create({
              data: {
                debtNumber: await generateDebtNumber(tx),
                saleId: newSale.id,
                customerId: validated.customerId,
                totalDebt: totals.grandTotal,
                paidAmount: validated.paidAmount,
                remainingDebt,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: debtStatus,
                notes: "POS Credit",
              },
            });
          }
        }

        return newSale;
      }, { timeout: 15000 }) // Timeout 15s
    );

    // D1. Notifikasi order baru (dari paket perbaikan notifikasi — disatukan ke
    // sini supaya patch QA ini tidak menghapusnya; fire-and-forget).
    try {
      const { NotificationService } = await import("@/lib/services/notification.service");
      NotificationService.onNewOrder(
        sale.id,
        sale.invoiceNumber,
        sale.customer?.name ?? "Pelanggan",
        Number(sale.grandTotal),
      ).catch((e) => console.error("[Notif] Error notifying new POS order:", e));
      NotificationService.checkLowStockForProductIds(productIds).catch((e) =>
        console.error("[Notif] Error checking low stock after POS sale:", e),
      );
    } catch (e) {
      console.error("[Notif] Order notification dispatch error (POS):", e);
    }

    // D. Revalidate (Hanya path penting agar cepat)
    revalidatePath("/dashboard/pos"); 
    // Note: Kita tunda revalidate path lain (products/sales) jika dirasa membuat lambat, 
    // tapi idealnya tetap ada agar data sinkron.

    // E. SERIALIZE DATA (PENTING AGAR INVOICE MUNCUL CEPAT)
    // Mengubah semua Decimal ke Number sebelum dikirim ke Client
    const serializedSale = {
        ...sale,
        totalAmount: Number(sale.totalAmount),
        grandTotal: Number(sale.grandTotal),
        paidAmount: Number(sale.paidAmount),
        changeAmount: Number(sale.changeAmount),
        discount: Number(sale.discount),
        tax: Number(sale.tax),
        saleItems: sale.saleItems.map(item => ({
            ...item,
            unitPrice: Number(item.unitPrice),
            discount: Number(item.discount),
            subtotal: Number(item.subtotal),
            quantity: Number(item.quantity)
        }))
    };

    return { success: true, data: serializedSale };

  } catch (error) {
    console.error("Create POS Transaction Error:", error);
    // Sampaikan pesan validasi (mis. stok berubah) ke kasir; error teknis lain tetap generik.
    if (error instanceof Error && /Stok |tidak cukup|CREDIT|bayar|satuan utama/i.test(error.message)) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Gagal memproses transaksi" };
  }
}