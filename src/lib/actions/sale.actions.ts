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
import { requirePermission } from "../utils/role";

// ==================== GENERATE INVOICE NUMBER ====================
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

// ==================== GENERATE DEBT NUMBER ====================
async function generateDebtNumber(
  tx: Prisma.TransactionClient
): Promise<string> {
  const lastDebt = await tx.customerDebt.findFirst({
    where: { debtNumber: { startsWith: "DEBT-CUST-" } },
    orderBy: { debtNumber: "desc" },
    select: { debtNumber: true },
  });

  if (!lastDebt) {
    return "DEBT-CUST-001";
  }

  const lastNumber = parseInt(lastDebt.debtNumber.split("-")[2]);
  const newNumber = lastNumber + 1;
  return `DEBT-CUST-${newNumber.toString().padStart(3, "0")}`;
}

// ==================== CREATE SALE (OPTIMIZED) ====================
export async function createSale(data: CreateSaleInput) {
  try {
    const session = await auth();
    requirePermission(session, "CREATE_SALE");

    // --- 1. Validasi User & Session ---
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

    // --- 2. Validasi Stok (PRE-TRANSACTION / DI LUAR TRANSAKSI) ---
    // Mengambil semua data produk sekaligus (Bulk Read) agar cepat
    const productIds = validated.items.map((i) => i.productId);
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
          },
        },
      },
    });

    // Buat Map untuk pencarian cepat
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Build a map of ProductUnit.id to Unit.id
    const productUnitToUnitMap = new Map<string, string>();
    for (const product of products) {
      for (const pu of product.productUnits) {
        productUnitToUnitMap.set(pu.id, pu.unitId);
      }
    }

    for (const item of validated.items) {
      const product = productMap.get(item.productId);
      
      if (!product) {
        return { success: false, error: `Produk tidak ditemukan: ${item.productId}` };
      }

      // Cek Stok (Tanpa Query DB lagi)
      if (Number(product.currentStock) < item.quantity) {
        return {
          success: false,
          error: `Stock ${product.name} (${product.code}) tidak mencukupi. Tersedia: ${product.currentStock}, Diminta: ${item.quantity}`,
        };
      }
    }

    // --- 3. Persiapkan Data Item untuk Disimpan Sekaligus ---
    const saleItemsData = validated.items.map((item) => {
      const unitId = productUnitToUnitMap.get(item.productUnitId);
      if (!unitId) {
        throw new Error(`Master Satuan tidak ditemukan untuk productUnitId: ${item.productUnitId}`);
      }
      return {
        productId: item.productId,
        unitId: unitId, // resolved to Unit.id
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        subtotal: item.subtotal,
      };
    });

    // Generate Invoice Number (Di luar transaksi jika tidak butuh lock ketat, sesuai kode asli)
    const invoiceNumber = await generateInvoiceNumber();

    // --- 4. DATABASE TRANSACTION (OPTIMIZED) ---
    const sale = await prisma.$transaction(async (tx) => {
        // A. Create Sale + Sale Items (Nested Write - Lebih Cepat)
        const newSale = await tx.sale.create({
          data: {
            invoiceNumber,
            customerId: validated.customerId,
            cashierId: cashier.id,
            totalAmount: validated.totalAmount,
            discount: validated.discount,
            tax: validated.tax,
            grandTotal: validated.grandTotal,
            paymentMethod: validated.paymentMethod,
            paidAmount: validated.paidAmount,
            changeAmount: validated.changeAmount,
            status:
              validated.paymentMethod === PaymentMethod.CREDIT
                ? validated.paidAmount >= validated.grandTotal
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

        // B. Update Stock & Create Log (PARALLEL EXECUTION)
        // Jalankan semua update stok secara paralel, bukan antrian
        await Promise.all(
          validated.items.map(async (item) => {
            // 1. Update Product Stock
            await tx.product.update({
              where: { id: item.productId },
              data: {
                currentStock: { decrement: item.quantity },
              },
            });

            // 2. Create Stock Movement
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: "OUT",
                quantity: item.quantity,
                notes: `Penjualan ${invoiceNumber}`,
                referenceType: "Sale",
                referenceId: newSale.id,
                createdById: session.user.id,
              },
            });
          })
        );

        // C. Create Customer Debt (Jika Credit)
        if (validated.paymentMethod === PaymentMethod.CREDIT) {
          const debtNumber = await generateDebtNumber(tx); // Asumsi fungsi ini butuh tx
          const debtStatus = validated.paidAmount >= validated.grandTotal
            ? "PAID"
            : validated.paidAmount > 0
              ? "PARTIAL"
              : "UNPAID";

          await tx.customerDebt.create({
            data: {
              debtNumber,
              saleId: newSale.id,
              customerId: validated.customerId,
              totalDebt: validated.grandTotal,
              paidAmount: validated.paidAmount,
              remainingDebt: validated.grandTotal - validated.paidAmount,
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 Hari
              status: debtStatus,
              notes: `Utang dari penjualan ${invoiceNumber}`,
            },
          });
        }

        return newSale;
      },
      // Config Timeout: Beri waktu lebih (20 detik)
      { maxWait: 5000, timeout: 20000 }
    );

    // --- 5. Revalidate & Return ---
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
      message: `Transaksi ${invoiceNumber} berhasil disimpan`,
    };

  } catch (error) {
    console.error("Create sale error:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Gagal menyimpan transaksi" };
  }
}

