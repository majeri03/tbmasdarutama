"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateSearchQuery } from "@/lib/utils/pos-helpers";
import { PaymentMethod, Prisma, SaleStatus } from "@prisma/client";
import { requirePermission } from "../utils/role";
import { CreateSaleInput, createSaleSchema } from "../validations/sale.schema";
import { revalidatePath } from "next/cache";

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
// ==================== 4. CREATE POS TRANSACTION (OPTIMIZED & FAST) ====================
// Fungsi ini dikhususkan untuk POS agar cepat dan return datanya siap untuk Invoice
export async function createPosTransaction(data: CreateSaleInput) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    requirePermission(session, "ACCESS_POS");

    const validated = createSaleSchema.parse(data);

    // A. Validasi Stok Cepat (Tanpa Transaction dulu)
    const productIds = validated.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, currentStock: true, name: true }
    });
    
    for (const item of validated.items) {
        const product = products.find(p => p.id === item.productId);
        if (!product || (Number(product.currentStock) < item.quantity)) {
            return { success: false, error: `Stok ${product?.name || 'Produk'} tidak cukup.` };
        }
    }

    // B. Generate Invoice Helper
    const generateInvoiceNumber = async (tx: Prisma.TransactionClient) => {
        const date = new Date();
        const prefix = `INV/${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
        const lastSale = await tx.sale.findFirst({
            where: { invoiceNumber: { startsWith: prefix } },
            orderBy: { invoiceNumber: 'desc' },
            select: { invoiceNumber: true }
        });
        const nextNum = lastSale ? parseInt(lastSale.invoiceNumber.split('-').pop() || '0') + 1 : 1;
        return `${prefix}-${String(nextNum).padStart(4, '0')}`;
    };

    // C. DATABASE TRANSACTION
    const sale = await prisma.$transaction(async (tx) => {
        const invoiceNumber = await generateInvoiceNumber(tx);

        // 1. Create Sale + Items (Nested Write)
        const newSale = await tx.sale.create({
            data: {
                invoiceNumber,
                customerId: validated.customerId,
                cashierId: session.user.id,
                totalAmount: validated.totalAmount,
                discount: validated.discount,
                tax: validated.tax,
                grandTotal: validated.grandTotal,
                paymentMethod: validated.paymentMethod,
                paidAmount: validated.paidAmount,
                changeAmount: validated.changeAmount,
                status: (validated.paymentMethod === PaymentMethod.CREDIT && validated.paidAmount < validated.grandTotal) 
                    ? SaleStatus.PENDING 
                    : SaleStatus.COMPLETED,
                notes: "POS Transaction",
                saleItems: {
                    create: validated.items.map(item => ({
                        productId: item.productId,
                        unitId: item.productUnitId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        discount: item.discount,
                        subtotal: item.subtotal
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

        // 2. Update Stock (Parallel Promise)
        await Promise.all(validated.items.map(async (item) => {
             // Kurangi Stok
             await tx.product.update({
                 where: { id: item.productId },
                 data: { currentStock: { decrement: item.quantity } }
             });
             // Catat Log
             await tx.stockMovement.create({
                 data: {
                     productId: item.productId,
                     type: "OUT",
                     quantity: item.quantity,
                     referenceType: "POS_SALE",
                     referenceId: newSale.id,
                     createdById: session.user.id,
                     notes: `POS ${invoiceNumber}`
                 }
             });
        }));

        // 3. Handle Debt (Jika Kredit)
        if (validated.paymentMethod === PaymentMethod.CREDIT) {
             await tx.customerDebt.create({
                 data: {
                     debtNumber: `DEBT-${Date.now()}`,
                     saleId: newSale.id,
                     customerId: validated.customerId,
                     totalDebt: validated.grandTotal,
                     paidAmount: validated.paidAmount,
                     remainingDebt: validated.grandTotal - validated.paidAmount,
                     dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                     status: "UNPAID",
                     notes: "POS Credit"
                 }
             });
        }

        return newSale;
    }, { timeout: 15000 }); // Timeout 15s

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
    return { success: false, error: "Gagal memproses transaksi" };
  }
}