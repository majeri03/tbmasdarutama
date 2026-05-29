import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateInvoiceHtml, getStoreSettings } from "@/lib/invoicePdfGenerator";

function authCheck(request: Request) {
  const clientApiKey = request.headers.get("x-api-key") || request.headers.get("x-bot-api-key");
  const serverApiKey = process.env.BOT_API_KEY || process.env.WA_BOT_API_KEY;
  return clientApiKey && clientApiKey === serverApiKey;
}

export async function POST(request: Request) {
  if (!authCheck(request)) {
    return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { rawMessage, senderPhone, senderName, customerName, notes, parsedItems } = body;

    if (!rawMessage || !senderPhone || !senderName) {
      return NextResponse.json(
        { status: "error", message: "rawMessage, senderPhone, senderName wajib" },
        { status: 400 }
      );
    }

    // ==================== AUTO-CREATE / FIND CUSTOMER ====================
    let resolvedCustomerName = customerName || senderName;
    let customerId: string | null = null;
    let isNewCustomer = false;

    const cleanNameStr = resolvedCustomerName ? resolvedCustomerName.replace(/[^a-zA-Z0-9\s]/g, "").trim() : "";
    const isValidName = cleanNameStr.length >= 2;

    if (isValidName) {
      const cleanName = cleanNameStr;
      const cleanPhone = senderPhone ? String(senderPhone).replace(/[^0-9+]/g, "") : null;

      const existing = await prisma.customer.findFirst({
        where: {
          isActive: true,
          OR: [
            { name: { equals: cleanName, mode: "insensitive" } },
            ...(cleanPhone ? [{ phone: cleanPhone }] : []),
          ],
        },
      });

      if (existing) {
        customerId = existing.id;
        resolvedCustomerName = existing.name;
      } else {
        const lastCustomer = await prisma.customer.findFirst({
          where: { code: { startsWith: "CUST-WA-" } },
          orderBy: { createdAt: "desc" },
          select: { code: true },
        });

        let nextNum = 1;
        if (lastCustomer?.code) {
          const parts = lastCustomer.code.split("-");
          const lastNum = parseInt(parts[parts.length - 1] || "0");
          if (!isNaN(lastNum)) nextNum = lastNum + 1;
        }
        const newCode = `CUST-WA-${String(nextNum).padStart(3, "0")}`;

        const newCustomer = await prisma.customer.create({
          data: { code: newCode, name: cleanName, phone: cleanPhone || null, type: "UMUM", isActive: true },
        });

        customerId = newCustomer.id;
        resolvedCustomerName = newCustomer.name;
        isNewCustomer = true;
      }
    } else {
      const umumCustomer = await prisma.customer.findFirst({
        where: {
          isActive: true,
          OR: [{ name: { equals: "umum", mode: "insensitive" } }, { type: "UMUM", name: { contains: "umum", mode: "insensitive" } }],
        },
      });
      if (umumCustomer) {
        customerId = umumCustomer.id;
        resolvedCustomerName = umumCustomer.name;
      }
    }

    // ==================== AUTO-CREATE SALE ====================
    // Find admin user for cashierId
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } }) || await prisma.user.findFirst();
    if (!admin) {
      return NextResponse.json({ status: "error", message: "Tidak ada user/admin di database untuk menjadi kasir." }, { status: 500 });
    }
    const cashierId = admin.id;

    // Hitung total
    let totalAmount = 0;
    const saleItemsData: any[] = [];
    
    if (Array.isArray(parsedItems)) {
      for (const item of parsedItems) {
        let productId = item.productId;
        let unitId = item.unitId;
        
        if (!productId) continue;
        
        const product = await prisma.product.findUnique({ where: { id: productId }, include: { productUnits: true }});
        if (!product) continue;

        // Cek apakah unitId yang diberikan benar-benar valid (ada di dalam productUnits)
        if (unitId && !product.productUnits.some(u => u.unitId === unitId)) {
          unitId = null;
        }

        let unitPrice = item.price || 0;
        
        if (!unitId && product.productUnits.length > 0) {
           unitId = product.productUnits.find((u) => u.isPrimary)?.unitId || product.productUnits[0].unitId;
           if (!unitPrice) unitPrice = Number(product.productUnits[0].sellPrice);
        } else if (!unitPrice && product.productUnits.length > 0) {
           const pu = product.productUnits.find(u => u.unitId === unitId);
           if (pu) unitPrice = Number(pu.sellPrice);
        }

        // Fallback jika unitId masih kosong
        if (!unitId) {
          const defaultUnit = await prisma.unit.findFirst();
          if (defaultUnit) unitId = defaultUnit.id;
        }
        
        const qty = item.quantity || 1;
        const subtotal = qty * unitPrice;
        totalAmount += subtotal;

        saleItemsData.push({
          productId,
          unitId,
          quantity: qty,
          unitPrice,
          subtotal,
        });
      }
    }

    const today = new Date();
    const invNo = `INV-WA-${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}-${Math.floor(Math.random()*10000).toString().padStart(4, '0')}`;

    // ==================== BUAT SALE (COMPLETED, belum lunas) ====================
    // COMPLETED = transaksi dikonfirmasi; paidAmount=0 = belum dibayar/lunas
    const sale = await prisma.sale.create({
      data: {
        invoiceNumber: invNo,
        customerId,
        cashierId,
        totalAmount,
        grandTotal: totalAmount,
        paymentMethod: "CREDIT",   // CREDIT = pembayaran nanti / piutang
        paidAmount: 0,             // Belum lunas
        changeAmount: 0,
        status: "COMPLETED",       // COMPLETED = transaksi sudah confirmed
        notes: notes || rawMessage,
        saleItems: {
          create: saleItemsData,
        }
      },
      include: {
        customer: true,
        cashier: true,
        saleItems: {
          include: {
            product: true,
            unit: true,
          }
        }
      }
    });

    // ==================== BUAT HUTANG CUSTOMER (jika ada customerId) ====================
    if (customerId && totalAmount > 0) {
      try {
        const lastDebt = await prisma.customerDebt.findFirst({
          where: { debtNumber: { startsWith: "DEBT-WA-" } },
          orderBy: { debtNumber: "desc" },
          select: { debtNumber: true },
        });
        let debtNum = 1;
        if (lastDebt?.debtNumber) {
          const parts = lastDebt.debtNumber.split("-");
          const lastVal = parseInt(parts[parts.length - 1] || "0");
          if (!isNaN(lastVal)) debtNum = lastVal + 1;
        }
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30); // jatuh tempo 30 hari
        await prisma.customerDebt.create({
          data: {
            debtNumber: `DEBT-WA-${String(debtNum).padStart(4, "0")}`,
            saleId: sale.id,
            customerId,
            totalDebt: totalAmount,
            paidAmount: 0,
            remainingDebt: totalAmount,
            status: "UNPAID",
            dueDate,
            notes: `[BOT-YA] Piutang dari order WA - ${senderName}`,
          },
        });
      } catch (debtErr) {
        console.error("[BOT] Gagal buat hutang customer:", debtErr);
        // Jangan gagalkan sale karena gagal buat hutang
      }
    }

    // Generate HTML (Tanpa Puppeteer di Vercel, kita lempar HTML ke Bot)
    let htmlString = null;
    try {
      const store = await getStoreSettings();
      htmlString = generateInvoiceHtml(sale, store, { layoutType: 'INVOICE_BESAR' });
    } catch (e) {
      console.error("[BOT] Error generating HTML:", e);
    }

    // ==================== AUDIT TRAIL: Catat di wa_orders (CONFIRMED) ====================
    // WaOrder CONFIRMED = dikonfirmasi langsung via bot (reply YA)
    const confirmedViaBot = new Date().toISOString();
    try {
      await prisma.waOrder.create({
        data: {
          rawMessage,
          senderPhone,
          senderName,
          groupName: "WA Bot AI",
          parsedItems: Array.isArray(parsedItems) ? parsedItems : [],
          customerName: resolvedCustomerName || null,
          notes: `[BOT-YA: ${confirmedViaBot}] Dikonfirmasi langsung via WA. Invoice: ${sale.invoiceNumber}. Status: BELUM LUNAS. ${notes || ""}`.trim(),
          status: "CONFIRMED",  // Dikonfirmasi langsung via bot, tidak perlu admin review
          confirmedAt: new Date(),
          saleId: sale.id,
        },
      });
    } catch (auditErr) {
      console.error("[BOT] Gagal catat wa_order audit:", auditErr);
    }

    return NextResponse.json({
      status: "success",
      message: "Pesanan berhasil dikonfirmasi dan disimpan",
      data: {
        saleId: sale.id,
        saleStatus: sale.status,
        invoiceNumber: sale.invoiceNumber,
        grandTotal: sale.grandTotal,
        customerName: resolvedCustomerName,
        isNewCustomer,
        itemCount: saleItemsData.length,
        htmlString,
      },
    }, { status: 201 });

  } catch (error) {
    console.error("[BOT] Error create order confirm:", error);
    return NextResponse.json({ status: 'error', message: 'Gagal membuat orderan confirm: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}


