import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse, notFoundResponse, errorResponse } from "@/lib/utils/api";
import { getSaleById } from "@/lib/actions/sale.actions";
import { getStoreSettings, generateInvoiceHtml } from "@/lib/invoicePdfGenerator";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/sales/[id]/invoice
 * Mengembalikan data invoice lengkap beserta layout HTML sesuai pengaturan store_settings.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAuthenticatedUser();
    if (!session) return unauthorizedResponse();

    const { id } = await context.params;
    const saleResult = await getSaleById(id);

    if (!saleResult.success || !saleResult.data) {
      return notFoundResponse("Invoice penjualan");
    }

    const sale = saleResult.data;
    const store: any = await getStoreSettings();

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