// ==================== UPDATE SALE (EDIT TRANSAKSI) ====================
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

    // 2. Resolve Products & Units
    const productIds = validated.items.map((i) => i.productId);
    const oldProductIds = existingSale.saleItems.map(i => i.productId);
    const allProductIds = Array.from(new Set([...productIds, ...oldProductIds]));

    const products = await prisma.product.findMany({
      where: { id: { in: allProductIds } },
      select: {
        id: true,
        currentStock: true,
        name: true,
        code: true,
        productUnits: {
          select: { id: true, unitId: true },
        },
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));
    const productUnitToUnitMap = new Map<string, string>();
    for (const product of products) {
      for (const pu of product.productUnits) {
        productUnitToUnitMap.set(pu.id, pu.unitId);
      }
    }

    // Calculate diff for stock
    const stockDiff = new Map<string, number>(); 
    for (const oldItem of existingSale.saleItems) {
        stockDiff.set(oldItem.productId, (stockDiff.get(oldItem.productId) || 0) - oldItem.quantity);
    }
    for (const newItem of validated.items) {
        stockDiff.set(newItem.productId, (stockDiff.get(newItem.productId) || 0) + newItem.quantity);
    }

    // Verify stock availability
    for (const [pId, diffQty] of stockDiff.entries()) {
        if (diffQty > 0) {
            const product = productMap.get(pId);
            if (!product) return { success: false, error: `Produk tidak ditemukan` };
            if (Number(product.currentStock) < diffQty) {
                return { success: false, error: `Stock ${product.name} tidak mencukupi untuk penambahan.` };
            }
        }
    }

    // 3. Prepare new Sale Items
    const saleItemsData = validated.items.map((item) => {
      const unitId = productUnitToUnitMap.get(item.productUnitId);
      if (!unitId) throw new Error(`Master Satuan tidak ditemukan`);
      return {
        productId: item.productId,
        unitId: unitId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        subtotal: item.subtotal,
      };
    });

    // 4. TRANSACTION
    const updatedSale = await prisma.$transaction(async (tx) => {
        // A. Delete old Sale Items & Delivery Items
        await tx.saleItem.deleteMany({ where: { saleId } });
        if (existingSale.deliveryOrder) {
            await tx.deliveryItem.deleteMany({ where: { deliveryOrderId: existingSale.deliveryOrder.id } });
        }

        // B. Update Sale & Create new Sale Items
        const status = validated.paymentMethod === PaymentMethod.CREDIT
            ? (validated.paidAmount >= validated.grandTotal ? SaleStatus.COMPLETED : SaleStatus.PENDING)
            : SaleStatus.COMPLETED;

        const sale = await tx.sale.update({
            where: { id: saleId },
            data: {
                customerId: validated.customerId,
                totalAmount: validated.totalAmount,
                discount: validated.discount,
                tax: validated.tax,
                grandTotal: validated.grandTotal,
                paymentMethod: validated.paymentMethod,
                paidAmount: validated.paidAmount,
                changeAmount: validated.changeAmount,
                status,
                notes: validated.notes || existingSale.notes,
                saleItems: { create: saleItemsData }
            }
        });

        // C. Update Delivery Order Items if exists
        if (existingSale.deliveryOrder) {
            const deliveryItemsData = validated.items.map((item) => {
                const unitId = productUnitToUnitMap.get(item.productUnitId)!;
                return {
                    productId: item.productId,
                    unitId: unitId,
                    quantity: item.quantity,
                };
            });
            await tx.deliveryOrder.update({
                where: { id: existingSale.deliveryOrder.id },
                data: {
                    customerId: validated.customerId,
                    deliveryItems: { create: deliveryItemsData }
                }
            });
        }

        // D. Stock update & StockMovement Log
        for (const [pId, diffQty] of stockDiff.entries()) {
            if (diffQty !== 0) {
                await tx.product.update({
                    where: { id: pId },
                    data: { currentStock: { decrement: diffQty } } 
                });

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

        // E. Update Customer Debt
        if (validated.paymentMethod === PaymentMethod.CREDIT) {
            const remainingDebt = validated.grandTotal - validated.paidAmount;
            const debtStatus = remainingDebt <= 0 ? "PAID" : (validated.paidAmount > 0 ? "PARTIAL" : "UNPAID");
            
            if (existingSale.customerDebts && existingSale.customerDebts.length > 0) {
                await tx.customerDebt.update({
                    where: { id: existingSale.customerDebts[0].id },
                    data: {
                        customerId: validated.customerId,
                        totalDebt: validated.grandTotal,
                        paidAmount: validated.paidAmount,
                        remainingDebt,
                        status: debtStatus,
                    }
                });
            } else {
                const debtNumber = await generateDebtNumber(tx);
                await tx.customerDebt.create({
                    data: {
                        debtNumber,
                        saleId: sale.id,
                        customerId: validated.customerId,
                        totalDebt: validated.grandTotal,
                        paidAmount: validated.paidAmount,
                        remainingDebt,
                        status: debtStatus,
                        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        notes: `Utang dari edit penjualan ${existingSale.invoiceNumber}`
                    }
                });
            }
        } else {
            if (existingSale.customerDebts && existingSale.customerDebts.length > 0) {
                 await tx.customerDebt.update({
                    where: { id: existingSale.customerDebts[0].id },
                    data: {
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

// ==================== GET SALES ====================
export async function getSales(params?: SaleFilterInput) {
  try {
    const session = await auth();
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

// ==================== CANCEL SALE (ADMIN ONLY) ====================
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

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.sale.update({
        where: { id },
        data: {
          status: SaleStatus.CANCELLED,
          notes: `${sale.notes || ""}\n[CANCELLED] ${reason}`.trim(),
        },
      });

      // ✅ FIXED: sale.saleItems
      for (const item of sale.saleItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: {
              increment: item.quantity,
            },
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "IN",
            quantity: item.quantity,
            notes: `Pembatalan penjualan ${sale.invoiceNumber} - ${reason}`,
            referenceType: "Sale Cancellation",
            referenceId: sale.id,
            createdById: session.user.id,
          },
        });
      }

      // ✅ FIXED: Update debt using saleId
      if (sale.paymentMethod === PaymentMethod.CREDIT) {
        await tx.customerDebt.updateMany({
          where: {
            saleId: sale.id, // ✅ FIXED: Direct saleId
          },
          data: {
            remainingDebt: 0, // ✅ FIXED: remainingDebt
            status: "PAID",
            notes: `[CANCELLED] ${reason}`, // ✅ FIXED: notes
          },
        });
      }
    });

    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard/sales");

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

// ==================== GET SALES STATISTICS ====================
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
export async function getSaleById(saleId: string) {
  const session = await auth();
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

// ==================== GET SALES FOR TABLE ====================
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

// ==================== GET TODAY STATS ====================
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
// ==================== DELETE SALE ====================
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
      include: { saleItems: true },
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

    // Soft delete (Tutup Buku): update status to CANCELLED and restore stock/debt
    await prisma.$transaction(async (tx) => {
      // 1. Update sale status to CANCELLED
      await tx.sale.update({
        where: { id },
        data: {
          status: SaleStatus.CANCELLED,
          notes: `${sale.notes || ""}\n[DIHAPUS] Dihapus oleh Admin via Konfirmasi Password.`.trim(),
        },
      });

      // 2. Restore stock for each item
      for (const item of sale.saleItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: {
              increment: item.quantity,
            },
          },
        });

        // 3. Create stock movement log
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "IN",
            quantity: item.quantity,
            notes: `Pembatalan/Penghapusan Transaksi ${sale.invoiceNumber}`,
            referenceType: "Sale Cancellation",
            referenceId: sale.id,
            createdById: session.user.id,
          },
        });
      }

      // 4. Update customer debt if credit
      if (sale.paymentMethod === PaymentMethod.CREDIT) {
        await tx.customerDebt.updateMany({
          where: {
            saleId: sale.id,
          },
          data: {
            remainingDebt: 0,
            status: "PAID", // Mark as settled/reverted
            notes: `[CANCELLED/DIHAPUS] Transaksi dihapus`,
          },
        });
      }
    });

    revalidatePath("/dashboard/sales");

    return {
      success: true,
      message: `Penjualan ${sale.invoiceNumber} berhasil dibatalkan (Tutup Buku)`,
    };
  } catch (error) {
    console.error("Delete sale error:", error);
    return { success: false, error: "Gagal memproses penghapusan penjualan" };
  }
}
