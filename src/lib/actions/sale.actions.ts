"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  createSaleSchema,
  saleFilterSchema,
  type CreateSaleInput,
  type SaleFilterInput,
} from "@/lib/validations/sale.schema";
import { revalidatePath } from "next/cache";
import { PaymentMethod, SaleStatus, Prisma } from "@prisma/client";
import { SaleFilters } from "@/types/sale";
import { requirePermission, type AuthSession } from "../utils/role";
import {
  loadCheckoutProducts,
  loadUnitNames,
  prepareCheckoutItems,
  computeGrandTotal,
  validatePaymentAndChange,
  decrementStockOrThrow,
  generateDebtNumber,
  recordCashIn,
  reverseCashIn,
  primaryQuantityOrThrow,
  withUniqueRetry,
} from "@/lib/utils/stock-units";

async function generateInvoiceNumber(): Promise<string> {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const datePrefix = `${year}${month}${day}`;

  const lastSale = await prisma.sale.findFirst({
    where: {
      invoiceNumber: {
        startsWith: `INV-${datePrefix}`,
      },
    },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  if (!lastSale) {
    return `INV-${datePrefix}-001`;
  }

  const lastNumber = parseInt(lastSale.invoiceNumber.split("-")[2]);
  const newNumber = lastNumber + 1;
  return `INV-${datePrefix}-${newNumber.toString().padStart(3, "0")}`;
}

export async function createSale(data: CreateSaleInput) {
  try {
    const session = await auth();
    requirePermission(session, "CREATE_SALE");

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized. Please login first." };
    }

    const cashier = await prisma.user.findUnique({
      where: { email: session.user.email || "" },
      select: { id: true, name: true, role: true, email: true },
    });

    if (!cashier) {
      return { success: false, error: "User tidak ditemukan di database" };
    }

    const validated = createSaleSchema.parse(data);

    // FIX QA (B-1/B-3/M-1/M-8/M-30): validasi & hitung ulang dari harga master.
    // Harga/total dari klien tidak lagi dipercaya; satuan harus milik produk itu.
    const customer = await prisma.customer.findUnique({
      where: { id: validated.customerId },
      select: { id: true, type: true },
    });
    if (!customer) {
      return { success: false, error: "Customer tidak ditemukan" };
    }
    const productIds = validated.items.map((i) => i.productId);
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
          error: `Stock ${product?.name || "Produk"} (${product?.code || ""}) tidak mencukupi. Tersedia: ${product?.currentStock ?? 0} (satuan utama), dibutuhkan: ${qtyPrimary}`,
        };
      }
    }

    const saleItemsData = prepared.lines.map((item) => ({
      productId: item.productId,
      unitId: item.unitId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      subtotal: item.subtotal,
    }));

    // Nomor invoice dibuat fresh setiap percobaan (M-2 — tabrakan nomor diulang).
    const sale = await withUniqueRetry(async () => {
      const invoiceNumber = await generateInvoiceNumber();

      return prisma.$transaction(async (tx) => {
        // A. Create Sale + Sale Items (Nested Write - Lebih Cepat)
        const newSale = await tx.sale.create({
          data: {
            invoiceNumber,
            customerId: validated.customerId,
            cashierId: cashier.id,
            totalAmount: prepared.totalAmount,
            discount: totals.discount,
            tax: totals.tax,
            grandTotal: totals.grandTotal,
            paymentMethod: validated.paymentMethod,
            paidAmount: validated.paidAmount,
            changeAmount,
            status:
              validated.paymentMethod === PaymentMethod.CREDIT
                ? validated.paidAmount >= totals.grandTotal
                  ? SaleStatus.COMPLETED
                  : SaleStatus.PENDING
                : SaleStatus.COMPLETED,
            notes: validated.notes || null,
            // OPTIMASI: Simpan item langsung di sini (Nested Create)
            saleItems: {
              create: saleItemsData
            }
          },
          include: {
            customer: {
              select: { code: true, name: true, type: true },
            },
            cashier: {
              select: { name: true, email: true },
            },
          },
        });

        // B. Kurangi stok atomik per produk (FIX QA B-1/B-2) + catat log.
        for (const [productId, qtyPrimary] of prepared.qtyPrimaryByProduct.entries()) {
          const product = checkoutProducts.find((p) => p.id === productId);
          await decrementStockOrThrow(tx, productId, qtyPrimary, product?.name || "Produk");
        }
        for (const item of prepared.lines) {
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: "OUT",
              quantity: item.qtyPrimary,
              notes: `Penjualan ${invoiceNumber}`,
              referenceType: "Sale",
              referenceId: newSale.id,
              createdById: session.user.id,
            },
          });
        }

        // B2. Catat kas masuk (FIX QA M-7).
        await recordCashIn(tx, {
          amount: validated.paymentMethod === PaymentMethod.CREDIT ? validated.paidAmount : totals.grandTotal,
          description: `Penjualan ${invoiceNumber}`,
          userId: session.user.id,
        });

        // C. Create Customer Debt (Jika Credit) — hanya kalau ada sisa hutang (m-9).
        if (validated.paymentMethod === PaymentMethod.CREDIT) {
          const remainingDebt = totals.grandTotal - validated.paidAmount;
          if (remainingDebt > 0) {
            const debtNumber = await generateDebtNumber(tx);
            const debtStatus = validated.paidAmount > 0 ? "PARTIAL" : "UNPAID";
            await tx.customerDebt.create({
              data: {
                debtNumber,
                saleId: newSale.id,
                customerId: validated.customerId,
                totalDebt: totals.grandTotal,
                paidAmount: validated.paidAmount,
                remainingDebt,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 Hari
                status: debtStatus,
                notes: `Utang dari penjualan ${invoiceNumber}`,
              },
            });
          }
        }

        return newSale;
        },
        // Config Timeout: Beri waktu lebih (20 detik)
        { maxWait: 5000, timeout: 20000 }
      );
    });

    // Notifikasi order baru (dari paket perbaikan notifikasi — disatukan ke
    // sini supaya patch QA ini tidak menghapusnya; fire-and-forget).
    try {
      const { NotificationService } = await import("@/lib/services/notification.service");
      NotificationService.onNewOrder(
        sale.id,
        sale.invoiceNumber,
        sale.customer?.name ?? "Pelanggan",
        Number(sale.grandTotal),
      ).catch((e) => console.error("[Notif] Error notifying new sale:", e));
      NotificationService.checkLowStockForProductIds(productIds).catch((e) =>
        console.error("[Notif] Error checking low stock after sale:", e),
      );
    } catch (e) {
      console.error("[Notif] Order notification dispatch error (createSale):", e);
    }

    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard/sales");

    // Serialize Decimal ke Number agar aman di client
    const serializedSale = {
      ...sale,
      totalAmount: Number(sale.totalAmount),
      discount: Number(sale.discount),
      tax: Number(sale.tax),
      grandTotal: Number(sale.grandTotal),
      paidAmount: Number(sale.paidAmount),
      changeAmount: Number(sale.changeAmount),
    };

    return {
      success: true,
      data: serializedSale,
      message: `Transaksi ${sale.invoiceNumber} berhasil disimpan`,
    };

  } catch (error) {
    console.error("Create sale error:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Gagal menyimpan transaksi" };
  }
}

