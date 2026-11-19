"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  createPurchaseSchema,
  updatePurchaseSchema,
  receivePurchaseSchema,
  type CreatePurchaseInput,
  type UpdatePurchaseInput,
  type ReceivePurchaseInput,
} from "@/lib/validations/purchase.schema";
import { Prisma, PurchaseStatus, MovementType } from "@prisma/client";
import { requirePermission, type AuthSession } from "../utils/role";
import {
  loadUnitNames,
  primaryQuantityOrThrow,
  withUniqueRetry,
} from "@/lib/utils/stock-units";

//    GENERATE PO NUMBER   
async function generatePONumber(): Promise<string> {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const datePrefix = `${year}${month}${day}`;

  const lastPO = await prisma.purchase.findFirst({
    where: {
      poNumber: {
        startsWith: `PO-${datePrefix}`,
      },
    },
    orderBy: {
      poNumber: "desc",
    },
  });

  let sequence = 1;
  if (lastPO) {
    const lastSequence = parseInt(lastPO.poNumber.split("-").pop() || "0");
    sequence = lastSequence + 1;
  }

  return `PO-${datePrefix}-${String(sequence).padStart(3, "0")}`;
}

//    CREATE PURCHASE   
export async function createPurchase(input: CreatePurchaseInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    if (session.user.role === "KASIR") {
      return {
        success: false,
        error: "Kasir tidak memiliki akses untuk membuat PO",
      };
    }
    requirePermission(session, "CREATE_PURCHASE");
    const validated = createPurchaseSchema.parse(input);

    // FIX QA (M-1/M-17): hitung ulang aritmetika dari harga & diskon per item
    // (subtotal tidak lagi dipercaya mentah dari klien), tolak bayar lebih.
    const recomputedItems = validated.items.map((item) => {
      const gross = item.quantity * item.unitPrice;
      const discount = Math.min(Math.max(item.discount ?? 0, 0), gross);
      return { ...item, discount, subtotal: gross - discount };
    });
    const totalAmount = recomputedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const totalDiscount = Math.min(Math.max(validated.discount, 0), totalAmount);
    const tax = Math.max(validated.tax, 0);
    const grandTotal = totalAmount - totalDiscount + tax;
    if (validated.paidAmount > grandTotal) {
      return { success: false, error: "Jumlah bayar melebihi total PO." };
    }

    // Nomor PO dibuat fresh setiap percobaan (M-2 — tabrakan nomor diulang).
    const purchase = await withUniqueRetry(async () => {
      const poNumber = await generatePONumber();

      // Create purchase with items
      return prisma.$transaction(async (tx) => {
      const newPurchase = await tx.purchase.create({
        data: {
          poNumber,
          supplierId: validated.supplierId,
          adminId: session.user.id,
          purchaseDate: validated.purchaseDate,
          totalAmount,
          discount: totalDiscount,
          tax,
          grandTotal,
          paidAmount: validated.paidAmount,
          paymentMethod: validated.paymentMethod,
          notes: validated.notes,
          status: PurchaseStatus.PENDING,
          purchaseItems: {
            create: recomputedItems.map((item) => ({
              productId: item.productId,
              unitId: item.unitId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              subtotal: item.subtotal,
            })),
          },
        },
        include: {
          supplier: true,
          purchaseItems: {
            include: {
              product: true,
              unit: true,
            },
          },
        },
      });

      // If there's debt (paidAmount < grandTotal), create supplier debt
      if (validated.paidAmount < grandTotal) {
        const remainingDebt = grandTotal - validated.paidAmount;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30); // 30 days from now

        await tx.supplierDebt.create({
          data: {
            debtNumber: `DEBT-SUPP-${poNumber}`,
            purchaseId: newPurchase.id,
            supplierId: validated.supplierId,
            totalDebt: grandTotal,
            paidAmount: validated.paidAmount,
            remainingDebt,
            dueDate,
            status: validated.paidAmount > 0 ? "PARTIAL" : "UNPAID",
          },
        });
      }

      return newPurchase;
      });
    });

    revalidatePath("/dashboard/purchases");
    revalidatePath("/dashboard/stocks");

    return {
      success: true,
      message: `Purchase Order ${poNumber} berhasil dibuat`,
      data: {
        ...purchase,
        totalAmount: Number(purchase.totalAmount),
        discount: Number(purchase.discount),
        tax: Number(purchase.tax),
        grandTotal: Number(purchase.grandTotal),
        paidAmount: Number(purchase.paidAmount),
        purchaseItems: purchase.purchaseItems.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount),
          subtotal: Number(item.subtotal),
        })),
      },
    };
  } catch (error) {
    console.error("Error creating purchase:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Gagal membuat Purchase Order" };
  }
}

