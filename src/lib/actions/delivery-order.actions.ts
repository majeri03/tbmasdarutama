"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { DeliveryStatus, Prisma,  PaymentMethod  } from "@prisma/client";
import {
  createDeliveryOrderSchema,
  updateDeliveryStatusSchema,
  UpdateDeliveryStatusInput,
  CreateDeliveryOrderInput,
} from "@/lib/validations/delivery-order.schema";
import { requirePermission } from "../utils/role";
//    GENERATE DO NUMBER   
async function generateDONumber(): Promise<string> {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const prefix = `DO/${year}${month}`;

  const lastDO = await prisma.deliveryOrder.findFirst({
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
}) {
  const session = await auth();
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
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Serialize Decimal
    const serialized = deliveryOrders.map((order) => ({
      ...order,
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
export async function getDeliveryOrderById(id: string) {
  const session = await auth();
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


//    CREATE DELIVERY ORDER   
// export async function createDeliveryOrder(input: CreateDeliveryOrderInput) {
//   try {
//     const session = await auth();
//     if (!session?.user) {
//       return { success: false, error: "Unauthorized" };
//     }
//     requirePermission(session, "CREATE_DELIVERY_ORDER");
//     const validated = createDeliveryOrderSchema.parse(input);
//     // ✅ Check stock availability
//     for (const item of validated.items) {
//       const product = await prisma.product.findUnique({
//         where: { id: item.productId },
//         select: {
//           id: true,
//           name: true,
//           currentStock: true,
//           productUnits: {
//             include: {
//               unit: true,
//             },
//           },
//         },
//       });

//       if (!product) {
//         return {
//           success: false,
//           error: `Product not found: ${item.productId}`,
//         };
//       }

//       // Get primary unit
//       const primaryUnit = product.productUnits.find((pu) => pu.isPrimary);
//       if (!primaryUnit) {
//         return {
//           success: false,
//           error: `No primary unit for product: ${product.name}`,
//         };
//       }

//       // Get item unit conversion
//       const itemUnit = product.productUnits.find(
//         (pu) => pu.unitId === item.unitId
//       );
//       if (!itemUnit) {
//         return {
//           success: false,
//           error: `Invalid unit for product: ${product.name}`,
//         };
//       }

//       // Calculate required stock in primary unit
//       const requiredStock = item.quantity * Number(itemUnit.conversionValue);

//       if (Number(product.currentStock) < requiredStock) {
//         return {
//           success: false,
//           error: `Insufficient stock for ${product.name}. Available: ${product.currentStock} ${primaryUnit.unit.name}, Required: ${requiredStock} ${primaryUnit.unit.name}`,
//         };
//       }
//     }
//     // Generate DO Number
//     const doNumber = await generateDONumber();

//     // Check if saleId already has delivery order
//     if (validated.saleId) {
//       const existingDO = await prisma.deliveryOrder.findFirst({
//         where: { saleId: validated.saleId },
//       });
//       if (existingDO) {
//         return {
//           success: false,
//           error: "Sale already has a delivery order",
//         };
//       }
//     }

//     // Create delivery order with items
//     const deliveryOrder = await prisma.deliveryOrder.create({
//       data: {
//         doNumber,
//         customerId: validated.customerId,
//         saleId: validated.saleId,
//         deliveryDate: validated.deliveryDate,
//         driver: validated.driver,
//         vehicle: validated.vehicle,
//         notes: validated.notes,
//         createdById: session.user.id,
//         deliveryItems: {
//           create: validated.items.map((item) => ({
//             productId: item.productId,
//             unitId: item.unitId,
//             quantity: item.quantity,
//             notes: item.notes,
//           })),
//         },
//       },
//       include: {
//         customer: true,
//         deliveryItems: {
//           include: {
//             product: true,
//             unit: true,
//           },
//         },
//       },
//     });

//     revalidatePath("/dashboard/delivery-orders");

//     return {
//       success: true,
//       message: `Delivery order ${doNumber} created successfully`,
//       data: {
//         ...deliveryOrder,
//         deliveryItems: deliveryOrder.deliveryItems.map((item) => ({
//           ...item,
//           quantity: Number(item.quantity),
//         })),
//       },
//     };
//   } catch (error) {
//     console.error("Error creating delivery order:", error);
//     if (error instanceof Error) {
//       return { success: false, error: error.message };
//     }
//     return { success: false, error: "Failed to create delivery order" };
//   }
// }

// --- HELPER UNTUK GENERATE NOMOR INVOICE (FIXED) ---
async function generateInvoiceNumber(tx: Prisma.TransactionClient) {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}`;

  // Cari yang paling terakhir dibuat hari ini
  const lastSale = await tx.sale.findFirst({
    where: {
      invoiceNumber: { startsWith: `INV-${dateStr}` },
    },
    orderBy: { createdAt: "desc" }, // Ganti order by createdAt agar lebih akurat
  });

  let nextNumber = 1;
  if (lastSale) {
    const parts = lastSale.invoiceNumber.split("-");
    const lastNum = parseInt(parts[2]); // Ambil angka urutan
    if (!isNaN(lastNum)) {
      nextNumber = lastNum + 1;
    }
  }

  // Format: INV-20240117-0001
  return `INV-${dateStr}-${nextNumber.toString().padStart(4, "0")}`;
}

// --- HELPER: GENERATE DEBT NUMBER ---
async function generateDebtNumber(tx: Prisma.TransactionClient) {
  const count = await tx.customerDebt.count();
  return `DEBT-CUST-${(count + 1).toString().padStart(5, "0")}`;
}
// --- FUNGSI UTAMA CREATE DELIVERY ORDER (FIXED) ---


export async function createDeliveryOrder(input: CreateDeliveryOrderInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "CREATE_DELIVERY_ORDER");
    
    // 1. Validasi Input Zod
    const validated = createDeliveryOrderSchema.parse(input);

    // 2. Validasi Stok (Kode asli Anda)
    for (const item of validated.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: {
          id: true,
          name: true,
          currentStock: true,
          productUnits: { include: { unit: true } },
        },
      });

      if (!product) return { success: false, error: `Product not found: ${item.productId}` };

      const primaryUnit = product.productUnits.find((pu) => pu.isPrimary);
      if (!primaryUnit) return { success: false, error: `No primary unit for: ${product.name}` };

      const itemUnit = product.productUnits.find((pu) => pu.unitId === item.unitId);
      if (!itemUnit) return { success: false, error: `Invalid unit for: ${product.name}` };

      const requiredStock = item.quantity * Number(itemUnit.conversionValue);

      if (Number(product.currentStock) < requiredStock) {
        return {
          success: false,
          error: `Stok tidak cukup untuk ${product.name}. Ada: ${product.currentStock}, Butuh: ${requiredStock}`,
        };
      }
    }

    // 3. Cek Duplikasi Sale ID
    if (validated.saleId) {
      const existingDO = await prisma.deliveryOrder.findFirst({
        where: { saleId: validated.saleId },
      });
      if (existingDO) return { success: false, error: "Sale already has a delivery order" };
    }

    // ---------------------------------------------------------
    // 4. DATABASE TRANSACTION (DO + SALE + DEBT + STOCK)
    // ---------------------------------------------------------
    const result = await prisma.$transaction(async (tx) => {
      // A. Generate Nomor
      const doNumber = await generateDONumber();
      
      // B. Hitung Total Harga untuk Invoice
      let grandTotal = 0;
      const saleItemsData = [];

      for (const item of validated.items) {
        const productUnit = await tx.productUnit.findFirst({
          where: { productId: item.productId, unitId: item.unitId },
        });

        if (!productUnit) throw new Error(`Unit info missing for ${item.productId}`);

        const price = Number(productUnit.sellPrice);
        const subtotal = price * item.quantity;
        grandTotal += subtotal;

        saleItemsData.push({
          productId: item.productId,
          unitId: item.unitId,
          quantity: item.quantity,
          unitPrice: price,
          subtotal: subtotal,
          discount: 0
        });
      }

      // C. Logic Invoice & Hutang (Jika DO dibuat manual tanpa POS)
      let createdSaleId = validated.saleId; 

      if (!createdSaleId) {
        const invoiceNumber = await generateInvoiceNumber(tx);
        
        // Buat Sale (Status: PENDING/CREDIT)
        const newSale = await tx.sale.create({
          data: {
            invoiceNumber,
            customerId: validated.customerId,
            cashierId: session.user.id,
            paymentMethod: PaymentMethod.CREDIT, // Otomatis Hutang/Tempo
            status: "PENDING", // Belum Lunas
            totalAmount: grandTotal,
            tax: 0,
            discount: 0,
            grandTotal: grandTotal,
            paidAmount: 0,
            changeAmount: 0,
            notes: `Auto-Invoice DO: ${doNumber}. ${validated.notes || ""}`,
            saleItems: {
              create: saleItemsData
            }
          }
        });
        createdSaleId = newSale.id;

        // Buat Data Hutang (CustomerDebt)
        const debtNumber = await generateDebtNumber(tx);
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30); // Default Jatuh Tempo 30 Hari

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

      // D. Buat Delivery Order (Surat Jalan)
      const deliveryOrder = await tx.deliveryOrder.create({
        data: {
          doNumber,
          customerId: validated.customerId,
          saleId: createdSaleId,
          deliveryDate: validated.deliveryDate,
          driver: validated.driver,
          vehicle: validated.vehicle,
          notes: validated.notes,
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

      // E. Kurangi Stok Fisik & Catat Log
      for (const item of validated.items) {
        const pUnit = await tx.productUnit.findFirst({
            where: { productId: item.productId, unitId: item.unitId }
        });
        
        const conversion = Number(pUnit?.conversionValue || 1);
        const totalQtyBase = Number(item.quantity) * conversion;

        // Stock Movement
        await tx.stockMovement.create({
            data: {
                productId: item.productId,
                type: "OUT",
                quantity: totalQtyBase,
                referenceType: "DELIVERY_ORDER",
                referenceId: deliveryOrder.id,
                notes: `DO: ${doNumber}`,
                createdById: session.user.id
            }
        });
        
        // Update Product Stock
        await tx.product.update({
            where: { id: item.productId },
            data: {
                currentStock: {
                    decrement: totalQtyBase
                }
            }
        });
      }

      return deliveryOrder;
    });

    // Revalidate paths
    revalidatePath("/dashboard/delivery-orders");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/customer-debts");
    revalidatePath("/dashboard/products");

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

    return {
      success: true,
      message: `Delivery status updated to ${validated.status}`,
      data: {
        ...updated,
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

    // 2. PROTEKSI: Cek Status Pengiriman
    // Jika barang sudah sampai (DELIVERED) mungkin tidak boleh dihapus sembarangan
    // (Opsional, tergantung kebijakan Anda. Jika ingin fleksibel, komentar bagian ini)
    if (deliveryOrder.status === "DELIVERED") {
        return { success: false, error: "Tidak dapat menghapus DO yang sudah status DITERIMA" };
    }

    // 3. PROTEKSI UTAMA: Cek Apakah Sudah Ada Pembayaran?
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

    // 4. EKSEKUSI PENGHAPUSAN BERANTAI (TRANSAKSI)
    await prisma.$transaction(async (tx) => {
        
        // A. KEMBALIKAN STOK (RESTORE STOCK)
        // Karena DO dihapus, barang dianggap batal keluar -> stok balik ke gudang
        for (const item of deliveryOrder.deliveryItems) {
            // Ambil konversi unit item tersebut
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

            // 2. Hapus Log StockMovement terkait DO ini (agar kartu stok bersih)
            // Atau buat log baru type "IN" (Correction). 
            // Cara paling bersih jika "Delete DO" adalah menghapus history keluarnya.
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
            // Hapus SaleItem dulu (biasanya cascade, tapi aman ditulis manual)
            await tx.saleItem.deleteMany({
                where: { saleId: deliveryOrder.saleId }
            });
            
            // Hapus Sale Header
            await tx.sale.delete({
                where: { id: deliveryOrder.saleId }
            });
        }

        // D. Terakhir, Hapus Surat Jalan (DeliveryOrder)
        await tx.deliveryOrder.delete({
            where: { id }
        });
    });

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