export async function updateSale(saleId: string, data: CreateSaleInput) {
  try {
    const session = await auth();
    requirePermission(session, "CREATE_SALE");

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized. Please login first." };
    }

    const cashier = await prisma.user.findUnique({
      where: { email: session.user.email || "" },
      select: { id: true, name: true, role: true, email: true },
    });

    if (!cashier) return { success: false, error: "User tidak ditemukan" };

    const validated = createSaleSchema.parse(data);

    // 1. Get existing sale with all relations
    const existingSale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        saleItems: true,
        deliveryOrder: {
            include: { deliveryItems: true }
        },
        customerDebts: true
      }
    });

    if (!existingSale) return { success: false, error: "Transaksi tidak ditemukan" };
    if (existingSale.status === "CANCELLED" || existingSale.status === "RETURN") {
        return { success: false, error: "Tidak dapat mengubah transaksi yang dibatalkan/return" };
    }

    // Reject if delivery order is IN_TRANSIT or DELIVERED
    if (existingSale.deliveryOrder && (existingSale.deliveryOrder.status === "IN_TRANSIT" || existingSale.deliveryOrder.status === "DELIVERED")) {
        return { success: false, error: "Tidak dapat mengubah transaksi karena Surat Jalan sudah di jalan (IN_TRANSIT) atau Selesai." };
    }

    // 2. Resolve Products & Units — FIX QA (B-1/M-1/M-3/M-8): hitung ulang dari
    // harga master, konversi ke satuan utama, cicilan lama dipertahankan.
    const customer = await prisma.customer.findUnique({
      where: { id: validated.customerId },
      select: { id: true, type: true },
    });
    if (!customer) return { success: false, error: "Customer tidak ditemukan" };

    const productIds = validated.items.map((i) => i.productId);
    const oldProductIds = existingSale.saleItems.map(i => i.productId);
    const allProductIds = Array.from(new Set([...productIds, ...oldProductIds]));

    const checkoutProducts = await loadCheckoutProducts(allProductIds);
    const unitNames = await loadUnitNames();
    const productMap = new Map(checkoutProducts.map((p) => [p.id, p]));

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

    // Cicilan yang sudah dibayar tidak boleh hilang saat edit (M-3).
    const existingDebt = existingSale.customerDebts?.[0] ?? null;
    const preservedPaid = existingDebt ? Number(existingDebt.paidAmount) : 0;
    if (preservedPaid > totals.grandTotal) {
      return { success: false, error: `Total baru (Rp ${totals.grandTotal.toLocaleString("id-ID")}) lebih kecil dari yang sudah dibayar (Rp ${preservedPaid.toLocaleString("id-ID")}). Kurangi pembayaran dulu di menu Hutang sebelum mengedit.` };
    }
    const effectivePaid = validated.paymentMethod === PaymentMethod.CREDIT
      ? Math.max(preservedPaid, validated.paidAmount)
      : validated.paidAmount;

    // Calculate diff for stock (dalam satuan utama)
    const stockDiff = new Map<string, number>();
    for (const oldItem of existingSale.saleItems) {
      const oldProduct = productMap.get(oldItem.productId);
      const oldPu = oldProduct?.productUnits.find((pu) => pu.unitId === oldItem.unitId);
      if (!oldPu) {
        return { success: false, error: `Satuan lama untuk ${oldProduct?.name || "produk"} tidak ditemukan di master. Perbaiki data produk dulu sebelum mengedit transaksi ini.` };
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
        return { success: false, error: e instanceof Error ? e.message : "Item lama tidak valid." };
      }
      stockDiff.set(oldItem.productId, (stockDiff.get(oldItem.productId) || 0) - qtyPrimaryOld);
    }
    for (const [pId, qtyPrimary] of prepared.qtyPrimaryByProduct.entries()) {
      stockDiff.set(pId, (stockDiff.get(pId) || 0) + qtyPrimary);
    }

    // Verify stock availability
    for (const [pId, diffQty] of stockDiff.entries()) {
        if (diffQty > 0) {
            const product = productMap.get(pId);
            if (!product) return { success: false, error: `Produk tidak ditemukan` };
            if (product.currentStock < diffQty) {
                return { success: false, error: `Stock ${product.name} tidak mencukupi untuk penambahan.` };
            }
        }
    }

    // 3. Prepare new Sale Items
    const saleItemsData = prepared.lines.map((item) => ({
      productId: item.productId,
      unitId: item.unitId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      subtotal: item.subtotal,
    }));

    // 4. TRANSACTION
    const updatedSale = await prisma.$transaction(async (tx) => {
        // A. Delete old Sale Items & Delivery Items
        await tx.saleItem.deleteMany({ where: { saleId } });
        if (existingSale.deliveryOrder) {
            await tx.deliveryItem.deleteMany({ where: { deliveryOrderId: existingSale.deliveryOrder.id } });
        }

        // B. Update Sale & Create new Sale Items (harga/total dari hitung ulang)
        const status = validated.paymentMethod === PaymentMethod.CREDIT
            ? (effectivePaid >= totals.grandTotal ? SaleStatus.COMPLETED : SaleStatus.PENDING)
            : SaleStatus.COMPLETED;

        const sale = await tx.sale.update({
            where: { id: saleId },
            data: {
                customerId: validated.customerId,
                totalAmount: prepared.totalAmount,
                discount: totals.discount,
                tax: totals.tax,
                grandTotal: totals.grandTotal,
                paymentMethod: validated.paymentMethod,
                paidAmount: effectivePaid,
                changeAmount,
                status,
                notes: validated.notes || existingSale.notes,
                saleItems: { create: saleItemsData }
            }
        });

        // C. Update Delivery Order Items if exists
        if (existingSale.deliveryOrder) {
            const deliveryItemsData = prepared.lines.map((item) => ({
                productId: item.productId,
                unitId: item.unitId,
                quantity: item.quantity,
            }));
            await tx.deliveryOrder.update({
                where: { id: existingSale.deliveryOrder.id },
                data: {
                    customerId: validated.customerId,
                    deliveryItems: { create: deliveryItemsData }
                }
            });
        }

        // D. Stock update & StockMovement Log (selisih dalam satuan utama;
        // penambahan dicek atomik supaya tidak minus kalau stok berubah bersamaan)
        for (const [pId, diffQty] of stockDiff.entries()) {
            if (diffQty !== 0) {
                if (diffQty > 0) {
                  const product = checkoutProducts.find((p) => p.id === pId);
                  await decrementStockOrThrow(tx, pId, diffQty, product?.name || "Produk");
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
                        notes: `Edit Penjualan ${existingSale.invoiceNumber}`,
                        referenceType: "Sale Edit",
                        referenceId: saleId,
                        createdById: session.user.id,
                    }
                });
            }
        }

        // E. Update Customer Debt (FIX QA M-3: cicilan yang sudah dibayar dipertahankan)
        if (validated.paymentMethod === PaymentMethod.CREDIT) {
            const remainingDebt = totals.grandTotal - effectivePaid;
            const debtStatus = remainingDebt <= 0 ? "PAID" : (effectivePaid > 0 ? "PARTIAL" : "UNPAID");

            if (existingDebt) {
                await tx.customerDebt.update({
                    where: { id: existingDebt.id },
                    data: {
                        customerId: validated.customerId,
                        totalDebt: totals.grandTotal,
                        paidAmount: effectivePaid,
                        remainingDebt,
                        status: debtStatus,
                    }
                });
            } else if (remainingDebt > 0) {
                const debtNumber = await generateDebtNumber(tx);
                await tx.customerDebt.create({
                    data: {
                        debtNumber,
                        saleId: sale.id,
                        customerId: validated.customerId,
                        totalDebt: totals.grandTotal,
                        paidAmount: effectivePaid,
                        remainingDebt,
                        status: debtStatus,
                        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        notes: `Utang dari edit penjualan ${existingSale.invoiceNumber}`
                    }
                });
            }
        } else {
            if (existingDebt) {
                 await tx.customerDebt.update({
                    where: { id: existingDebt.id },
                    data: {
                        paidAmount: totals.grandTotal,
                        status: "PAID",
                        remainingDebt: 0,
                        notes: `[LUNAS KARENA EDIT METODE PEMBAYARAN KE ${validated.paymentMethod}]`
                    }
                });
            }
        }

        return sale;
    }, { maxWait: 10000, timeout: 30000 });

    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard/sales");

    return {
      success: true,
      data: updatedSale,
      message: `Transaksi ${existingSale.invoiceNumber} berhasil diedit`,
    };

  } catch (error) {
    console.error("Update sale error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Gagal mengedit transaksi" };
  }
}