//    GET ALL PURCHASES   
export async function getAllPurchases(
  filters?: {
    search?: string;
    supplierId?: string;
    status?: PurchaseStatus;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
  },
  externalSession?: AuthSession | null
) {
  const session = externalSession || (await auth());
  requirePermission(session, "VIEW_PURCHASES");
  try {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseWhereInput = {};

    if (filters?.search) {
      where.OR = [
        { poNumber: { contains: filters.search, mode: "insensitive" } },
        {
          supplier: { name: { contains: filters.search, mode: "insensitive" } },
        },
      ];
    }

    if (filters?.supplierId) {
      where.supplierId = filters.supplierId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.purchaseDate = {};
      if (filters.dateFrom) where.purchaseDate.gte = filters.dateFrom;
      if (filters.dateTo) where.purchaseDate.lte = filters.dateTo;
    }

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        include: {
          supplier: {
            select: {
              id: true,
              code: true,
              name: true,
              phone: true,
              address: true,
            },
          },
          admin: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          purchaseItems: {
            include: {
              product: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
              unit: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              purchaseItems: true,
            },
          },
        },
        orderBy: { purchaseDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.purchase.count({ where }),
    ]);

    // ✅ Convert Decimal to number for client components
    const serializedPurchases = purchases.map((purchase) => ({
      ...purchase,
      totalAmount: Number(purchase.totalAmount),
      discount: Number(purchase.discount),
      tax: Number(purchase.tax),
      grandTotal: Number(purchase.grandTotal),
      paidAmount: Number(purchase.paidAmount),
      purchaseItems: purchase.purchaseItems.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        subtotal: Number(item.subtotal),
      })),
    }));

    return {
      success: true,
      data: serializedPurchases,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("Error fetching purchases:", error);
    return { success: false, error: "Gagal mengambil data purchase" };
  }
}

//    GET PURCHASE BY ID   
export async function getPurchaseById(id: string, externalSession?: AuthSession | null) {
  const session = externalSession || (await auth());
  requirePermission(session, "VIEW_PURCHASES");
  try {
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        purchaseItems: {
          include: {
            product: {
              select: {
                id: true,
                code: true,
                name: true,
                barcode: true,
              },
            },
            unit: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        supplierDebts: true,
      },
    });

    if (!purchase) {
      return { success: false, error: "Purchase Order tidak ditemukan" };
    }

    return {
      success: true,
      data: {
        ...purchase,
        totalAmount: Number(purchase.totalAmount),
        discount: Number(purchase.discount),
        tax: Number(purchase.tax),
        grandTotal: Number(purchase.grandTotal),
        paidAmount: Number(purchase.paidAmount),
        purchaseItems: purchase.purchaseItems.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount),
          subtotal: Number(item.subtotal),
        })),
      },
    };
  } catch (error) {
    console.error("Error fetching purchase:", error);
    return { success: false, error: "Gagal mengambil data purchase" };
  }
}

