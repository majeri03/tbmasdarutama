"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  createSaleSchema,
  saleFilterSchema,
  type CreateSaleInput,
  type SaleFilterInput,
} from "@/lib/validations/sale.schema";
import { revalidatePath } from "next/cache";
import { PaymentMethod, SaleStatus, Prisma } from "@prisma/client";
import { SaleFilters } from "@/types/sale";

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

// ==================== CREATE SALE ====================
export async function createSale(data: CreateSaleInput) {
  try {
    const session = await auth();
    console.log("📌 DEBUG Session:", {
      hasSession: !!session,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
    }); // ✅ Add debug log
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized. Please login first.",
      };
    }
    const cashier = await prisma.user.findUnique({
      where: { email: session.user.email }, // ✅ Changed from id to email
      select: { id: true, name: true, role: true, email: true },
    });
    console.log("📌 DEBUG Cashier:", cashier);
    if (!cashier) {
      return {
        success: false,
        error: "User tidak ditemukan di database",
      };
    }
    const validated = createSaleSchema.parse(data);
    const invoiceNumber = await generateInvoiceNumber();

    // Validasi stock
    for (const item of validated.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { currentStock: true, name: true, code: true },
      });

      if (!product) {
        return {
          success: false,
          error: `Produk tidak ditemukan`,
        };
      }

      if (product.currentStock < item.quantity) {
        return {
          success: false,
          error: `Stock ${product.name} (${product.code}) tidak mencukupi. Tersedia: ${product.currentStock}, Diminta: ${item.quantity}`,
        };
      }
    }

    const sale = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // 1. Create Sale
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
          },
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
          },
        });

        // 2. Create Sale Items & Update Stock
        for (const item of validated.items) {
          await tx.saleItem.create({
            data: {
              saleId: newSale.id,
              productId: item.productId,
              unitId: item.productUnitId, // ✅ FIXED: unitId instead of productUnitId
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              subtotal: item.subtotal,
            },
          });

          await tx.product.update({
            where: { id: item.productId },
            data: {
              currentStock: {
                decrement: item.quantity,
              },
            },
          });

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
        }

        // 3. Create customer debt if CREDIT
        if (validated.paymentMethod === PaymentMethod.CREDIT) {
          const debtNumber = await generateDebtNumber(tx);

          await tx.customerDebt.create({
            data: {
              debtNumber,
              saleId: newSale.id,
              customerId: validated.customerId,
              totalDebt: validated.grandTotal,
              paidAmount: validated.paidAmount, // ✅ TAMBAH INI
              remainingDebt: validated.grandTotal - validated.paidAmount, // ✅ FIX INI
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              status:
                validated.paidAmount >= validated.grandTotal
                  ? "PAID"
                  : "UNPAID", // ✅ TAMBAH INI
              notes: `Utang dari penjualan ${invoiceNumber}`,
            },
          });
        }

        return newSale;
      }
    );

    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard/sales");
    const serializedSale = {
      ...sale,
      totalAmount: parseFloat(sale.totalAmount.toString()),
      discount: parseFloat(sale.discount.toString()),
      tax: parseFloat(sale.tax.toString()),
      grandTotal: parseFloat(sale.grandTotal.toString()),
      paidAmount: parseFloat(sale.paidAmount.toString()),
      changeAmount: parseFloat(sale.changeAmount.toString()),
    };
    return {
      success: true,
      data: serializedSale,
      message: `Transaksi ${invoiceNumber} berhasil disimpan`,
    };
  } catch (error) {
    console.error("Create sale error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Gagal menyimpan transaksi",
    };
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
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
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
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

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
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

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
export async function deleteSale(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { saleItems: true },
    });

    if (!sale) {
      return { success: false, error: "Penjualan tidak ditemukan" };
    }

    if (sale.status !== SaleStatus.PENDING) {
      return {
        success: false,
        error: "Hanya penjualan PENDING yang bisa dihapus",
      };
    }

    // Delete sale (cascade will delete saleItems)
    await prisma.sale.delete({ where: { id } });

    revalidatePath("/dashboard/sales");

    return {
      success: true,
      message: `Penjualan ${sale.invoiceNumber} berhasil dihapus`,
    };
  } catch (error) {
    console.error("Delete sale error:", error);
    return { success: false, error: "Gagal menghapus penjualan" };
  }
}
