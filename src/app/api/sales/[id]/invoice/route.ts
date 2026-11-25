import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse, forbiddenResponse, notFoundResponse, errorResponse } from "@/lib/utils/api";
import { getSaleById } from "@/lib/actions/sale.actions";
import { hasPermission } from "@/lib/utils/role";
import { getStoreSettings, generateInvoiceHtml } from "@/lib/invoicePdfGenerator";
import prisma from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/sales/[id]/invoice
 * Mengembalikan data invoice lengkap beserta layout HTML sesuai pengaturan store_settings.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();
    // FIX PENTEST (22 Nov 2026, L10): izin dicek di lapis route (sebelumnya
    // hanya didelegasikan ke action lewat auth() — sesi Bearer mobile gagal).
    if (!hasPermission(session, "VIEW_SALES")) return forbiddenResponse();

    const { id } = await context.params;
    let saleResult = await getSaleById(id, session);

    // Item 220 (batch 8): [id] di URL sering diisi NOMOR INVOICE
    // (mis. INV/20261124-0003), bukan id database (cuid). getSaleById hanya
    // mencari by id (prisma.sale.findUnique where id), jadi nomor invoice
    // selalu gagal dan route mengembalikan "Invoice penjualan tidak
    // ditemukan." — padahal penjualannya ada. Fallback: cari id asli lewat
    // invoiceNumber (kolom @unique), lalu coba getSaleById sekali lagi.
    // getSaleById sendiri TIDAK diubah (bukan file workstream ini).
    if (!saleResult.success || !saleResult.data) {
      const byNumber = await prisma.sale.findUnique({
        where: { invoiceNumber: id },
        select: { id: true },
      });
      if (byNumber) {
        saleResult = await getSaleById(byNumber.id, session);
      }
    }

    if (!saleResult.success || !saleResult.data) {
      return notFoundResponse("Invoice penjualan");
    }

    const sale = saleResult.data;

    interface StoreSettings {
      name: string;
      phone: string;
      address: string;
      tagline: string;
      logoUrl?: string | null;
      invoiceLayoutType?: string | null;
      invoiceShowHeader?: boolean | null;
      invoiceShowLogo?: boolean | null;
      invoiceShowCustomerInfo?: boolean | null;
      invoiceShowPaymentInfo?: boolean | null;
      invoiceShowSignature?: boolean | null;
      invoiceShowFooter?: boolean | null;
      invoiceFooterTerms?: string | null;
    }

    const store = await getStoreSettings() as unknown as StoreSettings;

    const url = new URL(request.url);
    const format = url.searchParams.get("format"); // "html" | "json"

    const html = generateInvoiceHtml(sale, store, {
      layoutType: store.invoiceLayoutType || "INVOICE_BESAR",
      fontSizeScale: 1.0,
      showHeader: store.invoiceShowHeader ?? true,
      showLogo: store.invoiceShowLogo ?? true,
      showCustomerInfo: store.invoiceShowCustomerInfo ?? true,
      showPaymentInfo: store.invoiceShowPaymentInfo ?? true,
      showSignature: store.invoiceShowSignature ?? true,
      showFooter: store.invoiceShowFooter ?? true,
      footerTerms: store.invoiceFooterTerms || undefined,
    });

    if (format === "html") {
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        sale,
        store,
        html,
      },
    });
  } catch (error) {
    console.error("[API_SALE_INVOICE_GET_ERROR]", error);
    return errorResponse("Terjadi kesalahan saat memproses invoice");
  }
}
