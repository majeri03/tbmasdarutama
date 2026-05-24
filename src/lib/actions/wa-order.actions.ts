"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { WaOrderStatus } from "@prisma/client";

// ==================== TYPES ====================
export interface ParsedOrderItem {
  productName: string;
  productId?: string;
  unitName?: string;
  unitId?: string;
  quantity: number;
  notes?: string;
}

// ==================== GET ALL WA ORDERS ====================
export async function getWaOrders(status?: WaOrderStatus) {
  try {
    const where = status ? { status } : {};
    const orders = await prisma.waOrder.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      include: {
        confirmedBy: { select: { id: true, name: true } },
      },
    });
    return { success: true, data: orders };
  } catch (error) {
    console.error("[getWaOrders]", error);
    return { success: false, error: "Gagal mengambil data orderan WA" };
  }
}

// ==================== GET PENDING COUNT (untuk badge notif) ====================
export async function getWaOrderPendingCount() {
  try {
    const count = await prisma.waOrder.count({ where: { status: "PENDING" } });
    return { success: true, count };
  } catch {
    return { success: true, count: 0 };
  }
}

// ==================== REJECT WA ORDER ====================
export async function rejectWaOrder(id: string, reason?: string) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    await prisma.waOrder.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectedReason: reason || "Ditolak oleh admin",
        confirmedById: session.user.id,
        confirmedAt: new Date(),
      },
    });

    revalidatePath("/dashboard/wa-orders");
    return { success: true, message: "Orderan ditolak" };
  } catch (error) {
    console.error("[rejectWaOrder]", error);
    return { success: false, error: "Gagal menolak orderan" };
  }
}

// ==================== CONFIRM WA ORDER → BUAT DELIVERY ORDER ====================
export async function confirmWaOrder(
  id: string,
  data: {
    customerId: string;
    deliveryDate: Date;
    driver?: string;
    vehicle?: string;
    notes?: string;
    createDeliveryOrder?: boolean; // NEW: Optional Surat Jalan
    items: Array<{
      productId: string;
      unitId: string;
      quantity: number;
      notes?: string;
    }>;
  }
) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const waOrder = await prisma.waOrder.findUnique({ where: { id } });
    if (!waOrder) return { success: false, error: "Orderan WA tidak ditemukan" };
    if (waOrder.status !== "PENDING") return { success: false, error: "Orderan sudah diproses" };

    // Generate DO Number (Hanya jika createDeliveryOrder = true)
    let doNumber: string | undefined;
    const today = new Date();
    if (data.createDeliveryOrder !== false) {
      const prefix = `DO/${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}`;
      const lastDO = await prisma.deliveryOrder.findFirst({
        where: { doNumber: { startsWith: prefix } },
        orderBy: { doNumber: "desc" },
      });
      let nextNum = 1;
      if (lastDO) {
        const parts = lastDO.doNumber.split("/");
        const lastVal = parseInt(parts[parts.length - 1]);
        if (!isNaN(lastVal)) nextNum = lastVal + 1;
      }
      doNumber = `${prefix}/${String(nextNum).padStart(4, "0")}`;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Generate Invoice Number
      const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const lastSale = await tx.sale.findFirst({
        where: { invoiceNumber: { startsWith: `INV-${dateStr}` } },
        orderBy: { invoiceNumber: "desc" },
      });
      let invNum = 1;
      if (lastSale) {
        const parts = lastSale.invoiceNumber.split("-");
        const lastVal = parseInt(parts[2]);
        if (!isNaN(lastVal)) invNum = lastVal + 1;
      }
      const invoiceNumber = `INV-${dateStr}-${String(invNum).padStart(3, "0")}`;

      // Kalkulasi grand total
      let grandTotal = 0;
      const saleItemsData = [];
      for (const item of data.items) {
        const pu = await tx.productUnit.findFirst({
          where: { productId: item.productId, unitId: item.unitId },
        });
        const price = Number(pu?.sellPrice || 0);
        const subtotal = price * item.quantity;
        grandTotal += subtotal;
        saleItemsData.push({
          productId: item.productId,
          unitId: item.unitId,
          quantity: item.quantity,
          unitPrice: price,
          subtotal,
          discount: 0,
        });
      }

      // Buat Sale
      const newSale = await tx.sale.create({
        data: {
          invoiceNumber,
          customerId: data.customerId,
          cashierId: session.user.id,
          paymentMethod: "CREDIT",
          status: "PENDING",
          totalAmount: grandTotal,
          tax: 0,
          discount: 0,
          grandTotal,
          paidAmount: 0,
          changeAmount: 0,
          notes: `Dari orderan WA - ${waOrder.senderName} (${waOrder.senderPhone})`,
          saleItems: { create: saleItemsData },
        },
      });

      // Buat Hutang Customer
      const lastDebt = await tx.customerDebt.findFirst({
        where: { debtNumber: { startsWith: "DEBT-CUST-" } },
        orderBy: { debtNumber: "desc" },
      });
      let debtNum = 1;
      if (lastDebt) {
        const parts = lastDebt.debtNumber.split("-");
        const lastVal = parseInt(parts[2]);
        if (!isNaN(lastVal)) debtNum = lastVal + 1;
      }
      const debtNumber = `DEBT-CUST-${String(debtNum).padStart(3, "0")}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      await tx.customerDebt.create({
        data: {
          debtNumber,
          saleId: newSale.id,
          customerId: data.customerId,
          totalDebt: grandTotal,
          paidAmount: 0,
          remainingDebt: grandTotal,
          status: "UNPAID",
          dueDate,
          notes: `Dari orderan WA - ${waOrder.senderName}`,
        },
      });

      // Buat Delivery Order (Jika diminta)
      let deliveryOrder = null;
      if (data.createDeliveryOrder !== false && doNumber) {
        deliveryOrder = await tx.deliveryOrder.create({
          data: {
            doNumber,
            customerId: data.customerId,
            saleId: newSale.id,
            deliveryDate: data.deliveryDate,
            driver: data.driver,
            vehicle: data.vehicle,
            notes: data.notes || waOrder.rawMessage,
            status: "PENDING",
            createdById: session.user.id,
            deliveryItems: {
              create: data.items.map((item) => ({
                productId: item.productId,
                unitId: item.unitId,
                quantity: item.quantity,
                notes: item.notes,
              })),
            },
          },
        });
      }

      // Update WA Order jadi CONFIRMED
      await tx.waOrder.update({
        where: { id },
        data: {
          status: "CONFIRMED",
          confirmedById: session.user.id,
          confirmedAt: new Date(),
          deliveryOrderId: deliveryOrder?.id,
          saleId: newSale.id,
        },
      });

      return { deliveryOrder, invoiceNumber };
    }, { maxWait: 5000, timeout: 20000 });

    revalidatePath("/dashboard/wa-orders");
    revalidatePath("/dashboard/delivery-orders");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/customer-debts");

    return {
      success: true,
      message: result.deliveryOrder 
        ? `Orderan dikonfirmasi! Surat Jalan ${result.deliveryOrder.doNumber} berhasil dibuat.`
        : `Orderan dikonfirmasi! Transaksi POS ${result.invoiceNumber} berhasil dibuat.`,
      data: result,
    };
  } catch (error) {
    console.error("[confirmWaOrder]", error);
    return { success: false, error: error instanceof Error ? error.message : "Gagal konfirmasi orderan" };
  }
}