export async function getSales(params?: SaleFilterInput, externalSession?: AuthSession | null) {
  try {
    const session = externalSession || (await auth());
    if (!session?.user) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }
    requirePermission(session, "VIEW_SALES");

    const validated = saleFilterSchema.parse(params || {});
    const {
      search,
      customerId,
      cashierId,
      paymentMethod,
      status,
      dateFrom,
      dateTo,
      page,
      limit,
      sortOrder,
    } = validated;

    const skip = (page - 1) * limit;
    const where: Prisma.SaleWhereInput = {};

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (customerId) where.customerId = customerId;
    if (cashierId) where.cashierId = cashierId;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (status) where.status = status;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: sortOrder || "desc" },
        include: {
          customer: {
            select: {
              code: true,
              name: true,
              type: true,
            },
          },
          cashier: {
            select: {
              name: true,
              email: true,
            },
          },
          saleItems: {
            // ✅ FIXED: saleItems instead of items
            include: {
              product: {
                select: {
                  code: true,
                  name: true,
                },
              },
              unit: true, // ✅ FIXED: unit instead of productUnit
            },
          },
          customerDebts: {
            // ✅ FIX: plural customerDebts
            select: {
              id: true,
              totalDebt: true,
              paidAmount: true,
              remainingDebt: true,
              status: true,
            },
          },
          deliveryOrder: {
            select: {
              id: true,
              doNumber: true,
              status: true,
            },
          },
        },
      }),
      prisma.sale.count({ where }),
    ]);

    // LINE 330-365, GANTI DENGAN KONSTRUKSI MANUAL:
    return {
      success: true,
      data: sales.map((sale) => {
        // ✅ Manual construct untuk menghindari spread operator
        const serializedSale = {
          id: sale.id,
          invoiceNumber: sale.invoiceNumber,
          customerId: sale.customerId,
          cashierId: sale.cashierId,
          saleDate: sale.saleDate,
          totalAmount: Number(sale.totalAmount),
          discount: Number(sale.discount),
          tax: Number(sale.tax),
          grandTotal: Number(sale.grandTotal),
          paymentMethod: sale.paymentMethod,
          paidAmount: Number(sale.paidAmount),
          changeAmount: Number(sale.changeAmount),
          notes: sale.notes,
          status: sale.status,
          createdAt: sale.createdAt,
          updatedAt: sale.updatedAt,

          // ✅ Customer (manual)
          customer: sale.customer
            ? {
                code: sale.customer.code,
                name: sale.customer.name,
                type: sale.customer.type,
              }
            : null,

          // ✅ Cashier (manual)
          cashier: {
            name: sale.cashier.name,
            email: sale.cashier.email,
          },

          // ✅ Sale Items (manual map)
          saleItems: sale.saleItems.map((item) => ({
            id: item.id,
            saleId: item.saleId,
            productId: item.productId,
            unitId: item.unitId,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            discount: Number(item.discount),
            subtotal: Number(item.subtotal),
            createdAt: item.createdAt,
            product: {
              code: item.product.code,
              name: item.product.name,
            },
            unit: item.unit,
          })),

          // ✅ Customer Debt (manual construct - INI KUNCINYA!)
          customerDebt:
            sale.customerDebts && sale.customerDebts.length > 0
              ? {
                  id: sale.customerDebts[0].id,
                  totalDebt: Number(sale.customerDebts[0].totalDebt),
                  paidAmount: Number(sale.customerDebts[0].paidAmount),
                  remainingDebt: Number(sale.customerDebts[0].remainingDebt),
                  status: sale.customerDebts[0].status,
                }
              : null,

          // ✅ Delivery Order relation
          deliveryOrder: sale.deliveryOrder
            ? {
                id: sale.deliveryOrder.id,
                doNumber: sale.deliveryOrder.doNumber,
                status: sale.deliveryOrder.status,
              }
            : null,
        };

        return serializedSale;
      }),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("Get sales error:", error);
    return {
      success: false,
      error: "Gagal mengambil data penjualan",
    };
  }
}

