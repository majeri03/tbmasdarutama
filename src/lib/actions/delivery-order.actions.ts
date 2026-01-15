"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { DeliveryStatus, Prisma } from "@prisma/client";
import {
  createDeliveryOrderSchema,
  updateDeliveryStatusSchema,
  CreateDeliveryOrderInput,
  UpdateDeliveryStatusInput,
} from "@/lib/validations/delivery-order.schema";
import { requirePermission } from "../utils/role";
// ==================== GENERATE DO NUMBER ====================
async function generateDONumber(): Promise<string> {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");

  const prefix = `DO/${year}${month}`;

  // Find last DO with same prefix
  const lastDO = await prisma.deliveryOrder.findFirst({
    where: {
      doNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      doNumber: "desc",
    },
  });

  let nextNumber = 1;

  if (lastDO) {
    // Extract number from format: DO/202501/0001
    const parts = lastDO.doNumber.split("/");
    const lastNumber = parseInt(parts[parts.length - 1]);

    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `${prefix}/${String(nextNumber).padStart(4, "0")}`;
}
// ==================== GET ALL DELIVERY ORDERS ====================
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

// ==================== GET DELIVERY ORDER STATISTICS ====================
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

// ==================== GET DELIVERY ORDER BY ID ====================
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

// ==================== CREATE DELIVERY ORDER ====================
export async function createDeliveryOrder(input: CreateDeliveryOrderInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "CREATE_DELIVERY_ORDER");
    const validated = createDeliveryOrderSchema.parse(input);
    // ✅ Check stock availability
    for (const item of validated.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: {
          id: true,
          name: true,
          currentStock: true,
          productUnits: {
            include: {
              unit: true,
            },
          },
        },
      });

      if (!product) {
        return {
          success: false,
          error: `Product not found: ${item.productId}`,
        };
      }

      // Get primary unit
      const primaryUnit = product.productUnits.find((pu) => pu.isPrimary);
      if (!primaryUnit) {
        return {
          success: false,
          error: `No primary unit for product: ${product.name}`,
        };
      }

      // Get item unit conversion
      const itemUnit = product.productUnits.find(
        (pu) => pu.unitId === item.unitId
      );
      if (!itemUnit) {
        return {
          success: false,
          error: `Invalid unit for product: ${product.name}`,
        };
      }

      // Calculate required stock in primary unit
      const requiredStock = item.quantity * Number(itemUnit.conversionValue);

      if (Number(product.currentStock) < requiredStock) {
        return {
          success: false,
          error: `Insufficient stock for ${product.name}. Available: ${product.currentStock} ${primaryUnit.unit.name}, Required: ${requiredStock} ${primaryUnit.unit.name}`,
        };
      }
    }
    // Generate DO Number
    const doNumber = await generateDONumber();

    // Check if saleId already has delivery order
    if (validated.saleId) {
      const existingDO = await prisma.deliveryOrder.findFirst({
        where: { saleId: validated.saleId },
      });
      if (existingDO) {
        return {
          success: false,
          error: "Sale already has a delivery order",
        };
      }
    }

    // Create delivery order with items
    const deliveryOrder = await prisma.deliveryOrder.create({
      data: {
        doNumber,
        customerId: validated.customerId,
        saleId: validated.saleId,
        deliveryDate: validated.deliveryDate,
        driver: validated.driver,
        vehicle: validated.vehicle,
        notes: validated.notes,
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
      message: `Delivery order ${doNumber} created successfully`,
      data: {
        ...deliveryOrder,
        deliveryItems: deliveryOrder.deliveryItems.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
        })),
      },
    };
  } catch (error) {
    console.error("Error creating delivery order:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to create delivery order" };
  }
}

// ==================== UPDATE DELIVERY STATUS ====================
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
      deliveryOrder.status === "DELIVERED" && validated.status === "CANCELLED";

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

// ==================== DELETE DELIVERY ORDER ====================
export async function deleteDeliveryOrder(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    requirePermission(session, "DELETE_DELIVERY_ORDER");

    const deliveryOrder = await prisma.deliveryOrder.findUnique({
      where: { id },
    });

    if (!deliveryOrder) {
      return { success: false, error: "Delivery order not found" };
    }

    if (
      deliveryOrder.status === DeliveryStatus.DELIVERED ||
      deliveryOrder.status === DeliveryStatus.IN_TRANSIT
    ) {
      return {
        success: false,
        error: "Cannot delete delivered or in-transit delivery order",
      };
    }

    await prisma.deliveryOrder.delete({
      where: { id },
    });

    revalidatePath("/dashboard/delivery-orders");

    return {
      success: true,
      message: `Delivery order ${deliveryOrder.doNumber} deleted successfully`,
    };
  } catch (error) {
    console.error("Error deleting delivery order:", error);
    return { success: false, error: "Failed to delete delivery order" };
  }
}