//    RECEIVE PURCHASE (UPDATE STOCK)   
export async function receivePurchase(input: ReceivePurchaseInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    if (session.user.role === "KASIR") {
      return {
        success: false,
        error: "Kasir tidak memiliki akses untuk receive barang",
      };
    }
    requirePermission(session, "RECEIVE_PURCHASE");
    const validated = receivePurchaseSchema.parse(input);

    // Get purchase with items
    const purchase = await prisma.purchase.findUnique({
      where: { id: validated.id },
      include: {
        purchaseItems: {
          include: {
            product: true,
            unit: true,
          },
        },
      },
    });

    if (!purchase) {
      return { success: false, error: "Purchase Order tidak ditemukan" };
    }

    if (purchase.status === PurchaseStatus.RECEIVED) {
      return { success: false, error: "Purchase Order sudah diterima" };
    }

    // FIX QA (M-19): klaim status di DALAM transaksi — dua klik "Terima"
    // bersamaan tidak bisa sama-sama masuk. (B-1): konversi DIBAGI ke
    // satuan utama, harus bulat, diagregasi per produk.
    const unitNames = await loadUnitNames();
    const receivePlan: Array<{ productId: string; qtyPrimary: number; productName: string }> = [];
    {
      const addByProduct = new Map<string, number>();
      for (const item of purchase.purchaseItems) {
        const productUnit = await prisma.productUnit.findFirst({
          where: { productId: item.productId, unitId: item.unitId },
        });
        if (!productUnit) {
          throw new Error(`Satuan untuk ${item.product?.name || "produk"} tidak ditemukan di master.`);
        }
        let qtyPrimary: number;
        try {
          qtyPrimary = primaryQuantityOrThrow({
            quantity: item.quantity,
            conversionValue: Number(productUnit.conversionValue),
            productName: item.product?.name || "Produk",
            unitName: unitNames.get(item.unitId) || "satuan",
          });
        } catch (e) {
          return { success: false, error: e instanceof Error ? e.message : "Item tidak valid." };
        }
        addByProduct.set(item.productId, (addByProduct.get(item.productId) || 0) + qtyPrimary);
      }
      for (const [productId, qtyPrimary] of addByProduct.entries()) {
        const product = purchase.purchaseItems.find((i) => i.productId === productId)?.product;
        receivePlan.push({ productId, qtyPrimary, productName: product?.name || "Produk" });
      }
    }

    // Update purchase and stock in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Klaim dulu: hanya 1 yang berhasil kalau dipanggil bersamaan.
      const claimed = await tx.purchase.updateMany({
        where: { id: validated.id, status: { not: PurchaseStatus.RECEIVED } },
        data: {
          status: PurchaseStatus.RECEIVED,
          receivedDate: validated.receivedDate,
        },
      });
      if (claimed.count === 0) {
        throw new Error("Purchase Order sudah diterima atau tidak ditemukan");
      }
      const updatedPurchase = await tx.purchase.findUniqueOrThrow({
        where: { id: validated.id },
      });

      // Update stock for each product (agregat, satuan utama)
      for (const plan of receivePlan) {
        await tx.product.update({
          where: { id: plan.productId },
          data: {
            currentStock: {
              increment: plan.qtyPrimary,
            },
          },
        });

        // Create stock movement
        await tx.stockMovement.create({
          data: {
            productId: plan.productId,
            type: MovementType.IN,
            quantity: plan.qtyPrimary,
            referenceType: "Purchase",
            referenceId: purchase.poNumber,
            notes: `Receive from PO: ${purchase.poNumber}`,
            createdById: session.user.id,
          },
        });
      }

      return updatedPurchase;
    });

    revalidatePath("/dashboard/purchases");
    revalidatePath("/dashboard/stocks");
    revalidatePath("/dashboard/products");

    return {
      success: true,
      message: `Purchase Order ${purchase.poNumber} berhasil diterima`,
      data: {
        ...result,
        totalAmount: Number(result.totalAmount),
        discount: Number(result.discount),
        tax: Number(result.tax),
        grandTotal: Number(result.grandTotal),
        paidAmount: Number(result.paidAmount),
      },
    };
  } catch (error) {
    console.error("Error receiving purchase:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Gagal menerima Purchase Order" };
  }
}