export async function cancelSale(id: string, reason: string) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }
    
    if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN") {
      return {
        success: false,
        error: "Anda tidak memiliki akses untuk membatalkan transaksi",
      };
    }
    requirePermission(session, "CANCEL_SALE");

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        saleItems: true, // ✅ FIXED: saleItems
        deliveryOrder: true,
        customerDebts: true,
      },
    });

    if (!sale) {
      return {
        success: false,
        error: "Transaksi tidak ditemukan",
      };
    }

    if (sale.status === SaleStatus.CANCELLED) {
      return {
        success: false,
        error: "Transaksi sudah dibatalkan sebelumnya",
      };
    }

    if (sale.status === SaleStatus.RETURN) {
      return {
        success: false,
        error: "Transaksi yang sudah di-return tidak dapat dibatalkan",
      };
    }

    if (sale.deliveryOrder && (sale.deliveryOrder.status === "IN_TRANSIT" || sale.deliveryOrder.status === "DELIVERED")) {
      return {
        success: false,
        error: "Tidak dapat membatalkan transaksi karena Surat Jalan sedang dikirim (IN_TRANSIT) atau sudah terkirim (DELIVERED).",
      };
    }

    // FIX QA (M-4): hutang yang sudah ada cicilannya tidak boleh dibatalkan
    // diam-diam — cicilan itu uang yang sudah masuk.
    const paidDebt = sale.customerDebts.find((d) => Number(d.paidAmount) > 0);
    if (paidDebt) {
      return {
        success: false,
        error: `Tidak dapat membatalkan: hutang ini sudah dibayar Rp ${Number(paidDebt.paidAmount).toLocaleString("id-ID")}. Hapus pembayaran dulu di menu Hutang.`,
      };
    }

    // Hitung pengembalian stok dalam satuan utama (FIX QA B-1).
    const restoreItems: Array<{ productId: string; qtyPrimary: number; productName: string }> = [];
    {
      const productIds = Array.from(new Set(sale.saleItems.map((i) => i.productId)));
      const checkoutProducts = await loadCheckoutProducts(productIds);
      const unitNames = await loadUnitNames();
      for (const item of sale.saleItems) {
        const product = checkoutProducts.find((p) => p.id === item.productId);
        const pu = product?.productUnits.find((u) => u.unitId === item.unitId);
        if (!product || !pu) {
          return { success: false, error: `Satuan untuk ${product?.name || "produk"} tidak ditemukan di master. Perbaiki data produk dulu.` };
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
          return { success: false, error: e instanceof Error ? e.message : "Item tidak valid." };
        }
        restoreItems.push({ productId: item.productId, qtyPrimary, productName: product.name });
      }
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Klaim di DALAM transaksi: dua admin batalkan bersamaan tidak boleh
      // mengembalikan stok 2x.
      const claimed = await tx.sale.updateMany({
        where: { id, status: { not: SaleStatus.CANCELLED } },
        data: { status: SaleStatus.CANCELLED },
      });
      if (claimed.count === 0) throw new Error("Transaksi sudah dibatalkan, muat ulang dulu.");
      await tx.sale.update({
        where: { id },
        data: {
          status: SaleStatus.CANCELLED,
          notes: `${sale.notes || ""}\n[CANCELLED] ${reason}`.trim(),
        },
      });

      // Kembalikan stok (satuan utama) + catat log
      for (const item of restoreItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: {
              increment: item.qtyPrimary,
            },
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "IN",
            quantity: item.qtyPrimary,
            notes: `Pembatalan penjualan ${sale.invoiceNumber} - ${reason}`,
            referenceType: "Sale Cancellation",
            referenceId: sale.id,
            createdById: session.user.id,
          },
        });
      }

      // FIX QA (M-4): hutang yang dibatalkan DIHAPUS (belum ada pembayaran),
      // bukan ditandai PAID — menandai PAID membuat laporan hutang salah.
      if (sale.paymentMethod === PaymentMethod.CREDIT) {
        await tx.customerDebt.deleteMany({
          where: { saleId: sale.id },
        });
      }

      // Balikkan kas masuk dari penjualan ini (pasangan M-7).
      await reverseCashIn(tx, { invoiceNumber: sale.invoiceNumber, userId: session.user.id });

      // ✅ Update Delivery Order status to CANCELLED if exists
      if (sale.deliveryOrder) {
        await tx.deliveryOrder.update({
          where: { id: sale.deliveryOrder.id },
          data: {
            status: "CANCELLED",
            notes: `${sale.deliveryOrder.notes || ""}\n[DIBATALKAN KARENA TRANSAKSI DIBATALKAN: ${reason}]`.trim(),
          },
        });
      }
    });

    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/delivery-orders");

    return {
      success: true,
      message: `Transaksi ${sale.invoiceNumber} berhasil dibatalkan`,
    };
  } catch (error) {
    console.error("Cancel sale error:", error);
    return {
      success: false,
      error: "Gagal membatalkan transaksi",
    };
  }
}

