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

// FIX (25 Nov 2026, ws-j2 item 139): prefiks tanggal nomor dokumen memakai
// WITA (Asia/Makassar, UTC+8), bukan tanggal lokal server. Server Vercel
// berjalan di UTC, jadi dokumen yang dibuat 25 Nov pukul 00:xx-07:59 WITA
// sebelumnya mendapat nomor berprefiks 24 Nov. Nomor yang sudah terbit
// tidak diubah — hanya nomor baru yang memakai tanggal WITA.
function getWitaDatePrefix(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${value("year")}${value("month")}${value("day")}`;
}

//    GENERATE PO NUMBER
async function generatePONumber(): Promise<string> {
  const datePrefix = getWitaDatePrefix();

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

// FIX PENTEST (22 Nov 2026, L24): pesan error mentah Prisma/Zod tidak boleh
// diteruskan ke klien (membocorkan nama constraint/kolom/skema). Pesan
// bisnis yang ditulis manual di action tetap boleh tampil.
function toClientError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.name === "ZodError") return "Data tidak valid.";
  if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientValidationError
  ) {
    return fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

// FIX PENTEST (22 Nov 2026, M25): supplier/produk/unit harus ada, aktif,
// dan produk belum dihapus — sebelumnya hanya mengandalkan FK Prisma
// (produk soft-deleted/nonaktif dan supplier nonaktif bisa lolos).
async function validatePurchaseReferences(
  supplierId: string,
  items: Array<{ productId: string; unitId: string }>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true, isActive: true },
  });
  if (!supplier) return { ok: false, error: "Supplier tidak ditemukan" };
  if (!supplier.isActive) return { ok: false, error: "Supplier sudah nonaktif" };

  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.productId}::${item.unitId}`;
    if (seen.has(key)) {
      return { ok: false, error: "Produk dengan satuan yang sama tidak boleh duplikat dalam satu PO" };
    }
    seen.add(key);
  }

  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const unitIds = Array.from(new Set(items.map((i) => i.unitId)));
  const [products, units, productUnits] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, isActive: true, deletedAt: true },
    }),
    prisma.unit.findMany({ where: { id: { in: unitIds } }, select: { id: true } }),
    prisma.productUnit.findMany({
      where: { productId: { in: productIds } },
      select: { productId: true, unitId: true },
    }),
  ]);
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) return { ok: false, error: `Produk tidak ditemukan: ${item.productId}` };
    if (!product.isActive || product.deletedAt) {
      return { ok: false, error: `Produk ${product.name} sudah nonaktif/dihapus` };
    }
    if (!units.some((u) => u.id === item.unitId)) {
      return { ok: false, error: `Satuan tidak ditemukan: ${item.unitId}` };
    }
    if (!productUnits.some((pu) => pu.productId === item.productId && pu.unitId === item.unitId)) {
      return { ok: false, error: `Satuan tidak valid untuk produk: ${product.name}` };
    }
  }
  return { ok: true };
}

//    GET PRODUCTS FOR PO (Item 108, WS-G, 25 Nov 2026)
// Daftar produk untuk form buat/edit PO. SENGAJA bukan getPOSProducts:
// getPOSProducts memfilter `currentStock > 0` (benar untuk POS — barang
// habis tidak bisa dijual), tapi form PO justru dipakai untuk me-restock
// produk yang habis, sehingga produk berstok 0 (mis. TEST-Import-1, Cat
// Avian) tidak pernah muncul dan baru bisa dipilih setelah adjustment +1.
// Fungsi ini TIDAK memfilter stok sama sekali — hanya produk aktif dan
// belum di-soft-delete. Tanpa `take` karena form PO memfilter di sisi
// klien dari daftar yang dimuat (batas 20 akan menyembunyikan produk
// secara alfabetis). getPOSProducts di pos.actions.ts TIDAK diubah:
// filter stok > 0 di sana tetap benar untuk POS.
export async function getPurchaseProducts() {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }
    requirePermission(session, "VIEW_PURCHASES");

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
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

    // Convert Decimal to number before sending to client
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
    console.error("Get purchase products error:", error);
    return {
      success: false,
      error: "Gagal mengambil data produk",
    };
  }
}