//    UPDATE PURCHASE   
export async function updatePurchase(input: UpdatePurchaseInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    if (session.user.role === "KASIR") {
      return {
        success: false,
        error: "Kasir tidak memiliki akses untuk update PO",
      };
    }
    requirePermission(session, "EDIT_PURCHASE");
    const validated = updatePurchaseSchema.parse(input);

    // Check if purchase can be updated
    const existingPurchase = await prisma.purchase.findUnique({
      where: { id: validated.id },
    });

    if (!existingPurchase) {
      return { success: false, error: "Purchase Order tidak ditemukan" };
    }

    if (existingPurchase.status === PurchaseStatus.RECEIVED) {
      return {
        success: false,
        error: "Purchase Order yang sudah diterima tidak dapat diubah",
      };
    }

    // FIX QA (M-1/M-17): hitung ulang aritmetika; tolak bayar lebih.
    const recomputedItems = validated.items.map((item) => {
      const gross = item.quantity * item.unitPrice;
      const discount = Math.min(Math.max(item.discount ?? 0, 0), gross);
      return { ...item, discount, subtotal: gross - discount };
    });
    const totalAmount = recomputedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const totalDiscount = Math.min(Math.max(validated.discount, 0), totalAmount);
    const tax = Math.max(validated.tax, 0);
    const grandTotal = totalAmount - totalDiscount + tax;
    if (validated.paidAmount > grandTotal) {
      return { success: false, error: "Jumlah bayar melebihi total PO." };
    }

    // Cicilan hutang supplier yang sudah dibayar dipertahankan (M-3/M-17):
    // totalDebt = grandTotal (bukan sisa), paidAmount tidak ditimpa form.
    const existingDebt = await prisma.supplierDebt.findFirst({
      where: { purchaseId: validated.id },
    });
    const preservedPaid = existingDebt ? Number(existingDebt.paidAmount) : 0;
    if (preservedPaid > grandTotal) {
      return { success: false, error: `Total baru (Rp ${grandTotal.toLocaleString("id-ID")}) lebih kecil dari yang sudah dibayar ke supplier (Rp ${preservedPaid.toLocaleString("id-ID")}).` };
    }
    const effectivePaid = existingDebt ? preservedPaid : validated.paidAmount;

    // Update purchase
    const purchase = await prisma.$transaction(async (tx) => {
      await tx.purchaseItem.deleteMany({
        where: { purchaseId: validated.id },
      });

      // Update purchase with new items
      const updatedPurchase = await tx.purchase.update({
        where: { id: validated.id },
        data: {
          supplierId: validated.supplierId,
          purchaseDate: validated.purchaseDate,
          totalAmount,
          discount: totalDiscount,
          tax,
          grandTotal,
          paidAmount: effectivePaid,
          paymentMethod: validated.paymentMethod,
          notes: validated.notes,
          purchaseItems: {
            create: recomputedItems.map((item) => ({
              productId: item.productId,
              unitId: item.unitId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              subtotal: item.subtotal,
            })),
          },
        },
        include: {
          supplier: true,
          purchaseItems: {
            include: {
              product: true,
              unit: true,
            },
          },
        },
      });

      // Update supplier debt if exists (M-17): totalDebt = grandTotal,
      // paidAmount dipertahankan, remaining = grandTotal - paid.
      const debt = existingDebt;
      if (debt) {
        const remainingDebt = grandTotal - preservedPaid;
        await tx.supplierDebt.update({
          where: { id: debt.id },
          data: {
            totalDebt: grandTotal,
            paidAmount: preservedPaid,
            remainingDebt,
            status: remainingDebt <= 0 ? "PAID" : preservedPaid > 0 ? "PARTIAL" : "UNPAID",
          },
        });
      } else if (validated.paidAmount < grandTotal) {
        const remainingDebt = grandTotal - validated.paidAmount;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        await tx.supplierDebt.create({
          data: {
            debtNumber: `DEBT-SUPP-${existingPurchase.poNumber}`,
            purchaseId: validated.id,
            supplierId: validated.supplierId,
            totalDebt: grandTotal,
            paidAmount: validated.paidAmount,
            remainingDebt,
            dueDate,
            status: validated.paidAmount > 0 ? "PARTIAL" : "UNPAID",
          },
        });
      }

      return updatedPurchase;
    });

    revalidatePath("/dashboard/purchases");

    return {
      success: true,
      message: `Purchase Order ${purchase.poNumber} berhasil diupdate`,
      data: {
        ...purchase,
        totalAmount: Number(purchase.totalAmount),
        discount: Number(purchase.discount),
        tax: Number(purchase.tax),
        grandTotal: Number(purchase.grandTotal),
        paidAmount: Number(purchase.paidAmount),
        purchaseItems: purchase.purchaseItems.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount),
          subtotal: Number(item.subtotal),
        })),
      },
    };
  } catch (error) {
    console.error("Error updating purchase:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Gagal update Purchase Order" };
  }
}