export async function getSalesStatistics(dateFrom?: Date, dateTo?: Date) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }
    requirePermission(session, "VIEW_SALES");

    const where: Prisma.SaleWhereInput = {
      status: SaleStatus.COMPLETED,
    };

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [totalSales, totalRevenue, salesByPaymentMethod] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.aggregate({
        where,
        _sum: {
          grandTotal: true,
        },
      }),
      prisma.sale.groupBy({
        by: ["paymentMethod"],
        where,
        _sum: {
          grandTotal: true,
        },
        _count: true,
      }),
    ]);

    return {
      success: true,
      data: {
        totalSales,
        totalRevenue: totalRevenue._sum.grandTotal || 0,
        salesByPaymentMethod,
      },
    };
  } catch (error) {
    console.error("Get sales statistics error:", error);
    return {
      success: false,
      error: "Gagal mengambil statistik penjualan",
    };
  }
}
// Get sale by ID for invoice preview
export async function getSaleById(saleId: string, externalSession?: AuthSession | null) {
  const session = externalSession || (await auth());
  requirePermission(session, "VIEW_SALES");
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        customer: {
          select: {
            code: true,
            name: true,
            type: true,
            phone: true,
            address: true,
          },
        },
        cashier: {
          select: {
            name: true,
            email: true,
          },
        },
        saleItems: {
          include: {
            product: {
              select: {
                code: true,
                name: true,
              },
            },
            unit: {
              // ✅ FIXED: unit instead of productUnit
              select: {
                name: true,
                symbol: true,
              },
            },
          },
        },
        customerDebts: {
          // ✅ TAMBAH INI
          select: {
            id: true,
            totalDebt: true,
            paidAmount: true,
            remainingDebt: true,
            status: true,
          },
        },
      },
    });

    if (!sale) {
      return {
        success: false,
        error: "Invoice tidak ditemukan",
      };
    }

    // ✅ Serialize all Decimal fields
    const serializedSale = {
      // ✅ Manual construct - TIDAK pakai spread operator
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      customerId: sale.customerId,
      cashierId: sale.cashierId,
      saleDate: sale.saleDate,
      status: sale.status,
      paymentMethod: sale.paymentMethod,
      notes: sale.notes,
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,

      // ✅ Convert Decimal fields
      totalAmount: parseFloat(sale.totalAmount.toString()),
      discount: parseFloat(sale.discount.toString()),
      tax: parseFloat(sale.tax.toString()),
      grandTotal: parseFloat(sale.grandTotal.toString()),
      paidAmount: parseFloat(sale.paidAmount.toString()),
      changeAmount: parseFloat(sale.changeAmount.toString()),

      // ✅ Customer
      customer: sale.customer,

      // ✅ Cashier
      cashier: sale.cashier,

      // ✅ Sale Items
      saleItems: sale.saleItems.map((item) => ({
        id: item.id,
        saleId: item.saleId,
        productId: item.productId,
        unitId: item.unitId,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice.toString()),
        discount: parseFloat(item.discount.toString()),
        subtotal: parseFloat(item.subtotal.toString()),
        createdAt: item.createdAt,
        product: item.product,
        unit: item.unit,
      })),

      // ✅ Customer Debt (manual construct)
      customerDebt: sale.customerDebts?.[0]
        ? {
            id: sale.customerDebts[0].id,
            status: sale.customerDebts[0].status,
            totalDebt: parseFloat(sale.customerDebts[0].totalDebt.toString()),
            paidAmount: parseFloat(sale.customerDebts[0].paidAmount.toString()),
            remainingDebt: parseFloat(
              sale.customerDebts[0].remainingDebt.toString()
            ),
          }
        : null,
    };

    return {
      success: true,
      data: serializedSale,
    };
  } catch (error) {
    console.error("Get sale error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Gagal mengambil data invoice",
    };
  }
}

