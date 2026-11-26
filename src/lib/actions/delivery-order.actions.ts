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
import {
  confirmR2File,
  deleteR2FileByUrl,
  deleteR2FilesByKeys,
  extractTagKeys,
} from "../utils/r2-tracking";
import {
  loadUnitNames,
  primaryQuantityOrThrow,
  decrementStockOrThrow,
  withUniqueRetry,
  generateDebtNumber,
} from "@/lib/utils/stock-units";

// WS-4 (26 Nov 2026): plat kendaraan adalah TURUNAN sopir — DO tidak
// boleh menyimpan sopir A dengan plat sopir B. API create DO hanya
// menerima string driver/vehicle (tidak ada driverUserId/vehicleId di
// schema), jadi validasi pasangan dilakukan di sini terhadap tabel
// FleetVehicle, tanpa perubahan schema database.
function extractPlateNumber(vehicle: string): string {
  return vehicle.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function normalizePlateNumber(plate: string): string {
  return plate.trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * Kembalikan pesan error bila pasangan sopir-kendaraan tidak cocok, atau
 * null bila boleh disimpan. Sopir yang TIDAK ada di data armada dibiarkan
 * lolos (sopir luar/borongan, plat diisi manual) — yang dicegah hanyalah
 * plat milik sopir armada lain.
 */
async function validateDriverVehiclePair(
  driver: string | null | undefined,
  vehicle: string | null | undefined
): Promise<string | null> {
  const driverName = (driver || "").trim();
  const vehicleRaw = (vehicle || "").trim();
  if (!driverName || !vehicleRaw) return null;
  const plate = normalizePlateNumber(extractPlateNumber(vehicleRaw));
  if (!plate) return null;
  const fleet = await prisma.fleetVehicle.findMany({
    where: {
      driverName: { equals: driverName, mode: "insensitive" },
      isActive: true,
    },
    select: { driverName: true, plateNumber: true },
  });
  const mine = fleet.filter(
    (f) => f.driverName.trim().toLowerCase() === driverName.toLowerCase()
  );
  if (mine.length === 0) return null;
  const ok = mine.some(
    (f) => normalizePlateNumber(f.plateNumber) === plate
  );
  if (ok) return null;
  const plates = mine.map((f) => f.plateNumber).join(", ");
  return `Plat ${plate} bukan kendaraan sopir ${driverName}. Kendaraan ${driverName}: ${plates}.`;
}

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

//    GENERATE DO NUMBER
async function generateDONumber(tx: Prisma.TransactionClient): Promise<string> {
  // DO memakai YYYYMM saja (bukan YYYYMMDD) — 6 digit pertama prefiks WITA.
  const prefix = `DO/${getWitaDatePrefix().slice(0, 6)}`;

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
  // FIX (22 Nov 2026): paginasi — sebelumnya seluruh tabel dikembalikan.
  page?: number;
  limit?: number;
}, externalSession?: AuthSession | null) {
  const session = externalSession || (await auth());
  try {
    // FIX PENTEST (22 Nov 2026, L27): requirePermission dipindah ke DALAM
    // try supaya kegagalan auth tidak lolos sebagai 500 generik.
    requirePermission(session, "VIEW_DELIVERY_ORDERS");
    // KEPUTUSAN PEMILIK (22 Nov 2026, pentest H6 — BY-DESIGN): KASIR BOLEH
    // membaca SEMUA Surat Jalan toko (tanpa filter pemilik) karena kasir
    // ikut mengerjakan DO. Bukan kebocoran.
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

    // Default 50 baris terbaru (dashboard web tidak punya pager UI);
    // API bisa minta page/limit eksplisit. Maksimal 100 per halaman.
    const page = Math.max(1, Math.floor(filters?.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Math.floor(filters?.limit ?? 50) || 50));
    const skip = (page - 1) * limit;

    const [deliveryOrders, total] = await Promise.all([
      prisma.deliveryOrder.findMany({
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
      take: limit,
      skip,
    }),
      prisma.deliveryOrder.count({ where }),
    ]);

    // Serialize Decimal & resolve proofImage
    const serialized = deliveryOrders.map((order) => ({
      ...order,
      proofImage: resolveProofImage(order.proofImage, order.notes),
      deliveryItems: order.deliveryItems.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
      })),
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
    console.error("Error fetching delivery orders:", error);
    // FIX PENTEST (22 Nov 2026, L27): kegagalan auth tetap dikembalikan
    // sebagai Unauthorized (bukan pesan generik).
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to fetch delivery orders" };
  }
}

//    GET DELIVERY ORDER STATISTICS   
export async function getDeliveryOrderStatistics() {
  const session = await auth();
  try {
    // FIX PENTEST (22 Nov 2026, L27): requirePermission dipindah ke DALAM
    // try supaya kegagalan auth tidak lolos sebagai 500 generik.
    requirePermission(session, "VIEW_DELIVERY_ORDERS");
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
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to fetch statistics" };
  }
}

//    GET DELIVERY ORDER BY ID   
export async function getDeliveryOrderById(id: string, externalSession?: AuthSession | null) {
  const session = externalSession || (await auth());
  try {
    // FIX PENTEST (22 Nov 2026, L27): requirePermission dipindah ke DALAM
    // try supaya kegagalan auth tidak lolos sebagai 500 generik.
    requirePermission(session, "VIEW_DELIVERY_ORDERS");
    // KEPUTUSAN PEMILIK (22 Nov 2026, pentest H6 — BY-DESIGN): KASIR BOLEH
    // membaca detail Surat Jalan mana pun (ikut mengerjakan DO). Bukan IDOR.
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
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to fetch delivery order" };
  }
}

async function generateInvoiceNumber(tx: Prisma.TransactionClient) {
  // FIX (25 Nov 2026, ws-j2 item 139): tanggal prefiks memakai WITA —
  // lihat getWitaDatePrefix di atas (generateDONumber).
  const dateStr = getWitaDatePrefix();

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

// Nomor hutang: pakai generator bersama di stock-units.ts (dipakai POS juga).
// Dulu fungsi lokal di sini memakai count()+1 dengan format 5 digit
// (DEBT-CUST-00001) — dua urutan nomor untuk kolom yang sama, dan nomor lama
// bisa dipakai ulang kalau satu hutang dihapus.


// Pastikan import PaymentMethod ada di paling atas file
// import { DeliveryStatus, Prisma, PaymentMethod } from "@prisma/client";

export async function createDeliveryOrder(input: CreateDeliveryOrderInput, externalSession?: AuthSession | null) {
  try {
    // FIX PENTEST (22 Nov 2026, M18): sesi dari route (Bearer mobile).
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "CREATE_DELIVERY_ORDER");
    // FIX BUILD (22 Nov 2026, z3): id disimpan ke const di sini — di dalam
    // callback transaksi, TypeScript melupakan hasil cek session.user di
    // atas, jadi pemakaian session.user.id langsung selalu error.
    const userId = session.user.id;

    // 1. Validasi Input Zod
    const validated = createDeliveryOrderSchema.parse(input);

    // 1b. WS-4: plat harus milik sopir yang dipilih (bila sopir ada di armada).
    const pairError = await validateDriverVehiclePair(validated.driver, validated.vehicle);
    if (pairError) return { success: false, error: pairError };

    // 2. VALIDASI STOK (FIX QA B-1: konversi DIBAGI ke satuan utama, agregat
    // per produk supaya 2 baris produk yang sama tidak lolos sendiri-sendiri)
    {
      const productIds = Array.from(new Set(validated.items.map((it) => it.productId)));
      const checkProducts = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          currentStock: true,
          productUnits: { include: { unit: true } },
        },
      });
      const needByProduct = new Map<string, number>();
      for (const item of validated.items) {
        const product = checkProducts.find((p) => p.id === item.productId);
        if (!product) {
          return { success: false, error: `Produk tidak ditemukan: ${item.productId}` };
        }
        const itemUnit = product.productUnits.find((pu) => pu.unitId === item.unitId);
        if (!itemUnit) {
          return { success: false, error: `Satuan tidak valid untuk produk: ${product.name}` };
        }
        let qtyPrimary: number;
        try {
          qtyPrimary = primaryQuantityOrThrow({
            quantity: item.quantity,
            conversionValue: Number(itemUnit.conversionValue),
            productName: product.name,
            unitName: itemUnit.unit?.name || "satuan",
          });
        } catch (e) {
          return { success: false, error: e instanceof Error ? e.message : "Item tidak valid." };
        }
        needByProduct.set(item.productId, (needByProduct.get(item.productId) || 0) + qtyPrimary);
      }
      for (const [productId, need] of needByProduct.entries()) {
        const product = checkProducts.find((p) => p.id === productId)!;
        if (Number(product.currentStock) < need) {
          return {
            success: false,
            error: `Stok ${product.name} tidak cukup. Tersedia: ${product.currentStock} (satuan utama), Butuh: ${need}`,
          };
        }
      }
    }

    // 3. Cek Duplikasi Sale ID + validasi sale yang dipilih
    if (validated.saleId) {
      const existingDO = await prisma.deliveryOrder.findFirst({
        where: { saleId: validated.saleId },
      });
      if (existingDO) return { success: false, error: "Transaksi ini sudah dibuatkan Surat Jalan." };
      // Penjualan harus ada, belum batal/return, dan milik pelanggan yang sama
      // dengan yang dipilih di form (dulu tidak dicek: DO bisa nyambung ke
      // invoice pelanggan lain).
      const sale = await prisma.sale.findUnique({
        where: { id: validated.saleId },
        select: { id: true, customerId: true, status: true },
      });
      if (!sale) return { success: false, error: "Transaksi penjualan tidak ditemukan." };
      if (sale.status === "CANCELLED" || sale.status === "RETURN") {
        return { success: false, error: "Transaksi penjualan sudah dibatalkan / di-return." };
      }
      if (sale.customerId !== validated.customerId) {
        return { success: false, error: "Penjualan yang dipilih milik pelanggan lain." };
      }
    }

    // OPTIMISASI: PERSIAPAN DATA (PRE-CALCULATION)
    
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

    }

    // 4. DATABASE TRANSACTION (OPTIMIZED)
    // Diulang kalau nomor DO/invoice/hutang tabrakan (M-2).
    const txResult = await withUniqueRetry(() =>
      prisma.$transaction(async (tx) => {
      // A. Generate Nomor Surat Jalan
      const doNumber = await generateDONumber(tx);

      // Cek duplikasi lagi DI DALAM transaksi: cek di luar (langkah 3) bisa
      // lolos kalau dua admin kirim bersamaan. Di sini yang kedua gagal
      // dengan pesan yang jelas, bukan error Prisma mentah.
      if (validated.saleId) {
        const dupInTx = await tx.deliveryOrder.findFirst({ where: { saleId: validated.saleId } });
        if (dupInTx) throw new Error("Transaksi ini sudah dibuatkan Surat Jalan.");
      }

      // B. Logic Invoice Otomatis (Jika DO dibuat manual tanpa POS)
      let createdSaleId = validated.saleId;
      let autoInvoiceNumber: string | null = null;

      if (!createdSaleId) {
        const invoiceNumber = await generateInvoiceNumber(tx);
        autoInvoiceNumber = invoiceNumber;
        
        // Buat Sale Baru
        const newSale = await tx.sale.create({
          data: {
            invoiceNumber,
            customerId: validated.customerId,
            cashierId: userId,
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
          createdById: userId,
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

      return { deliveryOrder, autoInvoiceNumber };
    },
    // KONFIGURASI TIMEOUT: 20 Detik
    {
        maxWait: 5000,
        timeout: 20000
    }));

    const { deliveryOrder: result, autoInvoiceNumber } = txResult;

    // FIX (22 Nov 2026, R2): bukti pengiriman di DO baru dikonfirmasi
    // ACTIVE milik DO ini (proofImage + tag di notes).
    const createdProof = resolveProofImage(result.proofImage, result.notes);
    if (createdProof) await confirmR2File(createdProof, "DELIVERY_PROOF", result.id);
    for (const key of extractTagKeys(result.notes, ["BUKTI_KIRIM", "FOTO_LOKASI"])) {
      await confirmR2File(key, "DELIVERY_PROOF", result.id);
    }

    // Revalidate semua halaman terkait
    revalidatePath("/dashboard/delivery-orders");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/customer-debts");
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/stocks");

    // Notifikasi DO baru — SATU sistem saja (NotificationService / Sistem A),
    // supaya sampai ke SUPER_ADMIN juga. Dulu pakai NotifEvent (Sistem B) yang
    // token-nya difilter role tepat "ADMIN", jadi akun owner tidak dapat push.
    // PENDING sudah punya label "📦 Surat Jalan Baru Siap Muat" di onDeliveryUpdate.
    try {
      const { NotificationService } = await import("@/lib/services/notification.service");
      NotificationService.onDeliveryUpdate(result.id, result.doNumber, "PENDING").catch((e) =>
        console.error("[Notif] Error notifying new delivery order:", e),
      );
    } catch (e) {
      console.error("[Notif] Delivery notification dispatch error (createDeliveryOrder):", e);
    }

    return {
      success: true,
      message: `Surat Jalan ${result.doNumber} berhasil dibuat!`,
      data: {
        ...result,
        // Nomor invoice otomatis (hanya untuk DO manual tanpa POS) — supaya
        // web/APK bisa menampilkannya ke pengguna, dulu tidak dikembalikan.
        autoInvoiceNumber,
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
export async function updateDeliveryStatus(input: UpdateDeliveryStatusInput, externalSession?: AuthSession | null) {
  try {
    // FIX PENTEST (22 Nov 2026, M18): sesi dari route (Bearer mobile).
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "UPDATE_DELIVERY_STATUS");
    // FIX BUILD (22 Nov 2026, z3): id disimpan ke const di sini — di dalam
    // callback transaksi, TypeScript melupakan hasil cek session.user di
    // atas, jadi pemakaian session.user.id langsung selalu error.
    const userId = session.user.id;
    const validated = updateDeliveryStatusSchema.parse(input);

    // FIX PENTEST (22 Nov 2026, H5): KASIR hanya boleh mengubah status ke
    // IN_TRANSIT. CANCELLED (menghapus hutang auto-DO) dan DELIVERED
    // (memotong stok) khusus ADMIN+ — dicek di sini, bukan hanya di route,
    // supaya pemanggil server-action langsung juga tertahan.
    if (validated.status === "CANCELLED") {
      requirePermission(session, "CANCEL_DELIVERY_ORDER");
    } else if (validated.status === "DELIVERED") {
      requirePermission(session, "CONFIRM_DELIVERY_ORDER");
    }

    const deliveryOrder = await prisma.deliveryOrder.findUnique({
      where: { id: validated.id },
      include: {
        deliveryItems: {
          include: {
            product: true,
          },
        },
        customer: true,
        sale: {
          include: { customerDebts: true },
        },
      },
    });

    if (!deliveryOrder) {
      return { success: false, error: "Delivery order not found" };
    }

    // FIX QA (M-9): state machine — hanya transisi yang masuk akal, dan status
    // terminal (DELIVERED / CANCELLED) tidak bisa diubah lagi.
    // FIX WS-H (25 Nov 2026, batch 4 item 120): DELIVERED -> DELIVERED
    // diizinkan sebagai "refresh" — BUKAN perubahan status, hanya untuk
    // mengganti/menambah foto bukti atau memperbaiki nama penerima DO yang
    // sudah terkirim. Tanpa ini, tombol Update Status untuk DO Terkirim
    // (yang kini ditampilkan di tabel) selalu ditolak server. Refresh ini
    // TIDAK memotong stok lagi (lihat pengaman `from !== "DELIVERED"` di
    // bawah) dan TIDAK mengirim notifikasi baru.
    const ALLOWED: Record<string, string[]> = {
      PENDING: ["IN_TRANSIT", "DELIVERED", "CANCELLED"],
      IN_TRANSIT: ["DELIVERED", "CANCELLED"],
      DELIVERED: ["DELIVERED"],
      CANCELLED: [],
    };
    const from = deliveryOrder.status;
    if (!ALLOWED[from].includes(validated.status)) {
      return { success: false, error: `Status ${from} tidak bisa diubah ke ${validated.status}.` };
    }
    const isDeliveredRefresh = from === "DELIVERED" && validated.status === "DELIVERED";

    // Penjualan yang dibuat otomatis oleh DO ini (bukan penjualan POS asli).
    const isAutoSale = !!deliveryOrder.sale?.notes?.startsWith("Auto-Invoice DO:");

    // ---- CANCELLED (dari PENDING / IN_TRANSIT): stok TIDAK pernah dipotong di
    // status ini, jadi tidak ada yang dikembalikan (M-12). Hutang & penjualan
    // hanya disentuh kalau penjualannya dibuat otomatis oleh DO ini; penjualan
    // POS asli tidak boleh ikut terhapus / ternolkan.
    if (validated.status === "CANCELLED") {
      const paidDebt = deliveryOrder.sale?.customerDebts?.find((d) => Number(d.paidAmount) > 0);
      if (isAutoSale && paidDebt) {
        return {
          success: false,
          error: `Tidak dapat membatalkan: hutang ini sudah dibayar Rp ${Number(paidDebt.paidAmount).toLocaleString("id-ID")}.`,
        };
      }
      await prisma.$transaction(async (tx) => {
        // Klaim status di DALAM transaksi: kalau admin lain sudah mengubah
        // status DO ini barusan, updateMany kena 0 baris dan transaksi batal.
        const claimedCancel = await tx.deliveryOrder.updateMany({
          where: { id: validated.id, status: from },
          data: { status: "CANCELLED" },
        });
        if (claimedCancel.count === 0) throw new Error("Status surat jalan sudah berubah, muat ulang dulu.");
        if (isAutoSale && deliveryOrder.saleId) {
          await tx.customerDebt.deleteMany({ where: { saleId: deliveryOrder.saleId } });
          await tx.sale.update({
            where: { id: deliveryOrder.saleId },
            data: {
              status: "CANCELLED",
              totalAmount: 0,
              grandTotal: 0,
              notes: `Dibatalkan dari DO: ${deliveryOrder.doNumber}`,
            },
          });
        }
        await tx.deliveryOrder.update({
          where: { id: validated.id },
          data: { status: "CANCELLED" },
        });
      });
      revalidatePath("/dashboard/delivery-orders");
      // FIX (22 Nov 2026): pembatalan DO sebelumnya senyap total — cabang
      // CANCELLED tidak pernah memanggil onDeliveryUpdate. Sekarang
      // ternotifikasi seperti IN_TRANSIT / DELIVERED (fire-and-forget).
      try {
        const { NotificationService } = await import("@/lib/services/notification.service");
        NotificationService.onDeliveryUpdate(deliveryOrder.id, deliveryOrder.doNumber, "CANCELLED").catch((e) =>
          console.error("[Notif] Error notifying delivery cancellation:", e),
        );
      } catch (e) {
        console.error("[Notif] Delivery cancellation notification dispatch error:", e);
      }
      // Dulu tanpa `data`, padahal route PUT memanggil
      // successResponse(result.data, ...) — type error di build.
      return {
        success: true,
        message: "Pengiriman dibatalkan.",
        data: {
          ...deliveryOrder,
          status: "CANCELLED",
          deliveryItems: deliveryOrder.deliveryItems.map((item) => ({
            ...item,
            quantity: Number(item.quantity),
          })),
        },
      };
    }

    // ---- IN_TRANSIT / DELIVERED: semua dalam SATU transaksi (M-14).
    const updated = await prisma.$transaction(async (tx) => {
      // Klaim status di DALAM transaksi (lihat CANCELLED di atas).
      const claimed = await tx.deliveryOrder.updateMany({
        where: { id: validated.id, status: from },
        data: { status: validated.status },
      });
      if (claimed.count === 0) throw new Error("Status surat jalan sudah berubah, muat ulang dulu.");
      // FIX WS-H (25 Nov 2026, item 120): refresh DELIVERED -> DELIVERED
      // tidak boleh memotong stok lagi — stok sudah dipotong saat DO ini
      // pertama kali dinyatakan Terkirim. Tanpa pengaman ini, setiap
      // ganti foto bukti akan memotong stok kedua kalinya.
      if (validated.status === "DELIVERED" && from !== "DELIVERED") {
        // Apakah penjualan terkait sudah memotong stok saat dibuat? (B-5)
        // Kalau ya (penjualan POS / manual), DO tidak boleh memotong lagi.
        let saleAlreadyDeducted = false;
        if (deliveryOrder.saleId) {
          const saleMovements = await tx.stockMovement.findMany({
            where: {
              referenceId: deliveryOrder.saleId,
              referenceType: { in: ["Sale", "POS_SALE", "Sale Edit"] },
              type: "OUT",
            },
            select: { id: true },
            take: 1,
          });
          saleAlreadyDeducted = saleMovements.length > 0;
        }

        if (!saleAlreadyDeducted) {
          // Hitung kebutuhan stok dalam satuan utama (DIBAGI, harus bulat).
          const unitNames = await loadUnitNames();
          const needByProduct = new Map<string, { qtyPrimary: number; name: string }>();
          for (const item of deliveryOrder.deliveryItems) {
            const pu = await tx.productUnit.findFirst({
              where: { productId: item.productId, unitId: item.unitId },
            });
            if (!pu) {
              throw new Error(`Satuan untuk ${item.product?.name || "produk"} tidak ditemukan di master.`);
            }
            const qtyPrimary = primaryQuantityOrThrow({
              // BUILD FIX (Nov 2026): item di sini dari database
              // (DeliveryItem.quantity bertipe Decimal di Prisma),
              // sedangkan helper-nya minta number biasa.
              quantity: Number(item.quantity),
              conversionValue: Number(pu.conversionValue),
              productName: item.product?.name || "Produk",
              unitName: unitNames.get(item.unitId) || "satuan",
            });
            const prev = needByProduct.get(item.productId);
            needByProduct.set(item.productId, {
              qtyPrimary: (prev?.qtyPrimary ?? 0) + qtyPrimary,
              name: item.product?.name || "Produk",
            });
          }
          for (const [productId, need] of needByProduct.entries()) {
            await decrementStockOrThrow(tx, productId, need.qtyPrimary, need.name);
            await tx.stockMovement.create({
              data: {
                productId,
                type: "OUT",
                quantity: need.qtyPrimary,
                referenceType: "DELIVERY_ORDER",
                referenceId: deliveryOrder.id,
                notes: `Pengiriman ke ${deliveryOrder.customer.name}`,
                createdById: userId,
              },
            });
          }
        }
      }

      return tx.deliveryOrder.update({
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
    });

    // FIX (22 Nov 2026, R2): bukti baru saat ubah status dikonfirmasi
    // ACTIVE; bukti lama yang tertimpa dihapus dari R2.
    const oldStatusProof = resolveProofImage(deliveryOrder.proofImage, deliveryOrder.notes);
    const statusProof = resolveProofImage(updated.proofImage, updated.notes);
    if (oldStatusProof && oldStatusProof !== statusProof) {
      await deleteR2FileByUrl(oldStatusProof);
    }
    if (statusProof) await confirmR2File(statusProof, "DELIVERY_PROOF", updated.id);

    revalidatePath("/dashboard/delivery-orders");

    // Notifikasi perubahan status DO — SATU sistem saja (Sistem A).
    // Dulu di sini Sistem B + route PUT memanggil Sistem A lagi = dobel.
    // Route PUT tidak lagi memanggil onDeliveryUpdate (lihat route.ts).
    // FIX WS-H (25 Nov 2026, item 120): refresh DELIVERED -> DELIVERED
    // bukan perubahan status, jadi tidak mengirim notifikasi baru.
    if (!isDeliveredRefresh) {
      try {
        const { NotificationService } = await import("@/lib/services/notification.service");
        NotificationService.onDeliveryUpdate(updated.id, updated.doNumber, validated.status).catch((e) =>
          console.error("[Notif] Error notifying delivery status:", e),
        );
      } catch (e) {
        console.error("[Notif] Delivery status notification dispatch error:", e);
      }
    }

    return {
      success: true,
      message: isDeliveredRefresh
        ? "Bukti pengiriman berhasil diperbarui."
        : `Delivery status updated to ${validated.status}`,
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


//         UPDATE DELIVERY ORDER (EDIT SURAT JALAN OLEH ADMIN / SUPERADMIN)
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

    // FIX WS-H (25 Nov 2026, batch 4 item 118): status & tanda terima
    // TIDAK boleh diubah lewat Edit — status hanya lewat
    // updateDeliveryStatus (ada efek stoknya), edit hanya untuk
    // tanggal/supir/kendaraan/alamat/catatan/bukti. Guard ini dipertahankan
    // sebagai pertahanan lapis kedua (modal Edit sudah tidak lagi mengirim
    // field-field ini), dan juga melindungi route API /api/delivery-orders.
    if (validated.status !== undefined) {
      return { success: false, error: "Status Surat Jalan tidak bisa diubah lewat Edit. Pakai menu Ubah Status." };
    }
    if (validated.receivedBy !== undefined || validated.receivedDate !== undefined) {
      return { success: false, error: "Penerima / tanggal terima hanya bisa diisi saat mengubah status ke DITERIMA." };
    }
    // FIX WS-H (25 Nov 2026, batch 4 item 118/120): DO yang sudah
    // TERKIRIM tetap boleh diedit metadata-nya (tanggal, sopir,
    // kendaraan, catatan, foto bukti) — tanpa mengubah status, jadi tidak
    // ada efek stok. Sebelumnya blok ini menolak SEMUA edit atas DO
    // DELIVERED, sehingga foto bukti DO terkirim tidak bisa diganti atau
    // dihapus lewat Edit. Yang tetap terminal dan tidak bisa diedit
    // hanyalah DO yang DIBATALKAN.
    if (existingDO.status === "CANCELLED") {
      return { success: false, error: "Surat Jalan yang sudah dibatalkan tidak bisa diedit." };
    }

    // WS-4: validasi pasangan sopir-kendaraan hanya bila salah satunya
    // diubah — DO lama yang pasangannya sudah terlanjur tidak cocok tetap
    // bisa diedit field lain tanpa dipaksa memperbaiki pasangan ini.
    if (validated.driver !== undefined || validated.vehicle !== undefined) {
      const effDriver = validated.driver !== undefined ? validated.driver : existingDO.driver;
      const effVehicle = validated.vehicle !== undefined ? validated.vehicle : existingDO.vehicle;
      const pairError = await validateDriverVehiclePair(effDriver, effVehicle);
      if (pairError) return { success: false, error: pairError };
    }

    // FIX (22 Nov 2026, R2): catat bukti lama SEBELUM ditimpa — ganti bukti
    // tanpa hapus yang lama adalah kebocoran terbesar (file lama yatim).
    const oldProofImage = existingDO.proofImage;
    const oldNoteKeys = extractTagKeys(existingDO.notes, ["BUKTI_KIRIM", "FOTO_LOKASI"]);

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

    // FIX (22 Nov 2026, R2): bukti diganti -> hapus file lama dari R2;
    // bukti baru dikonfirmasi ACTIVE milik DO ini. Tag di notes yang
    // hilang ikut dibersihkan filenya.
    const newProofImage = resolveProofImage(updated.proofImage, updated.notes);
    if (oldProofImage && oldProofImage !== newProofImage) {
      await deleteR2FileByUrl(oldProofImage);
    }
    const newNoteKeys = extractTagKeys(updated.notes, ["BUKTI_KIRIM", "FOTO_LOKASI"]);
    for (const oldKey of oldNoteKeys) {
      if (!newNoteKeys.includes(oldKey)) await deleteR2FileByUrl(oldKey);
    }
    if (newProofImage) await confirmR2File(newProofImage, "DELIVERY_PROOF", updated.id);

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
export async function deleteDeliveryOrder(id: string, externalSession?: AuthSession | null) {
  try {
    // FIX PENTEST (22 Nov 2026, M18): sesi dari route (Bearer mobile).
    const session = externalSession || (await auth());
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
    // FIX (22 Nov 2026, R2): tag [BUKTI_KIRIM] / [FOTO_LOKASI] di notes
    // ikut dikumpulkan — sebelumnya tidak pernah, jadi file tag legacy
    // yatim setiap DO dihapus.
    const photosToDelete: string[] = [];
    if (deliveryOrder.proofImage) photosToDelete.push(deliveryOrder.proofImage);
    if (deliveryOrder.deliveryPhotos && deliveryOrder.deliveryPhotos.length > 0) {
      deliveryOrder.deliveryPhotos.forEach((p) => {
        if (p.filename) photosToDelete.push(p.filename);
        else if (p.url) photosToDelete.push(p.url);
      });
    }
    photosToDelete.push(...extractTagKeys(deliveryOrder.notes, ["BUKTI_KIRIM", "FOTO_LOKASI"]));

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
        
        // A. STOK: tidak ada yang dikembalikan (M-12). DO yang bisa dihapus
        // hanya PENDING / IN_TRANSIT / CANCELLED (DELIVERED ditolak di atas),
        // dan di status itu stok belum pernah dipotong. Memulihkan stok di sini
        // justru MENCIPTAKAN stok dari nol.
        // B/C. Hapus hutang & penjualan HANYA kalau penjualannya dibuat otomatis
        // oleh DO ini. Penjualan POS asli tidak boleh ikut terhapus.
        const isAutoSale = !!deliveryOrder.sale?.notes?.startsWith("Auto-Invoice DO:");
        if (deliveryOrder.saleId && isAutoSale) {
            await tx.customerDebt.deleteMany({
                where: { saleId: deliveryOrder.saleId }
            });
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

        // F. Batch 7 item 194 (a): hapus juga notifikasi yang menunjuk ke
        // DO ini, supaya tidak tertinggal notifikasi basi yang tautannya
        // membuka pencarian 0 hasil (contoh: "Surat Jalan Baru Siap Muat
        // #DO/202611/0003" yang DO-nya sudah dihapus). Notifikasi DO dibuat
        // dari dua jalur dengan bentuk params yang berbeda, jadi cocokkan
        // keduanya:
        // - NotificationService.onDeliveryUpdate: params { doId, doNumber }
        // - notify.ts NotifEvent.doCreated/doStatusChanged: params { search, doNumber }
        // doNumber unik per DO, jadi pencocokan doNumber aman.
        await tx.notification.deleteMany({
            where: {
                type: "DELIVERY_UPDATE",
                OR: [
                    { params: { path: ["doId"], equals: id } },
                    { params: { path: ["doNumber"], equals: deliveryOrder.doNumber } },
                ],
            },
        });

        // E. Terakhir, Hapus Surat Jalan (DeliveryOrder)
        await tx.deliveryOrder.delete({
            where: { id }
        });
    });

    // 6. Hapus file fisik di Cloudflare R2 secara asinkron tanpa menahan
    // respon. FIX (22 Nov 2026, R2): lewat deleteR2FilesByKeys supaya
    // baris pelacakan ikut ditandai DELETED (bukan cuma file dihapus).
    if (photosToDelete.length > 0) {
      void deleteR2FilesByKeys(photosToDelete).catch((err) => {
        console.warn("[R2_CLEANUP_WARN] Gagal menghapus file R2 setelah DO dihapus:", err);
      });
    }

    // Revalidate semua halaman yang terpengaruh
    revalidatePath("/dashboard/delivery-orders");
    revalidatePath("/dashboard/sales");          // Sale hilang dari list
    revalidatePath("/dashboard/customer-debts"); // Hutang hilang dari list
    revalidatePath("/dashboard/products");       // Stok kembali

    // FIX (22 Nov 2026): hapus DO juga ternotifikasi (sebagai pembatalan),
    // supaya tim tahu surat jalan itu tidak jadi dikirim.
    // Batch 7 item 194 (a): notifikasi pembatalan ini SENGAJA dibuat TANPA
    // params doNumber/doId — kalau memakai onDeliveryUpdate(..., "CANCELLED"),
    // notifikasi itu ikut membawa tautan ke DO yang baru saja dihapus dan
    // ketukannya membuka pencarian 0 hasil (persis bug yang diperbaiki di
    // atas). Tanpa params, ketuk notifikasi ini membuka daftar surat jalan
    // (/dashboard/delivery-orders), bukan pencarian kosong.
    try {
      const { NotificationService } = await import("@/lib/services/notification.service");
      NotificationService.send({
        role: "ADMIN",
        title: "❌ Pengiriman Dibatalkan",
        body: `Surat Jalan #${deliveryOrder.doNumber} telah dihapus/dibatalkan.`,
        type: "DELIVERY_UPDATE",
        screen: "Delivery",
        channelId: "masdar_channel_v3",
      }).catch((e) =>
        console.error("[Notif] Error notifying delivery deletion:", e),
      );
    } catch (e) {
      console.error("[Notif] Delivery deletion notification dispatch error:", e);
    }

    // Dulu tanpa `data`, padahal route DELETE memanggil
    // successResponse(result.data, ...) — type error di build.
    return {
      success: true,
      message: "Surat jalan berhasil dihapus.",
      data: { id, doNumber: deliveryOrder.doNumber },
    };

  } catch (error) {
    console.error("Error deleting delivery order:", error);
    return { success: false, error: (error instanceof Error ? error.message : "Gagal menghapus surat jalan") };
  }
}

//                  CANCEL DELIVERY ORDER (BATALKAN TRANSAKSI)
export async function cancelDeliveryOrder(id: string, externalSession?: AuthSession | null) {
  try {
    // FIX PENTEST (22 Nov 2026, M18): sesi dari route (Bearer mobile).
    const session = externalSession || (await auth());
    if (!session?.user) return { success: false, error: "Unauthorized" };

    // FIX PENTEST (22 Nov 2026, H5): pembatalan DO khusus ADMIN+ (efek
    // hutang auto-DO) — sebelumnya UPDATE_DELIVERY_STATUS (KASIR lolos).
    requirePermission(session, "CANCEL_DELIVERY_ORDER");

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

    // 3. PROTEKSI PEMBAYARAN — hanya untuk penjualan otomatis DO ini.
    // Penjualan POS asli tidak ikut dibatalkan, jadi cicilannya bukan urusan DO.
    const isAutoSale = !!deliveryOrder.sale?.notes?.startsWith("Auto-Invoice DO:");
    if (isAutoSale && deliveryOrder.sale && deliveryOrder.sale.customerDebts.length > 0) {
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
        
        // A. STOK: tidak ada yang dikembalikan (M-12) — DO yang dibatalkan
        // di sini masih PENDING / IN_TRANSIT (DELIVERED ditolak di atas),
        // jadi stok belum pernah dipotong.
        // B. Hapus hutang HANYA kalau penjualannya dibuat otomatis oleh DO ini.
        if (deliveryOrder.saleId && isAutoSale) {
            await tx.customerDebt.deleteMany({
                where: { saleId: deliveryOrder.saleId }
            });
        }

        // C. UPDATE STATUS DO JADI "CANCELLED" (penjualan tetap ada sebagai history)
        await tx.deliveryOrder.update({
            where: { id },
            data: {
                status: "CANCELLED",
                notes: `${deliveryOrder.notes || ''} [DIBATALKAN]`.trim()
            }
        });

        // Update Sale (Invoice) HANYA untuk penjualan otomatis DO ini.
        if (deliveryOrder.saleId && isAutoSale) {
            await tx.sale.update({
                where: { id: deliveryOrder.saleId },
                data: {
                    status: "CANCELLED",
                    totalAmount: 0,
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

    // FIX (22 Nov 2026): pembatalan DO ternotifikasi (lihat CANCELLED di
    // updateDeliveryStatus — sebelumnya senyap).
    try {
      const { NotificationService } = await import("@/lib/services/notification.service");
      NotificationService.onDeliveryUpdate(id, deliveryOrder.doNumber, "CANCELLED").catch((e) =>
        console.error("[Notif] Error notifying delivery cancellation:", e),
      );
    } catch (e) {
      console.error("[Notif] Delivery cancellation notification dispatch error:", e);
    }

    return { success: true, message: "Pengiriman berhasil dibatalkan." };

  } catch (error: unknown) {
    console.error("Cancel DO Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Gagal membatalkan transaksi" };
  }
}


/**
 * Tambah foto ke DeliveryOrder dengan pelacakan ukuran file & sinkronisasi
 */
export async function addDeliveryPhoto(
  input: {
    deliveryOrderId: string;
    url: string;
    filename: string;
    sizeBytes?: number;
    mimeType?: string;
  },
  externalSession?: AuthSession | null
) {
  try {
    // FIX PENTEST (22 Nov 2026, M18): sesi dari route (Bearer mobile).
    const session = externalSession || (await auth());
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    requirePermission(session, "UPDATE_DELIVERY_STATUS");

    const { deliveryOrderId, url, filename, sizeBytes = 0, mimeType = "image/jpeg" } = input;

    // FIX PENTEST (22 Nov 2026, M8): URL bukti harus berasal dari host
    // upload resmi (Cloudflare Worker) — sebelumnya URL arbitrer apa pun
    // bisa ditempel sebagai bukti kirim. Nama file juga tidak boleh
    // mengandung path.
    if (!url || typeof url !== "string") {
      return { success: false, error: "URL foto wajib diisi" };
    }
    let photoUrl: URL;
    try {
      photoUrl = new URL(url);
    } catch {
      return { success: false, error: "URL foto tidak valid" };
    }
    if (photoUrl.protocol !== "https:") {
      return { success: false, error: "URL foto harus HTTPS" };
    }
    const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
    if (workerUrl) {
      try {
        if (photoUrl.origin !== new URL(workerUrl).origin) {
          return { success: false, error: "URL foto harus berasal dari layanan upload resmi" };
        }
      } catch {
        // CLOUDFLARE_WORKER_URL tidak valid — lewati cek host (upload
        // resmi sendiri akan gagal tanpa env ini).
      }
    }
    if (!filename || filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
      return { success: false, error: "Nama file tidak valid" };
    }

    // DO harus ada dan belum selesai/dibatalkan.
    const deliveryOrder = await prisma.deliveryOrder.findUnique({
      where: { id: deliveryOrderId },
      select: { id: true, status: true },
    });
    if (!deliveryOrder) {
      return { success: false, error: "Surat Jalan tidak ditemukan" };
    }
    if (deliveryOrder.status === "DELIVERED" || deliveryOrder.status === "CANCELLED") {
      return { success: false, error: "Surat Jalan yang sudah DITERIMA / dibatalkan tidak bisa ditambah foto." };
    }

    // FIX PENTEST (22 Nov 2026, M8): ukuran & tipe file diambil dari
    // catatan upload resmi (R2File) bila ada — angka dari klien hanya
    // dipakai sebagai fallback dan dibatasi (maks 5 MB, hanya gambar).
    let finalSizeBytes = 0;
    let finalMimeType = "image/jpeg";
    const tracked = await prisma.r2File.findFirst({
      where: { url },
      select: { sizeBytes: true, mimeType: true },
    });
    if (tracked) {
      finalSizeBytes = tracked.sizeBytes;
      finalMimeType = tracked.mimeType;
    } else {
      const allowedMime = ["image/jpeg", "image/png", "image/webp"];
      finalMimeType = allowedMime.includes(mimeType) ? mimeType : "image/jpeg";
      finalSizeBytes = Math.min(Math.max(Math.floor(Number(sizeBytes) || 0), 0), 5_000_000);
    }

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
        sizeBytes: finalSizeBytes,
        mimeType: finalMimeType,
        uploadedById: session.user.id,
      },
    });

    // Update proofImage di DeliveryOrder sebagai thumbnail utama
    await prisma.deliveryOrder.update({
      where: { id: deliveryOrderId },
      data: { proofImage: url },
    });

    // FIX (22 Nov 2026, R2): foto lampiran dikonfirmasi ACTIVE milik DO ini.
    await confirmR2File(url, "DELIVERY_PROOF", deliveryOrderId);

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
export async function deleteDeliveryPhoto(
  photoId: string,
  deliveryOrderId?: string,
  externalSession?: AuthSession | null
) {
  try {
    // FIX PENTEST (22 Nov 2026, M18): sesi dari route (Bearer mobile).
    const session = externalSession || (await auth());
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

    // FIX PENTEST (22 Nov 2026, M7): pastikan foto ini memang milik DO di
    // path — sebelumnya [id] diabaikan, jadi foto DO lain bisa dihapus
    // hanya dengan menebak photoId.
    if (deliveryOrderId && photo.deliveryOrderId !== deliveryOrderId) {
      return { success: false, error: "Foto ini bukan milik Surat Jalan tersebut" };
    }

    // FIX (22 Nov 2026, R2): hapus R2 DULU, baru baris DB. Sebelumnya
    // baris dihapus dulu — kalau hapus R2 gagal, file jadi yatim tanpa
    // jejak apa pun. Kalau R2 gagal, baris DIPERTAHANKAN dan ditandai
    // DELETE_FAILED supaya bisa di-retry dari halaman Penyimpanan.
    const r2Ok = await deleteR2FileByUrl(photo.filename || photo.url);
    if (!r2Ok) {
      return {
        success: false,
        error: "Gagal menghapus file dari Cloudflare R2. Foto masih tersimpan — coba lagi atau hapus dari halaman Penyimpanan.",
      };
    }

    // 2. Hapus dari DB (file sudah pasti hilang dari R2)
    await prisma.deliveryPhoto.delete({
      where: { id: photoId },
    });

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