//    DELETE PURCHASE   
export async function deletePurchase(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    if (session.user.role === "KASIR") {
      return {
        success: false,
        error: "Kasir tidak memiliki akses untuk hapus PO",
      };
    }
    requirePermission(session, "DELETE_PURCHASE");
    // Check if purchase exists
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            purchaseItems: true,
          },
        },
      },
    });

    if (!purchase) {
      return { success: false, error: "Purchase Order tidak ditemukan" };
    }

    // Check if purchase can be deleted (only PENDING status)
    if (purchase.status === PurchaseStatus.RECEIVED) {
      return {
        success: false,
        error: "Purchase Order yang sudah diterima tidak dapat dihapus",
      };
    }

    //Delete in transaction with proper order
    await prisma.$transaction(async (tx) => {
      // 1. Delete supplier debts first (foreign key constraint)
      await tx.supplierDebt.deleteMany({
        where: { purchaseId: id },
      });

      // 2. Delete purchase items
      await tx.purchaseItem.deleteMany({
        where: { purchaseId: id },
      });

      // 3. Finally delete the purchase
      await tx.purchase.delete({
        where: { id },
      });
    });

    revalidatePath("/dashboard/purchases");
    revalidatePath("/dashboard/stocks");

    return {
      success: true,
      message: `Purchase Order ${purchase.poNumber} berhasil dihapus`,
    };
  } catch (error) {
    console.error("Error deleting purchase:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Gagal menghapus Purchase Order" };
  }
}

//    GET PURCHASE STATISTICS   
export async function getPurchaseStatistics() {
  const session = await auth();
  requirePermission(session, "VIEW_PURCHASES");
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [totalPurchases, pendingCount, totalThisMonth, totalValue] =
      await Promise.all([
        prisma.purchase.count(),
        prisma.purchase.count({
          where: { status: PurchaseStatus.PENDING },
        }),
        prisma.purchase.count({
          where: { purchaseDate: { gte: firstDayOfMonth } },
        }),
        prisma.purchase.aggregate({
          _sum: { grandTotal: true },
          where: { purchaseDate: { gte: firstDayOfMonth } },
        }),
      ]);

    return {
      success: true,
      data: {
        totalPurchases,
        pendingCount,
        totalThisMonth,
        totalValue: Number(totalValue._sum.grandTotal || 0), // ✅ ADD Number()
      },
    };
  } catch (error) {
    console.error("Error fetching purchase statistics:", error);
    return { success: false, error: "Gagal mengambil statistik purchase" };
  }
}