export async function getSalesForTable(params?: SaleFilters) {
  try {
    const session = await auth();
    requirePermission(session, "VIEW_SALES");
   

    const validated = saleFilterSchema.parse(params || {});
    const {
      search,
      customerId,
      cashierId,
      paymentMethod,
      status,
      dateFrom,
      dateTo,
      page,
      limit,
    } = validated;

    const skip = (page - 1) * limit;
    const where: Prisma.SaleWhereInput = {};

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (customerId) where.customerId = customerId;
    if (cashierId) where.cashierId = cashierId;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (status) where.status = status;

    if (dateFrom || dateTo) {
      where.saleDate = {};
      if (dateFrom) where.saleDate.gte = dateFrom;
      if (dateTo) where.saleDate.lte = dateTo;
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { saleDate: "desc" },
        include: {
          customer: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
            },
          },
          cashier: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              saleItems: true,
            },
          },
        },
      }),
      prisma.sale.count({ where }),
    ]);

    const serialized = sales.map((sale) => ({
      ...sale,
      totalAmount: Number(sale.totalAmount),
      discount: Number(sale.discount),
      tax: Number(sale.tax),
      grandTotal: Number(sale.grandTotal),
      paidAmount: Number(sale.paidAmount),
      changeAmount: Number(sale.changeAmount),
    }));

    return {
      success: true,
      data: serialized,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("Get sales error:", error);
    return { success: false, error: "Gagal mengambil data penjualan" };
  }
}

