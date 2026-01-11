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
            status: SaleStatus.COMPLETED,
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
            },
          });
        }

        // 3. Create customer debt if CREDIT
        if (validated.paymentMethod === PaymentMethod.CREDIT) {
          const debtNumber = await generateDebtNumber(tx);

          await tx.customerDebt.create({
            data: {
              debtNumber, // ✅ FIXED: Added debtNumber
              saleId: newSale.id, // ✅ FIXED: Direct relation to Sale
              customerId: validated.customerId,
              totalDebt: validated.grandTotal, // ✅ FIXED: totalDebt instead of amount
              remainingDebt: validated.grandTotal, // ✅ FIXED: remainingDebt
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              notes: `Utang dari penjualan ${invoiceNumber}`, // ✅ FIXED: notes instead of description
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
        },
      }),
      prisma.sale.count({ where }),
    ]);

    return {
      success: true,
      data: sales,
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
           unit: { // ✅ FIXED: unit instead of productUnit
              select: {
                name: true,
              },
            },
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
      ...sale,
      totalAmount: parseFloat(sale.totalAmount.toString()),
      discount: parseFloat(sale.discount.toString()),
      tax: parseFloat(sale.tax.toString()),
      grandTotal: parseFloat(sale.grandTotal.toString()),
      paidAmount: parseFloat(sale.paidAmount.toString()),
      changeAmount: parseFloat(sale.changeAmount.toString()),
      saleItems: sale.saleItems.map((item) => ({
        ...item,
        unitPrice: parseFloat(item.unitPrice.toString()),
        discount: parseFloat(item.discount.toString()),
        subtotal: parseFloat(item.subtotal.toString()),
      })),
    };

    return {
      success: true,
      data: serializedSale,
    };
  } catch (error) {
    console.error("Get sale error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal mengambil data invoice",
    };
  }
}