//    CREATE PURCHASE   
export async function createPurchase(input: CreatePurchaseInput, externalSession?: AuthSession | null) {
  try {
    // FIX PENTEST (22 Nov 2026, M18): sesi dari route (Bearer mobile).
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    // FIX BUILD (22 Nov 2026, z3): id disimpan ke const di sini — di dalam
    // callback transaksi, TypeScript melupakan hasil cek session.user di
    // atas, jadi pemakaian session.user.id langsung selalu error.
    const userId = session.user.id;

    if (session.user.role === "KASIR") {
      return {
        success: false,
        error: "Kasir tidak memiliki akses untuk membuat PO",
      };
    }
    requirePermission(session, "CREATE_PURCHASE");
    const validated = createPurchaseSchema.parse(input);

    // FIX PENTEST (22 Nov 2026, M25): validasi referensi supplier/produk/unit.
    const refCheck = await validatePurchaseReferences(validated.supplierId, validated.items);
    if (!refCheck.ok) return { success: false, error: refCheck.error };

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
          adminId: userId,
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
      message: `Purchase Order ${purchase.poNumber} berhasil dibuat`,
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
    return { success: false, error: toClientError(error, "Gagal membuat Purchase Order") };
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
  try {
    // FIX PENTEST (22 Nov 2026, L27): requirePermission dipindah ke DALAM
    // try supaya kegagalan auth tidak lolos sebagai 500 generik.
    requirePermission(session, "VIEW_PURCHASES");
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
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Gagal mengambil data purchase" };
  }
}

//    GET PURCHASE BY ID   
export async function getPurchaseById(id: string, externalSession?: AuthSession | null) {
  const session = externalSession || (await auth());
  try {
    // FIX PENTEST (22 Nov 2026, L27): requirePermission dipindah ke DALAM
    // try supaya kegagalan auth tidak lolos sebagai 500 generik.
    requirePermission(session, "VIEW_PURCHASES");
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
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Gagal mengambil data purchase" };
  }
}

//    RECEIVE PURCHASE (UPDATE STOCK)   
export async function receivePurchase(input: ReceivePurchaseInput, externalSession?: AuthSession | null) {
  try {
    // FIX PENTEST (22 Nov 2026, M18): sesi dari route (Bearer mobile).
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    // FIX BUILD (22 Nov 2026, z3): id disimpan ke const di sini — di dalam
    // callback transaksi, TypeScript melupakan hasil cek session.user di
    // atas, jadi pemakaian session.user.id langsung selalu error.
    const userId = session.user.id;

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
            createdById: userId,
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
    return { success: false, error: toClientError(error, "Gagal menerima Purchase Order") };
  }
}

//    UPDATE PURCHASE   
export async function updatePurchase(input: UpdatePurchaseInput, externalSession?: AuthSession | null) {
  try {
    // FIX PENTEST (22 Nov 2026, M18): sesi dari route (Bearer mobile).
    const session = externalSession || (await auth());
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

    // FIX PENTEST (22 Nov 2026, M25): validasi referensi (sama seperti create).
    const refCheckUpdate = await validatePurchaseReferences(validated.supplierId, validated.items);
    if (!refCheckUpdate.ok) return { success: false, error: refCheckUpdate.error };

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
    return { success: false, error: toClientError(error, "Gagal update Purchase Order") };
  }
}

//    DELETE PURCHASE   
export async function deletePurchase(id: string, externalSession?: AuthSession | null) {
  try {
    // FIX PENTEST (22 Nov 2026, M18): sesi dari route (Bearer mobile).
    const session = externalSession || (await auth());
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
        supplierDebts: {
          select: {
            id: true,
            paidAmount: true,
            _count: { select: { debtPayments: true } },
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

    // FIX PENTEST (22 Nov 2026, H9): PO yang sudah dibayar (sebagian/lunas)
    // tidak boleh dihapus — menghapusnya ikut menghapus utang supplier
    // beserta jejak pembayarannya tanpa reversal (pola yang sama seperti
    // cancelSale/deleteSale yang menolak bila hutang sudah ada cicilan).
    if (Number(purchase.paidAmount) > 0) {
      return {
        success: false,
        error: `Purchase Order ini sudah dibayar Rp ${Number(purchase.paidAmount).toLocaleString("id-ID")} dan tidak dapat dihapus.`,
      };
    }
    const paidSupplierDebt = purchase.supplierDebts.find(
      (d) => Number(d.paidAmount) > 0 || d._count.debtPayments > 0
    );
    if (paidSupplierDebt) {
      return {
        success: false,
        error: "Purchase Order ini sudah ada pembayaran utang supplier dan tidak dapat dihapus.",
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

    // Dulu tanpa `data`, padahal route DELETE memanggil
    // successResponse(result.data, ...) — type error di build.
    return {
      success: true,
      message: `Purchase Order ${purchase.poNumber} berhasil dihapus`,
      data: { id, poNumber: purchase.poNumber },
    };
  } catch (error) {
    console.error("Error deleting purchase:", error);
    return { success: false, error: toClientError(error, "Gagal menghapus Purchase Order") };
  }
}

//    GET PURCHASE STATISTICS   
export async function getPurchaseStatistics() {
  const session = await auth();
  try {
    // FIX PENTEST (22 Nov 2026, L27): requirePermission dipindah ke DALAM
    // try supaya kegagalan auth tidak lolos sebagai 500 generik.
    requirePermission(session, "VIEW_PURCHASES");
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
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Gagal mengambil statistik purchase" };
  }
}