export async function getTodaySalesStats() {
  try {
    const session = await auth();
    requirePermission(session, "VIEW_SALES");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalSales, totalRevenue, todaySales, pendingSales] =
      await Promise.all([
        prisma.sale.count({
          where: { status: SaleStatus.COMPLETED },
        }),
        prisma.sale.aggregate({
          where: { status: SaleStatus.COMPLETED },
          _sum: { grandTotal: true },
        }),
        prisma.sale.count({
          where: {
            saleDate: { gte: today, lt: tomorrow },
            status: SaleStatus.COMPLETED,
          },
        }),
        prisma.sale.count({
          where: { status: SaleStatus.PENDING },
        }),
      ]);

    return {
      success: true,
      data: {
        totalSales,
        totalRevenue: Number(totalRevenue._sum.grandTotal || 0),
        todaySales,
        pendingSales,
      },
    };
  } catch (error) {
    console.error("Get stats error:", error);
    return { success: false, error: "Gagal mengambil statistik" };
  }
}
export async function deleteSale(id: string, passwordInput?: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "DELETE_SALE");

    if (!passwordInput) {
      return { success: false, error: "Password konfirmasi wajib diisi!" };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return { success: false, error: "User tidak ditemukan" };
    }

    const isPasswordCorrect = await bcrypt.compare(passwordInput, user.password);
    if (!isPasswordCorrect) {
      return { success: false, error: "Password konfirmasi salah!" };
    }

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        saleItems: true,
        deliveryOrder: true,
        customerDebts: true,
      },
    });

    if (!sale) {
      return { success: false, error: "Penjualan tidak ditemukan" };
    }

    if (sale.status === SaleStatus.CANCELLED) {
      return {
        success: false,
        error: "Penjualan sudah dibatalkan sebelumnya!",
      };
    }

    if (sale.deliveryOrder && (sale.deliveryOrder.status === "IN_TRANSIT" || sale.deliveryOrder.status === "DELIVERED")) {
      return {
        success: false,
        error: "Tidak dapat menghapus transaksi karena Surat Jalan sedang di jalan (IN_TRANSIT) atau sudah DITERIMA.",
      };
    }

    if (sale.status === SaleStatus.RETURN) {
      return {
        success: false,
        error: "Penjualan yang sudah di-return tidak dapat dihapus",
      };
    }

    // FIX QA (M-4): hutang yang sudah ada cicilannya tidak boleh dihapus diam-diam.
    const paidDebt = sale.customerDebts.find((d) => Number(d.paidAmount) > 0);
    if (paidDebt) {
      return {
        success: false,
        error: `Tidak dapat menghapus: hutang ini sudah dibayar Rp ${Number(paidDebt.paidAmount).toLocaleString("id-ID")}. Hapus pembayaran dulu di menu Hutang.`,
      };
    }

    // Hitung pengembalian stok dalam satuan utama (FIX QA B-1).
    const restoreItems: Array<{ productId: string; qtyPrimary: number }> = [];
    {
      const productIds = Array.from(new Set(sale.saleItems.map((i) => i.productId)));
      const checkoutProducts = await loadCheckoutProducts(productIds);
      const unitNames = await loadUnitNames();
      for (const item of sale.saleItems) {
        const product = checkoutProducts.find((p) => p.id === item.productId);
        const pu = product?.productUnits.find((u) => u.unitId === item.unitId);
        if (!product || !pu) {
          return { success: false, error: `Satuan untuk ${product?.name || "produk"} tidak ditemukan di master. Perbaiki data produk dulu.` };
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
          return { success: false, error: e instanceof Error ? e.message : "Item tidak valid." };
        }
        restoreItems.push({ productId: item.productId, qtyPrimary });
      }
    }

    // Soft delete (Tutup Buku): update status to CANCELLED and restore stock/debt
    await prisma.$transaction(async (tx) => {
      // Klaim di DALAM transaksi (lihat cancelSale di atas).
      const claimed = await tx.sale.updateMany({
        where: { id, status: { not: SaleStatus.CANCELLED } },
        data: { status: SaleStatus.CANCELLED },
      });
      if (claimed.count === 0) throw new Error("Penjualan sudah dibatalkan sebelumnya, muat ulang dulu.");
      // 1. Update sale status to CANCELLED
      await tx.sale.update({
        where: { id },
        data: {
          status: SaleStatus.CANCELLED,
          notes: `${sale.notes || ""}\n[DIHAPUS] Dihapus oleh Admin via Konfirmasi Password.`.trim(),
        },
      });

      // 2. Restore stock for each item (satuan utama)
      for (const item of restoreItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: {
              increment: item.qtyPrimary,
            },
          },
        });

        // 3. Create stock movement log
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "IN",
            quantity: item.qtyPrimary,
            notes: `Pembatalan/Penghapusan Transaksi ${sale.invoiceNumber}`,
            referenceType: "Sale Cancellation",
            referenceId: sale.id,
            createdById: session.user.id,
          },
        });
      }

      // 4. Hapus hutang (belum ada pembayaran) — bukan ditandai PAID (M-4).
      if (sale.paymentMethod === PaymentMethod.CREDIT) {
        await tx.customerDebt.deleteMany({
          where: { saleId: sale.id },
        });
      }

      // 4b. Balikkan kas masuk dari penjualan ini (pasangan M-7).
      await reverseCashIn(tx, { invoiceNumber: sale.invoiceNumber, userId: session.user.id });

      // 5. Update Delivery Order status to CANCELLED if exists
      if (sale.deliveryOrder) {
        await tx.deliveryOrder.update({
          where: { id: sale.deliveryOrder.id },
          data: {
            status: "CANCELLED",
            notes: `${sale.deliveryOrder.notes || ""}\n[DIBATALKAN KARENA TRANSAKSI DIHAPUS]`.trim(),
          },
        });
      }
    });

    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/delivery-orders");

    return {
      success: true,
      message: `Penjualan ${sale.invoiceNumber} berhasil dibatalkan (Tutup Buku)`,
    };
  } catch (error) {
    console.error("Delete sale error:", error);
    return { success: false, error: "Gagal memproses penghapusan penjualan" };
  }
}

