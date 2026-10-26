"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { DeliveryStatus, Prisma,  PaymentMethod  } from "@prisma/client";
import {
  createDeliveryOrderSchema,
  updateDeliveryStatusSchema,
  updateDeliveryOrderSchema,
  UpdateDeliveryStatusInput,
  CreateDeliveryOrderInput,
  UpdateDeliveryOrderInput,
} from "@/lib/validations/delivery-order.schema";
import { requirePermission, type AuthSession } from "../utils/role";
import { NotifEvent } from "../utils/notify";
import { deleteFromR2, extractR2Filename } from "../utils/storage";

// Helper untuk mengekstrak Bukti Pengiriman dari field proofImage atau tag di notes
function resolveProofImage(
  proofImage?: string | null,
  notes?: string | null
): string | null {
  if (proofImage && proofImage.trim()) return proofImage.trim();
  if (!notes) return null;
  const buktiMatch = notes.match(/\[BUKTI_KIRIM\]:\s*([^\s\]\n]+)/);
  if (buktiMatch && buktiMatch[1]) return buktiMatch[1].trim();
  const lokasiMatch = notes.match(/\[FOTO_LOKASI\]:\s*([^\s\]\n]+)/);
  if (lokasiMatch && lokasiMatch[1]) return lokasiMatch[1].trim();
  return null;
}

//    GENERATE DO NUMBER   
async function generateDONumber(tx: Prisma.TransactionClient): Promise<string> {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const prefix = `DO/${year}${month}`;

  const lastDO = await tx.deliveryOrder.findFirst({
    where: { doNumber: { startsWith: prefix } },
    orderBy: { doNumber: "desc" },
  });

  let nextNumber = 1;
  if (lastDO) {
    const parts = lastDO.doNumber.split("/");
    const lastNumberVal = parseInt(parts[parts.length - 1]);
    if (!isNaN(lastNumberVal)) nextNumber = lastNumberVal + 1;
  }
  return `${prefix}/${String(nextNumber).padStart(4, "0")}`;
}
//    GET ALL DELIVERY ORDERS   
export async function getAllDeliveryOrders(filters?: {
  search?: string;
  customerId?: string;
  status?: DeliveryStatus;
  dateFrom?: Date;
  dateTo?: Date;
}, externalSession?: AuthSession | null) {
  const session = externalSession || (await auth());
  requirePermission(session, "VIEW_DELIVERY_ORDERS");
  try {
    const where: Prisma.DeliveryOrderWhereInput = {};

    if (filters?.search) {
      where.OR = [
        { doNumber: { contains: filters.search, mode: "insensitive" } },
        {
          customer: { name: { contains: filters.search, mode: "insensitive" } },
        },
        { driver: { contains: filters.search, mode: "insensitive" } },
        { vehicle: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.deliveryDate = {};
      if (filters.dateFrom) where.deliveryDate.gte = filters.dateFrom;
      if (filters.dateTo) where.deliveryDate.lte = filters.dateTo;
    }

    const deliveryOrders = await prisma.deliveryOrder.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            name: true,
            phone: true,
            address: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        deliveryItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            unit: {
              select: {
                id: true,
                name: true,
                symbol: true,
              },
            },
          },
        },
        sale: {
          select: {
            id: true,
            invoiceNumber: true,
          },
        },
        deliveryPhotos: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Serialize Decimal & resolve proofImage
    const serialized = deliveryOrders.map((order) => ({
      ...order,
      proofImage: resolveProofImage(order.proofImage, order.notes),
      deliveryItems: order.deliveryItems.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
      })),
    }));

    return { success: true, data: serialized };
  } catch (error) {
    console.error("Error fetching delivery orders:", error);
    return { success: false, error: "Failed to fetch delivery orders" };
  }
}

//    GET DELIVERY ORDER STATISTICS   
export async function getDeliveryOrderStatistics() {
  const session = await auth();
requirePermission(session, "VIEW_DELIVERY_ORDERS");
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalDeliveries, inTransit, deliveredToday, pendingCount] =
      await Promise.all([
        prisma.deliveryOrder.count(),
        prisma.deliveryOrder.count({
          where: { status: DeliveryStatus.IN_TRANSIT },
        }),
        prisma.deliveryOrder.count({
          where: {
            status: DeliveryStatus.DELIVERED,
            receivedDate: {
              gte: today,
              lt: tomorrow,
            },
          },
        }),
        prisma.deliveryOrder.count({
          where: { status: DeliveryStatus.PENDING },
        }),
      ]);

    return {
      success: true,
      data: {
        totalDeliveries,
        inTransit,
        deliveredToday,
        pendingCount,
      },
    };
  } catch (error) {
    console.error("Error fetching delivery statistics:", error);
    return { success: false, error: "Failed to fetch statistics" };
  }
}