/**
 * Update Bukti Transfer / Pembayaran atau Catatan Transaksi
 */
export async function updateSaleProof(saleId: string, proofUrl: string | null, customNotes?: string) {
  try {
    const session = await auth();
    requirePermission(session, "VIEW_SALES");

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      select: { id: true, notes: true, invoiceNumber: true },
    });

    if (!sale) {
      return { success: false, error: "Transaksi tidak ditemukan" };
    }

    let existingNotes = sale.notes || "";
    // Hapus tag bukti lama jika ada
    existingNotes = existingNotes.replace(/\[BUKTI_TF\]:\s*[^\s\]\n]+/g, "").trim();

    if (customNotes !== undefined) {
      existingNotes = customNotes.trim();
    }

    const newNotes = proofUrl ? `${existingNotes} [BUKTI_TF]: ${proofUrl}`.trim() : existingNotes;

    const updated = await prisma.sale.update({
      where: { id: saleId },
      data: { notes: newNotes },
    });

    revalidatePath("/dashboard/sales");

    return {
      success: true,
      data: updated,
      message: "Bukti pembayaran berhasil diperbarui",
    };
  } catch (error) {
    console.error("[UPDATE_SALE_PROOF_ERROR]", error);
    return { success: false, error: "Gagal memperbarui bukti pembayaran" };
  }
}