//    GET DELIVERY ORDER BY ID   
export async function getDeliveryOrderById(id: string, externalSession?: AuthSession | null) {
  const session = externalSession || (await auth());
  requirePermission(session, "VIEW_DELIVERY_ORDERS");
  try {
    const deliveryOrder = await prisma.deliveryOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        deliveryItems: {
          include: {
            product: true,
            unit: {
              select: {
                id: true,
                name: true,
                symbol: true, // ✅ TAMBAHKAN INI
              },
            },
          },
        },
        deliveryPhotos: {
          orderBy: { createdAt: "desc" },
        },
        sale: {
          select: {
            id: true,
            invoiceNumber: true,
            saleDate: true,
            grandTotal: true,
          },
        },
      },
    });

    if (!deliveryOrder) {
      return { success: false, error: "Delivery order not found" };
    }

    // Serialize
    const serialized = {
      ...deliveryOrder,
      proofImage: resolveProofImage(deliveryOrder.proofImage, deliveryOrder.notes),
      deliveryItems: deliveryOrder.deliveryItems.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
      })),
      sale: deliveryOrder.sale
        ? {
            ...deliveryOrder.sale,
            grandTotal: Number(deliveryOrder.sale.grandTotal),
          }
        : null,
    };

    return { success: true, data: serialized };
  } catch (error) {
    console.error("Error fetching delivery order:", error);
    return { success: false, error: "Failed to fetch delivery order" };
  }
}

// --- HELPER UNTUK GENERATE NOMOR INVOICE (FIXED) ---
// --- HELPER UNTUK GENERATE NOMOR INVOICE (FIXED & ROBUST) ---
async function generateInvoiceNumber(tx: Prisma.TransactionClient) {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}`;

  // 1. Cari nomor terakhir berdasarkan ABJAD (invoiceNumber), BUKAN tanggal (createdAt)
  const lastSale = await tx.sale.findFirst({
    where: {
      invoiceNumber: { startsWith: `INV-${dateStr}` },
    },
    orderBy: { invoiceNumber: "desc" }, // <--- GANTI JADI INI (PENTING!)
  });

  let nextNumber = 1;
  if (lastSale) {
    const parts = lastSale.invoiceNumber.split("-");
    const lastNum = parseInt(parts[2]); 
    if (!isNaN(lastNum)) {
      nextNumber = lastNum + 1;
    }
  }

  // 2. SAFETY CHECK: Pastikan nomor benar-benar belum ada (Anti-Crash)
  let invoiceNumber = `INV-${dateStr}-${nextNumber.toString().padStart(4, "0")}`;
  
  // Cek ke database apakah nomor ini sudah ada? Jika ada, naikkan +1 lagi
  while (await tx.sale.findUnique({ where: { invoiceNumber } })) {
    nextNumber++;
    invoiceNumber = `INV-${dateStr}-${nextNumber.toString().padStart(4, "0")}`;
  }

  return invoiceNumber;
}

// --- HELPER: GENERATE DEBT NUMBER ---
async function generateDebtNumber(tx: Prisma.TransactionClient) {
  const count = await tx.customerDebt.count();
  return `DEBT-CUST-${(count + 1).toString().padStart(5, "0")}`;
}
// --- FUNGSI UTAMA CREATE DELIVERY ORDER (FIXED) ---


// Pastikan import PaymentMethod ada di paling atas file
// import { DeliveryStatus, Prisma, PaymentMethod } from "@prisma/client";

export async function createDeliveryOrder(input: CreateDeliveryOrderInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "CREATE_DELIVERY_ORDER");

    // 1. Validasi Input Zod
    const validated = createDeliveryOrderSchema.parse(input);

    // =========================================================
    // 2. VALIDASI STOK (PENTING: Jangan dihapus)
    // =========================================================
    for (const item of validated.items) {
      // Kita cek stok saat ini di database
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: {
          id: true,
          name: true,
          currentStock: true,
          productUnits: { include: { unit: true } },
        },
      });

      if (!product) {
        return { success: false, error: `Produk tidak ditemukan: ${item.productId}` };
      }

      // Validasi Unit
      const itemUnit = product.productUnits.find((pu) => pu.unitId === item.unitId);
      if (!itemUnit) {
        return { success: false, error: `Satuan tidak valid untuk produk: ${product.name}` };
      }

      // Hitung kebutuhan stok dalam satuan dasar (misal: 1 Dus = 10 Pcs)
      const requiredStock = item.quantity * Number(itemUnit.conversionValue);

      // Cek apakah stok cukup
      if (Number(product.currentStock) < requiredStock) {
        return {
          success: false,
          error: `Stok ${product.name} tidak cukup. Tersedia: ${product.currentStock}, Butuh: ${requiredStock}`,
        };
      }
    }

    // 3. Cek Duplikasi Sale ID
    if (validated.saleId) {
      const existingDO = await prisma.deliveryOrder.findFirst({
        where: { saleId: validated.saleId },
      });
      if (existingDO) return { success: false, error: "Transaksi ini sudah dibuatkan Surat Jalan." };
    }

    // =========================================================
    // OPTIMISASI: PERSIAPAN DATA (PRE-CALCULATION)
    // =========================================================
    
    // A. Ambil info harga & konversi untuk semua item sekaligus
    const productUnits = await prisma.productUnit.findMany({
      where: {
        productId: { in: validated.items.map((i) => i.productId) },
        unitId: { in: validated.items.map((i) => i.unitId) },
      },
    });

    // Map untuk akses cepat (Supaya tidak query berulang)
    const unitMap = new Map<string, { sellPrice: number; conversionValue: number }>();
    productUnits.forEach((pu) => {
      unitMap.set(`${pu.productId}-${pu.unitId}`, {
        sellPrice: Number(pu.sellPrice),
        conversionValue: Number(pu.conversionValue),
      });
    });

    // B. Siapkan variable data dengan TIPE EKSPLISIT (Fix Error TypeScript)
    let grandTotal = 0;
    
    // Tipe data eksplisit untuk Sale Item
    const saleItemsData: {
      productId: string;
      unitId: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      discount: number;
    }[] = [];

    // Tipe data eksplisit untuk Stock Update
    const stockUpdates: {
      productId: string;
      qtyBase: number;
    }[] = [];

    // C. Loop Kalkulasi (Tanpa Query Database)
    for (const item of validated.items) {
      const unitKey = `${item.productId}-${item.unitId}`;
      const unitData = unitMap.get(unitKey);

      if (!unitData) throw new Error(`Data satuan tidak ditemukan untuk produk ${item.productId}`);

      // Hitung Subtotal Harga
      const subtotal = unitData.sellPrice * item.quantity;
      grandTotal += subtotal;

      // Masukkan ke array Sale Items
      saleItemsData.push({
        productId: item.productId,
        unitId: item.unitId,
        quantity: item.quantity,
        unitPrice: unitData.sellPrice,
        subtotal: subtotal,
        discount: 0,
      });

      // Hitung Pengurangan Stok (Qty x Nilai Konversi)
      const totalQtyBase = item.quantity * unitData.conversionValue;
      
      // Masukkan ke array Stock Updates
      stockUpdates.push({
        productId: item.productId,
        qtyBase: totalQtyBase,
      });
    }

    // =========================================================
    // 4. DATABASE TRANSACTION (OPTIMIZED)
    // =========================================================
    const result = await prisma.$transaction(async (tx) => {
      // A. Generate Nomor Surat Jalan
      const doNumber = await generateDONumber(tx);
      
      // B. Logic Invoice Otomatis (Jika DO dibuat manual tanpa POS)
      let createdSaleId = validated.saleId; 

      if (!createdSaleId) {
        const invoiceNumber = await generateInvoiceNumber(tx);
        
        // Buat Sale Baru
        const newSale = await tx.sale.create({
          data: {
            invoiceNumber,
            customerId: validated.customerId,
            cashierId: session.user.id,
            paymentMethod: PaymentMethod.CREDIT, // Default Hutang
            status: "PENDING",
            totalAmount: grandTotal,
            tax: 0,
            discount: 0,
            grandTotal: grandTotal,
            paidAmount: 0,
            changeAmount: 0,
            notes: `Auto-Invoice DO: ${doNumber}. ${validated.notes || ""}`,
            saleItems: {
              create: saleItemsData // Data yang sudah disiapkan di atas
            }
          }
        });
        createdSaleId = newSale.id;

        // Catat Hutang Customer
        const debtNumber = await generateDebtNumber(tx);
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30); // Jatuh tempo 30 hari

        await tx.customerDebt.create({
          data: {
            debtNumber,
            saleId: newSale.id,
            customerId: validated.customerId,
            totalDebt: grandTotal,
            paidAmount: 0,
            remainingDebt: grandTotal,
            status: "UNPAID",
            dueDate: dueDate,
            notes: `Tagihan Surat Jalan ${doNumber}`
          }
        });
      }

      // C. Buat Delivery Order (Surat Jalan)
      const deliveryOrder = await tx.deliveryOrder.create({
        data: {
          doNumber,
          customerId: validated.customerId,
          saleId: createdSaleId,
          deliveryDate: validated.deliveryDate,
          driver: validated.driver,
          vehicle: validated.vehicle,
          notes: validated.notes,
          proofImage: validated.proofImage || resolveProofImage(undefined, validated.notes),
          status: "PENDING",
          createdById: session.user.id,
          deliveryItems: {
            create: validated.items.map((item) => ({
              productId: item.productId,
              unitId: item.unitId,
              quantity: item.quantity,
              notes: item.notes,
            })),
          },
        },
        include: {
          customer: true,
          deliveryItems: {
            include: { product: true, unit: true },
          },
        },
      });

      return deliveryOrder;
    }, 
    // KONFIGURASI TIMEOUT: 20 Detik
    {
        maxWait: 5000, 
        timeout: 20000 
    });

    // Revalidate semua halaman terkait
    revalidatePath("/dashboard/delivery-orders");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/customer-debts");
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/stocks");

    // Kirim notifikasi ke admin bahwa DO baru telah dibuat
    NotifEvent.doCreated(result.doNumber, result.customer?.name || "Pelanggan").catch(() => {});

    return {
      success: true,
      message: `Surat Jalan ${result.doNumber} berhasil dibuat!`,
      data: {
        ...result,
        deliveryItems: result.deliveryItems.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
        })),
      },
    };

  } catch (error) {
    console.error("Error creating delivery order:", error);
    return { success: false, error: (error instanceof Error ? error.message : "Gagal membuat surat jalan") };
  }
}

//    UPDATE DELIVERY STATUS   
export async function updateDeliveryStatus(input: UpdateDeliveryStatusInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "UPDATE_DELIVERY_STATUS");
    const validated = updateDeliveryStatusSchema.parse(input);

    // Get delivery order with items
    const deliveryOrder = await prisma.deliveryOrder.findUnique({
      where: { id: validated.id },
      include: {
        deliveryItems: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!deliveryOrder) {
      return { success: false, error: "Delivery order not found" };
    }
    // ============================================================
    // MODIFIKASI: CEK KHUSUS STATUS CANCELLED
    // ============================================================
    if (validated.status === "CANCELLED") {
      
      // 2. JALANKAN TRANSAKSI PEMBATALAN
      await prisma.$transaction(async (tx) => {
          // A. KEMBALIKAN STOK (RESTORE)
          for (const item of deliveryOrder.deliveryItems) {
              // Ambil konversi unit (misal 1 Sak = 50kg)
              // Note: Pastikan Anda mengambil data unit/konversi yang benar
              const pUnit = await tx.productUnit.findFirst({
                  where: { productId: item.productId, unitId: item.unitId }
              });
              const conversion = Number(pUnit?.conversionValue || 1);
              
              // BALIKKAN STOK (INCREMENT)
              await tx.product.update({
                  where: { id: item.productId },
                  data: { currentStock: { increment: Number(item.quantity) * Number(conversion) } }
              });
              
              // BERSIHKAN LOG KELUAR (Stock Movement)
              // Hapus log 'OUT' sebelumnya agar stok balance
              await tx.stockMovement.deleteMany({
                  where: { referenceId: validated.id, referenceType: "DELIVERY_ORDER" }
              });
          }

          // B. HAPUS TAGIHAN/HUTANG (Agar customer tidak ditagih)
          if (deliveryOrder.saleId) {
              await tx.customerDebt.deleteMany({ 
                  where: { saleId: deliveryOrder.saleId } 
              });
              
              // C. NOL-KAN OMSET PENJUALAN
              await tx.sale.update({
                  where: { id: deliveryOrder.saleId },
                  data: { 
                      status: "CANCELLED", // Pastikan enum SaleStatus ada CANCELLED
                      totalAmount: 0,
                      grandTotal: 0,
                      notes: `Dibatalkan dari DO: ${deliveryOrder.doNumber}`
                  }
              });
          }

          // D. AKHIRNYA UPDATE STATUS DO JADI CANCELLED
          await tx.deliveryOrder.update({
              where: { id: validated.id },
              data: { status: "CANCELLED" }
          });
      });

      revalidatePath("/dashboard/delivery-orders");
      // LANGSUNG RETURN AGAR KODE DI BAWAHNYA TIDAK DIJALANKAN
      return { success: true, message: "Pengiriman dibatalkan, stok dikembalikan & hutang dihapus." };
    }
    // ✅ TAMBAHKAN: Check if status changing to DELIVERED
    const isBecomingDelivered =
      deliveryOrder.status !== "DELIVERED" && validated.status === "DELIVERED";

    // Update delivery order
    const updated = await prisma.deliveryOrder.update({
      where: { id: validated.id },
      data: {
        status: validated.status,
        receivedBy: validated.receivedBy,
        receivedDate: validated.receivedDate,
        ...(validated.notes ? { notes: validated.notes } : {}),
        ...(validated.proofImage !== undefined
          ? { proofImage: validated.proofImage }
          : validated.notes
          ? { proofImage: resolveProofImage(undefined, validated.notes) }
          : {}),
      },
      include: {
        customer: true,
        deliveryItems: {
          include: {
            product: true,
            unit: true,
          },
        },
      },
    });

    // ✅ TAMBAHKAN: Deduct stock if status changed to DELIVERED
    if (isBecomingDelivered) {
      for (const item of deliveryOrder.deliveryItems) {
        // Get primary unit for this product
        const primaryUnit = await prisma.productUnit.findFirst({
          where: {
            productId: item.productId,
            isPrimary: true,
          },
        });

        if (!primaryUnit) {
          console.warn(`No primary unit found for product ${item.productId}`);
          continue;
        }

        // Get delivery item's unit conversion
        const deliveryUnit = await prisma.productUnit.findFirst({
          where: {
            productId: item.productId,
            unitId: item.unitId,
          },
        });

        if (!deliveryUnit) {
          console.warn(`Unit not found for product ${item.productId}`);
          continue;
        }

        // Calculate quantity in primary unit
        const quantityInPrimaryUnit =
          Number(item.quantity) * Number(deliveryUnit.conversionValue);

        // ✅ Create stock movement record
        await prisma.stockMovement.create({
          data: {
            productId: item.productId,
            type: "OUT",
            quantity: quantityInPrimaryUnit,
            referenceType: "DELIVERY_ORDER",
            referenceId: deliveryOrder.id,
            notes: `Pengiriman ke ${updated.customer.name}`,
            createdById: session.user.id,
          },
        });
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            currentStock: {
              decrement: quantityInPrimaryUnit,
            },
          },
        });
      }
    }
    const isBecomingCancelled =
      deliveryOrder.status === "DELIVERED" && validated.status === "DELIVERED";

    if (isBecomingCancelled) {
      // Restore stock (reverse the deduction)
      for (const item of deliveryOrder.deliveryItems) {
        const primaryUnit = await prisma.productUnit.findFirst({
          where: { productId: item.productId, isPrimary: true },
        });

        const deliveryUnit = await prisma.productUnit.findFirst({
          where: { productId: item.productId, unitId: item.unitId },
        });

        if (primaryUnit && deliveryUnit) {
          const quantityInPrimaryUnit =
            Number(item.quantity) * Number(deliveryUnit.conversionValue);

          await prisma.stockMovement.create({
            data: {
              productId: item.productId,
              type: "IN",
              quantity: quantityInPrimaryUnit,
              reference: `Cancelled DO: ${deliveryOrder.doNumber}`,
              referenceType: "DELIVERY_ORDER", // ✅ TAMBAH INI (opsional)
              referenceId: deliveryOrder.id,
              notes: `Pembatalan pengiriman`,
              createdById: session.user.id,
            },
          });
          await prisma.product.update({
            where: { id: item.productId },
            data: {
              currentStock: {
                decrement: quantityInPrimaryUnit,
              },
            },
          });
        }
      }
    }
    revalidatePath("/dashboard/delivery-orders");

    // Kirim notifikasi perubahan status DO
    NotifEvent.doStatusChanged(
      updated.doNumber,
      validated.status,
      updated.createdById ?? undefined
    ).catch(() => {});

    return {
      success: true,
      message: `Delivery status updated to ${validated.status}`,
      data: {
        ...updated,
        proofImage: resolveProofImage(updated.proofImage, updated.notes),
        deliveryItems: updated.deliveryItems.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
        })),
      },
    };
  } catch (error) {
    console.error("Error updating delivery status:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to update delivery status" };
  }
}

// ============================================================================
//         UPDATE DELIVERY ORDER (EDIT SURAT JALAN OLEH ADMIN / SUPERADMIN)
// ============================================================================
export async function updateDeliveryOrder(
  input: UpdateDeliveryOrderInput,
  externalSession?: AuthSession | null
) {
  try {
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "EDIT_DELIVERY_ORDER");
    const validated = updateDeliveryOrderSchema.parse(input);

    const existingDO = await prisma.deliveryOrder.findUnique({
      where: { id: validated.id },
    });
    if (!existingDO) {
      return { success: false, error: "Surat Jalan tidak ditemukan" };
    }

    // Siapkan data update
    const updateData: Prisma.DeliveryOrderUpdateInput = {};
    if (validated.deliveryDate !== undefined && validated.deliveryDate !== null) {
      updateData.deliveryDate = validated.deliveryDate;
    }
    if (validated.driver !== undefined) {
      updateData.driver = validated.driver;
    }
    if (validated.vehicle !== undefined) {
      updateData.vehicle = validated.vehicle;
    }
    if (validated.notes !== undefined) {
      updateData.notes = validated.notes;
    }
    if (validated.proofImage !== undefined) {
      updateData.proofImage = validated.proofImage;
    } else if (validated.notes) {
      const extracted = resolveProofImage(undefined, validated.notes);
      if (extracted) updateData.proofImage = extracted;
    }
    if (validated.status !== undefined) {
      updateData.status = validated.status;
    }
    if (validated.receivedBy !== undefined) {
      updateData.receivedBy = validated.receivedBy;
    }
    if (validated.receivedDate !== undefined) {
      updateData.receivedDate = validated.receivedDate;
    }

    const updated = await prisma.deliveryOrder.update({
      where: { id: validated.id },
      data: updateData,
      include: {
        customer: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        deliveryItems: {
          include: {
            product: true,
            unit: true,
          },
        },
      },
    });

    revalidatePath("/dashboard/delivery-orders");

    return {
      success: true,
      message: `Surat Jalan ${updated.doNumber} berhasil diperbarui!`,
      data: {
        ...updated,
        proofImage: resolveProofImage(updated.proofImage, updated.notes),
        deliveryItems: updated.deliveryItems.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
        })),
      },
    };
  } catch (error) {
    console.error("Error updating delivery order details:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal memperbarui Surat Jalan",
    };
  }
}


//    DELETE DELIVERY ORDER   
export async function deleteDeliveryOrder(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "DELETE_DELIVERY_ORDER");

    // 1. Ambil Data DO beserta relasinya (Sale & Item)
    const deliveryOrder = await prisma.deliveryOrder.findUnique({
      where: { id },
      include: { 
        deliveryPhotos: true,
        deliveryItems: true,
        sale: {
            include: {
                customerDebts: true // Cek apakah ada hutang terkait
            }
        }
      },
    });

    if (!deliveryOrder) {
      return { success: false, error: "Surat jalan tidak ditemukan" };
    }

    // 2. Kumpulkan file gambar untuk dihapus dari Cloudflare R2
    const photosToDelete: string[] = [];
    if (deliveryOrder.proofImage) photosToDelete.push(deliveryOrder.proofImage);
    if (deliveryOrder.deliveryPhotos && deliveryOrder.deliveryPhotos.length > 0) {
      deliveryOrder.deliveryPhotos.forEach((p) => {
        if (p.filename) photosToDelete.push(p.filename);
        else if (p.url) photosToDelete.push(p.url);
      });
    }

    // 3. PROTEKSI: Cek Status Pengiriman
    // Jika barang sudah sampai (DELIVERED) mungkin tidak boleh dihapus sembarangan
    if (deliveryOrder.status === "DELIVERED") {
        return { success: false, error: "Tidak dapat menghapus DO yang sudah status DITERIMA" };
    }

    // 4. PROTEKSI UTAMA: Cek Apakah Sudah Ada Pembayaran?
    if (deliveryOrder.sale && deliveryOrder.sale.customerDebts.length > 0) {
        const debt = deliveryOrder.sale.customerDebts[0];
        
        // Cek jika sudah ada uang masuk (Paid Amount > 0)
        if (Number(debt.paidAmount) > 0) {
            return { 
                success: false, 
                error: `DITOLAK: Surat jalan ini sudah memiliki pembayaran/cicilan sebesar Rp ${Number(debt.paidAmount).toLocaleString()}. Harap hapus pembayaran terlebih dahulu di menu Hutang.` 
            };
        }
    }

    // 5. EKSEKUSI PENGHAPUSAN BERANTAI (TRANSAKSI)
    await prisma.$transaction(async (tx) => {
        
        // A. KEMBALIKAN STOK (RESTORE STOCK)
        for (const item of deliveryOrder.deliveryItems) {
            const pUnit = await tx.productUnit.findFirst({
                where: { productId: item.productId, unitId: item.unitId }
            });
            const conversion = Number(pUnit?.conversionValue || 1);
            const totalQtyBase = Number(item.quantity) * conversion;

            // 1. Update Stok Produk (Increment)
            await tx.product.update({
                where: { id: item.productId },
                data: {
                    currentStock: { increment: totalQtyBase }
                }
            });

            // 2. Hapus Log StockMovement terkait DO ini
            await tx.stockMovement.deleteMany({
                where: { 
                    referenceId: deliveryOrder.id,
                    referenceType: "DELIVERY_ORDER"
                }
            });
        }

        // B. Hapus Data Hutang (CustomerDebt)
        if (deliveryOrder.saleId) {
            await tx.customerDebt.deleteMany({
                where: { saleId: deliveryOrder.saleId }
            });
        }

        // C. Hapus Data Penjualan (Sale) & Item Penjualan
        if (deliveryOrder.saleId) {
            await tx.saleItem.deleteMany({
                where: { saleId: deliveryOrder.saleId }
            });
            
            await tx.sale.delete({
                where: { id: deliveryOrder.saleId }
            });
        }

        // D. Hapus foto dari tabel DeliveryPhoto (cascade juga akan menangani jika schema cascade aktif)
        await tx.deliveryPhoto.deleteMany({
            where: { deliveryOrderId: id }
        });

        // E. Terakhir, Hapus Surat Jalan (DeliveryOrder)
        await tx.deliveryOrder.delete({
            where: { id }
        });
    });

    // 6. Hapus file fisik di Cloudflare R2 secara asinkron tanpa menahan respon
    if (photosToDelete.length > 0) {
      Promise.allSettled(photosToDelete.map((file) => deleteFromR2(file))).catch((err) => {
        console.warn("[R2_CLEANUP_WARN] Gagal menghapus file R2 setelah DO dihapus:", err);
      });
    }

    // Revalidate semua halaman yang terpengaruh
    revalidatePath("/dashboard/delivery-orders");
    revalidatePath("/dashboard/sales");          // Sale hilang dari list
    revalidatePath("/dashboard/customer-debts"); // Hutang hilang dari list
    revalidatePath("/dashboard/products");       // Stok kembali

    return {
      success: true,
      message: "Surat jalan dibatalkan & data terkait (Penjualan/Hutang) telah dihapus.",
    };

  } catch (error) {
    console.error("Error deleting delivery order:", error);
    return { success: false, error: (error instanceof Error ? error.message : "Gagal menghapus surat jalan") };
  }
}

// ============================================================================
//                  CANCEL DELIVERY ORDER (BATALKAN TRANSAKSI)
// ============================================================================
export async function cancelDeliveryOrder(id: string) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    
    // Sesuaikan permission jika perlu
    requirePermission(session, "UPDATE_DELIVERY_STATUS"); 

    // 1. Ambil Data DO
    const deliveryOrder = await prisma.deliveryOrder.findUnique({
      where: { id },
      include: { 
        deliveryItems: true,
        sale: {
            include: { customerDebts: true }
        }
      },
    });

    if (!deliveryOrder) return { success: false, error: "Dokumen tidak ditemukan" };

    // 2. CEK STATUS: Jika sudah selesai/dikirim, mungkin butuh validasi ekstra
    if (deliveryOrder.status === "DELIVERED") {
        return { success: false, error: "Tidak bisa membatalkan barang yang sudah status DITERIMA (Delivered)." };
    }
    if (deliveryOrder.status === "CANCELLED") {
        return { success: false, error: "Dokumen ini sudah dibatalkan sebelumnya." };
    }

    // 3. PROTEKSI PEMBAYARAN (Sama seperti Delete)
    // Jangan izinkan batal jika customer sudah bayar cicilan
    if (deliveryOrder.sale && deliveryOrder.sale.customerDebts.length > 0) {
        const debt = deliveryOrder.sale.customerDebts[0];
        if (Number(debt.paidAmount) > 0) {
            return { 
                success: false, 
                error: `GAGAL: Ada pembayaran masuk sebesar Rp ${Number(debt.paidAmount).toLocaleString()}. Harap hapus pembayaran dulu di menu Hutang sebelum membatalkan.` 
            };
        }
    }

    // 4. EKSEKUSI PEMBATALAN
    await prisma.$transaction(async (tx) => {
        
        // A. KEMBALIKAN STOK (RESTORE STOCK)
        for (const item of deliveryOrder.deliveryItems) {
            const pUnit = await tx.productUnit.findFirst({
                where: { productId: item.productId, unitId: item.unitId }
            });
            const conversion = Number(pUnit?.conversionValue || 1);
            const totalQtyBase = Number(item.quantity) * conversion;

            // Kembalikan Stok
            await tx.product.update({
                where: { id: item.productId },
                data: { currentStock: { increment: totalQtyBase } }
            });

            // Catat di Kartu Stok sebagai "Koreksi Masuk" (opsional, agar history jelas)
            await tx.stockMovement.create({
                data: {
                    productId: item.productId,
                    type: "IN", // Barang masuk kembali
                    quantity: totalQtyBase,
                    referenceType: "DELIVERY_ORDER",
                    referenceId: deliveryOrder.id,
                    notes: `Pembatalan DO: ${deliveryOrder.doNumber}`,
                    createdById: session.user.id
                }
            });
        }

        // B. HAPUS HUTANG (Agar tidak tertagih)
        // Kita hapus record hutang karena transaksinya batal
        if (deliveryOrder.saleId) {
            await tx.customerDebt.deleteMany({
                where: { saleId: deliveryOrder.saleId }
            });
        }

        // C. UPDATE STATUS DO & SALE JADI "CANCELLED"
        // Kita tidak menghapus record ini agar tetap ada history nomornya (untuk audit)
        
        // Update DO
        await tx.deliveryOrder.update({
            where: { id },
            data: { 
                status: "CANCELLED", // Pastikan enum DeliveryStatus punya 'CANCELLED'
                notes: `${deliveryOrder.notes || ''} [DIBATALKAN]`.trim()
            }
        });

        // Update Sale (Invoice)
        if (deliveryOrder.saleId) {
            await tx.sale.update({
                where: { id: deliveryOrder.saleId },
                data: { 
                    status: "CANCELLED", // Pastikan enum SaleStatus punya 'CANCELLED'
                    totalAmount: 0,      // Nol-kan omset agar tidak masuk laporan keuangan
                    grandTotal: 0,
                    notes: `Dibatalkan dari DO: ${deliveryOrder.doNumber}`
                }
            });
        }
    });

    revalidatePath("/dashboard/delivery-orders");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/customer-debts");
    revalidatePath("/dashboard/products");

    return { success: true, message: "Pengiriman berhasil dibatalkan. Stok telah dikembalikan." };

  } catch (error: unknown) {
    console.error("Cancel DO Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Gagal membatalkan transaksi" };
  }
}

// ==================== PHOTO MANAGEMENT (ADD / DELETE) ====================

/**
 * Tambah foto ke DeliveryOrder dengan pelacakan ukuran file & sinkronisasi
 */
export async function addDeliveryPhoto(input: {
  deliveryOrderId: string;
  url: string;
  filename: string;
  sizeBytes?: number;
  mimeType?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "UPDATE_DELIVERY_STATUS");

    const { deliveryOrderId, url, filename, sizeBytes = 0, mimeType = "image/jpeg" } = input;

    // Batasi maks 5 foto per DO
    const existingCount = await prisma.deliveryPhoto.count({
      where: { deliveryOrderId },
    });

    if (existingCount >= 5) {
      return { success: false, error: "Batas maksimal 5 foto per Surat Jalan telah tercapai." };
    }

    const photo = await prisma.deliveryPhoto.create({
      data: {
        deliveryOrderId,
        url,
        filename,
        sizeBytes,
        mimeType,
        uploadedById: session.user.id,
      },
    });

    // Update proofImage di DeliveryOrder sebagai thumbnail utama
    await prisma.deliveryOrder.update({
      where: { id: deliveryOrderId },
      data: { proofImage: url },
    });

    revalidatePath("/dashboard/delivery-orders");

    return {
      success: true,
      data: photo,
      message: "Foto berhasil ditambahkan",
    };
  } catch (error) {
    console.error("Error adding delivery photo:", error);
    return { success: false, error: "Gagal menyimpan foto ke database" };
  }
}

/**
 * Hapus foto dari DeliveryOrder (Hapus fisik R2 dan record DB bersamaan)
 */
export async function deleteDeliveryPhoto(photoId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "UPDATE_DELIVERY_STATUS");

    const photo = await prisma.deliveryPhoto.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      return { success: false, error: "Foto tidak ditemukan" };
    }

    // 1. Hapus dari DB
    await prisma.deliveryPhoto.delete({
      where: { id: photoId },
    });

    // 2. Hapus fisik dari Cloudflare R2
    await deleteFromR2(photo.filename || photo.url);

    // 3. Update proofImage jika foto yang dihapus adalah foto utama
    const remainingPhotos = await prisma.deliveryPhoto.findMany({
      where: { deliveryOrderId: photo.deliveryOrderId },
      orderBy: { createdAt: "desc" },
    });

    const newProofImage = remainingPhotos.length > 0 ? remainingPhotos[0].url : null;
    await prisma.deliveryOrder.update({
      where: { id: photo.deliveryOrderId },
      data: { proofImage: newProofImage },
    });

    revalidatePath("/dashboard/delivery-orders");

    return {
      success: true,
      message: "Foto berhasil dihapus dari Cloudflare R2 & database.",
    };
  } catch (error) {
    console.error("Error deleting delivery photo:", error);
    return { success: false, error: "Gagal menghapus foto" };
  }
}