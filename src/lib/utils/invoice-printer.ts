import { format } from "date-fns";
import { formatCurrency } from "./pos-helpers";

// XSS fix (Nov 2026): teks dari database (nama pelanggan/produk/toko)
// tidak boleh ditempel mentah ke HTML invoice — karakter < > & " '
 // diubah jadi kode aman supaya tidak bisa menjalankan script.
const escapeHtml = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"} as Record<string, string>)[c]);

// stripRp (perbaikan ke-4): formatCurrency() memakai Intl id-ID yang
// mengembalikan "Rp\u00A078.000" — spasi di sana adalah NON-BREAKING SPACE
// (U+00A0), jadi .replace('Rp ','') dengan spasi biasa TIDAK PERNAH cocok
// dan "Rp " tersisa di mana-mana. Akibatnya baris item struk 58mm meluber
// ("1 Zak x Rp 78.000" + "Rp 78.000" tidak muat 48mm) lalu patah aneh.
const stripRp = (n: Parameters<typeof formatCurrency>[0]): string =>
    formatCurrency(n).replace(/^Rp[\s\u00A0]*/, "");


export interface InvoiceData {
    invoiceNumber: string;
    saleDate: Date | string;
    paymentMethod: string;
    grandTotal: number;
    totalAmount: number;
    discount: number;
    tax: number;
    paidAmount: number;
    changeAmount: number;
    cashier: {
        name: string;
    };
    customer?: {
        name: string;
        phone?: string | null;
        address?: string | null;
    } | null;
    saleItems: Array<{
        unitPrice: number;
        quantity: number;
        discount: number;
        subtotal: number;
        product: {
            name: string;
            code: string;
        };
        unit: {
            name: string;
            symbol?: string | null;
        };
    }>;
}

export interface StoreSetting {
    name?: string;
    address?: string | null;
    phone?: string | null;
    logoUrl?: string | null;
    tagline?: string | null;
    bankName?: string | null;
    bankAccount?: string | null;
    bankHolder?: string | null;
    // Invoice layout settings (synced from StoreSetting DB)
    invoiceLayoutType?: string | null;
    invoicePaperSize?: string | null;
    invoiceDocumentPaperSize?: string | null;
    invoiceShowHeader?: boolean | null;
    invoiceShowLogo?: boolean | null;
    invoiceShowCustomerInfo?: boolean | null;
    invoiceShowPaymentInfo?: boolean | null;
    invoiceShowSignature?: boolean | null;
    invoiceShowFooter?: boolean | null;
    invoiceFooterTerms?: string | null;
}

export interface CustomLayout {
    layoutType?: string;
    paperSize?: string;
    showHeader?: boolean;
    showLogo?: boolean;
    showCustomerInfo?: boolean;
    showPaymentInfo?: boolean;
    showSignature?: boolean;
    showFooter?: boolean;
    footerTerms?: string;
}

// Helper: Terbilang
function numberToWords(num: number): string {
    const ones = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan"];
    const teens = ["Sepuluh", "Sebelas", "Dua Belas", "Tiga Belas", "Empat Belas", "Lima Belas", "Enam Belas", "Tujuh Belas", "Delapan Belas", "Sembilan Belas"];
    const tens = ["", "", "Dua Puluh", "Tiga Puluh", "Empat Puluh", "Lima Puluh", "Enam Puluh", "Tujuh Puluh", "Delapan Puluh", "Sembilan Puluh"];

    if (num === 0) return "Nol";
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? " " + ones[num % 10] : "");
    if (num < 1000) {
        const hundred = Math.floor(num / 100);
        const rest = num % 100;
        return (hundred === 1 ? "Seratus" : ones[hundred] + " Ratus") + (rest !== 0 ? " " + numberToWords(rest) : "");
    }
    if (num < 1000000) {
        const thousand = Math.floor(num / 1000);
        const rest = num % 1000;
        return (thousand === 1 ? "Seribu" : numberToWords(thousand) + " Ribu") + (rest !== 0 ? " " + numberToWords(rest) : "");
    }
    if (num < 1000000000) {
        const million = Math.floor(num / 1000000);
        const rest = num % 1000000;
        return numberToWords(million) + " Juta" + (rest !== 0 ? " " + numberToWords(rest) : "");
    }
    return "Angka terlalu besar";
}

export const generateInvoiceHtml = (sale: InvoiceData, storeSetting: StoreSetting | null, customLayout?: CustomLayout): string => {
    // Nama toko dari DB; kalau kosong tampilkan catatan jelas, bukan nama rekaan.
    const storeName = (storeSetting?.name || "").trim() || "Data toko belum diisi";
    const storeAddress = (storeSetting?.address || "").trim();
    const storePhone = (storeSetting?.phone || "").trim();
    // Blok bank tampil kapan pun toko sudah menyimpan nomor rekening (metode
    // bayar apa pun) — bukan hanya TRANSFER. Surat jalan tidak pernah memakai
    // ini karena showPrices = false untuk SURAT_JALAN.
    const hasBankInfo = Boolean((storeSetting?.bankAccount || "").trim());
    const dateStr = format(new Date(sale.saleDate), "dd/MM/yyyy HH:mm");
    
    const layoutType = customLayout?.layoutType || storeSetting?.invoiceLayoutType || "STRUK_KECIL";
    const isThermal = layoutType === "STRUK_KECIL";
    const defaultDocSize = storeSetting?.invoiceDocumentPaperSize || "A4";
    const defaultThermalSize = storeSetting?.invoicePaperSize || "58mm";
    const paperSize = customLayout?.paperSize || (isThermal ? defaultThermalSize : defaultDocSize);
    // XSS/CSS fix (Nov 2026): paperSize dari setting toko tidak boleh ditempel
    // mentah ke CSS — hanya nilai kertas yang dikenal yang dipakai.
    const safePaperSize = /^(57mm|58mm|76mm|80mm|a4|a5|f4|hvs|letter)$/i.test(paperSize)
        ? paperSize
        : (isThermal ? "58mm" : "A4");
    
    const showHeader = customLayout?.showHeader ?? storeSetting?.invoiceShowHeader ?? true;
    const showLogo = customLayout?.showLogo ?? storeSetting?.invoiceShowLogo ?? true;
    const showCustomerInfo = customLayout?.showCustomerInfo ?? storeSetting?.invoiceShowCustomerInfo ?? true;
    const showPaymentInfo = customLayout?.showPaymentInfo ?? storeSetting?.invoiceShowPaymentInfo ?? true;
    const showSignature = customLayout?.showSignature ?? storeSetting?.invoiceShowSignature ?? true;
    const showFooter = customLayout?.showFooter ?? storeSetting?.invoiceShowFooter ?? true;
    const footerTerms = customLayout?.footerTerms ?? storeSetting?.invoiceFooterTerms ?? "BARANG YANG SUDAH DIBELI TIDAK DAPAT DITUKAR/DIKEMBALIKAN KECUALI ADA PERJANJIAN.";
    // FAKTUR_NCR (item 208): tanpa logo, tanpa garis tabel/kotak — hanya
    // garis bawah header tabel + garis total; baris lebih rapat.
    const isNcr = layoutType === "FAKTUR_NCR";
    
    const logoUrl = storeSetting?.logoUrl ? (storeSetting.logoUrl.startsWith('http') ? storeSetting.logoUrl : `${storeSetting.logoUrl}`) : null;
    // FAKTUR_NCR: tanpa logo sama sekali — termasuk placeholder kotak "MU"
    // yang muncul saat toko belum mengunggah logo (item 208).
    const logoImg = isNcr ? '' :
                    showLogo && logoUrl ? `<img src="${escapeHtml(logoUrl)}" style="width: 44px; height: 44px; object-fit: contain; margin-right: 10px; border-radius: 4px;" />` :
                    showLogo ? `<div style="width: 36px; height: 36px; background-color: #DC2626; display: flex; align-items: center; justify-content: center; margin-right: 10px; color: white; font-weight: bold;">MU</div>` : '';

    // Watermark PAID/UNPAID (item 211) DIHAPUS TOTAL — perbaikan ke-4
    // (27 Nov 2026, atas permintaan user): tidak ada lagi watermark di
    // layar, cetak, maupun download PDF, di semua layout.

    // STRUK KECIL (THERMAL)
    if (layoutType === "STRUK_KECIL") {
        let widthCss = "48mm";
        let fontSize = "11px";
        // 80mm: 70mm (bukan 72mm) supaya + padding 4mm kiri-kanan = 78mm,
        // masih ada sisa 1mm tiap sisi — printer thermal tidak memotong tepi.
        if (paperSize === "80mm") { widthCss = "70mm"; fontSize = "12px"; }
        else if (paperSize !== "58mm") { widthCss = `calc(${safePaperSize} - 10mm)`; fontSize = "12px"; }
        // Font baris item 1px lebih kecil dari badan struk: di kertas 58mm
        // yang sempit, "10 Zak x 78.000" + subtotal butuh tiap px supaya
        // tetap satu baris; nama produk tetap sebesar badan struk.
        const itemFontSize = fontSize === "12px" ? "11px" : "10px";
        
        // Baris item struk sebagai TABEL 2 kolom (bukan flex): flex +
        // html2canvas + font monospace yang lebarnya beda-beda di tiap HP
        // membuat "1 Zak x Rp 78.000" patah aneh; sel kanan nowrap
        // menjamin subtotal tidak pernah terbelah, sel kiri boleh
        // membungkus hanya bila benar-benar tidak muat.
        const itemsHtml = sale.saleItems.map(item => `
            <div style="margin-bottom: 5px;">
                <div style="font-weight: bold;">${escapeHtml(item.product.name)}</div>
                <table style="width: 100%; border-collapse: separate; border-spacing: 0; line-height: 1.3; font-size: ${itemFontSize};">
                    <tr>
                        <td style="padding: 0;">${item.quantity} ${escapeHtml(item.unit.symbol || item.unit.name)} x ${stripRp(item.unitPrice)}</td>
                        <td style="padding: 0; width: 1%; text-align: right; font-weight: bold; white-space: nowrap;">${stripRp(item.subtotal)}</td>
                    </tr>
                </table>
                ${item.discount > 0 ? `<div style="text-align: right; font-size: 0.9em; color: #444;">Disc: -${stripRp(item.discount)}</div>` : ''}
            </div>
        `).join("");

        return `
            <html>
                <head>
                    <title>Struk - ${sale.invoiceNumber}</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <meta name="color-scheme" content="light">
                    <style id="thermal-page" data-paper="${safePaperSize}">
                        /* @page di <style> sendiri ber-id supaya script
                           print (printInvoice) bisa menulis ulang size
                           dengan tinggi isi yang terukur — lihat bawah. */
                        @page { margin: 0; size: ${safePaperSize} auto; }
                    </style>
                    <style>
                        /* WS-5 (27 Nov 2026): faktur WAJIB terang di semua
                           perangkat. Tanpa color-scheme: light, Chrome di HP
                           yang mode gelapnya aktif menggelapkan halaman ini
                           (teks hitam di atas latar gelap = hitam semua). */
                        html { background: #ffffff; color-scheme: light; }
                        body { 
                            font-family: 'Courier New', Courier, monospace; 
                            font-size: ${fontSize}; 
                            line-height: 1.35;
                            color: #000; 
                            margin: 0; 
                            padding: 4mm;
                            width: ${widthCss};
                            max-width: 100%;
                            box-sizing: border-box;
                            overflow-x: hidden;
                            background: white;
                            position: relative;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        .center { text-align: center; }
                        .bold { font-weight: bold; }
                        .divider { border-top: 1px dashed #000; margin: 6px 0; }
                        .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
                    </style>
                </head>
                <body>
                    ${showHeader ? `
                    <div style="display:flex; justify-content:center; align-items:center; flex-direction:column; margin-bottom: 4px;">
                        ${logoImg}
                        <div class="center bold" style="font-size: 1.2em; margin-top: 4px;">${escapeHtml(storeName)}</div>
                        ${storeAddress ? `<div class="center">${escapeHtml(storeAddress)}</div>` : ''}
                        ${storePhone ? `<div class="center">Telp: ${escapeHtml(storePhone)}</div>` : ''}
                    </div>
                    <div class="divider"></div>
                    ` : ''}
                    
                    <div class="row"><span>No</span><span>${sale.invoiceNumber}</span></div>
                    <div class="row"><span>Tgl</span><span>${dateStr}</span></div>
                    <div class="row"><span>Kasir</span><span>${escapeHtml(sale.cashier?.name || '-')}</span></div>
                    ${showCustomerInfo && sale.customer ? `<div class="row"><span class="bold">Plgn</span><span class="bold">${escapeHtml(sale.customer.name)}</span></div>` : ''}
                    
                    <div class="divider"></div>
                    <div class="bold" style="margin-bottom: 4px;">DAFTAR BARANG</div>
                    ${itemsHtml}
                    
                    <div class="divider"></div>
                    <div class="row"><span>Subtotal</span><span>${stripRp(sale.totalAmount)}</span></div>
                    ${sale.discount > 0 ? `<div class="row"><span>Diskon</span><span>-${stripRp(sale.discount)}</span></div>` : ''}
                    ${sale.tax > 0 ? `<div class="row"><span>Pajak</span><span>${stripRp(sale.tax)}</span></div>` : ''}
                    <div class="row bold" style="font-size: 1.1em; margin-top: 4px;">
                        <span>TOTAL</span><span>${stripRp(sale.grandTotal)}</span>
                    </div>
                    <div class="divider"></div>
                    <div class="row"><span>Bayar (${escapeHtml(sale.paymentMethod)})</span><span>${stripRp(sale.paidAmount)}</span></div>
                    <div class="row bold"><span>Kembali</span><span>${stripRp(sale.changeAmount)}</span></div>

                    ${showPaymentInfo && hasBankInfo ? `
                    <div class="divider"></div>
                    <div class="center" style="font-size: 0.9em;">
                        <div class="bold">REKENING BANK:</div>
                        <div>${escapeHtml(storeSetting?.bankName || '')} - ${escapeHtml(storeSetting?.bankAccount || '')}</div>
                        <div>a/n ${escapeHtml(storeSetting?.bankHolder || '')}</div>
                    </div>
                    ` : ''}
                    
                    ${showFooter ? `
                    <div class="divider"></div>
                    <div class="center bold" style="margin-top: 8px;">TERIMA KASIH</div>
                    <div class="center" style="font-size: 0.9em;">${escapeHtml(footerTerms)}</div>
                    ` : ''}
                </body>
            </html>
        `;
    }

    // A4 LAYOUTS (INVOICE_BESAR, FAKTUR_NCR, SURAT_JALAN)
    let docTitle = "INVOICE";
    let showPrices = true;
    let showDiscountAndNet = true;

    if (layoutType === "SURAT_JALAN") {
        docTitle = "SURAT JALAN";
        showPrices = false;
        showDiscountAndNet = false;
    } else if (layoutType === "FAKTUR_NCR") {
        docTitle = "FAKTUR";
    }

    const itemsHtmlA4 = sale.saleItems.map((item, index) => {
        const gross = item.quantity * item.unitPrice;
        const discPercent = item.discount > 0 ? ((item.discount / gross) * 100).toFixed(0) + '%' : '0%';
        return `
            <tr>
                <td style="text-align:center;">${index + 1}</td>
                <td>
                    <b>${escapeHtml(item.product.name)}</b><br/>
                    <span style="font-size:10px; color:#555;">${escapeHtml(item.product.code)}</span>
                </td>
                <td style="text-align:center;" class="num">${item.quantity} ${escapeHtml(item.unit.symbol || item.unit.name)}</td>
                ${showPrices ? `
                <td class="num" style="text-align:right;">${stripRp(item.unitPrice)}</td>
                <td class="num" style="text-align:right;">${stripRp(gross)}</td>
                ` : ''}
                ${showDiscountAndNet ? `
                <td class="num" style="text-align:center;">${discPercent}</td>
                <td class="num" style="text-align:right;">${item.discount > 0 ? stripRp(item.discount) : '-'}</td>
                <td class="num" style="text-align:right; font-weight:bold;">${stripRp(item.subtotal)}</td>
                ` : showPrices ? `
                <td class="num" style="text-align:right; font-weight:bold;">${stripRp(item.subtotal)}</td>
                ` : ''}
            </tr>
        `;
    }).join("");

    let pageConfig = "@page { size: A4 portrait; margin: 10mm; }";
    let bodyWidth = "max-width: 210mm;";
    const pLower = (paperSize || "A4").toLowerCase().trim();
    if (pLower === "a5") {
        pageConfig = "@page { size: A5 portrait; margin: 8mm; }";
        bodyWidth = "max-width: 148mm;";
    } else if (pLower === "f4" || pLower === "hvs") {
        pageConfig = "@page { size: 215mm 330mm; margin: 10mm; }";
        bodyWidth = "max-width: 215mm;";
    } else if (pLower === "letter") {
        pageConfig = "@page { size: letter portrait; margin: 10mm; }";
        bodyWidth = "max-width: 216mm;";
    } else if (/^\d+\s*mm\s*x\s*\d+\s*mm$/.test(pLower)) {
        const m = pLower.match(/(\d+)\s*mm\s*x\s*(\d+)\s*mm/);
        const w = m ? m[1] : "210";
        const h = m ? m[2] : "297";
        pageConfig = `@page { size: ${w}mm ${h}mm; margin: 10mm; }`;
        bodyWidth = `max-width: ${w}mm;`;
    } else if (pLower !== "a4") {
        bodyWidth = `max-width: ${safePaperSize};`;
    }

    return `
        <html>
            <head>
                <title>${docTitle} - ${sale.invoiceNumber}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <meta name="color-scheme" content="light">
                <style>
                    ${pageConfig}
                    /* WS-5 (27 Nov 2026): lihat catatan di template struk —
                       faktur harus terang walau HP dalam mode gelap. */
                    html { background: #ffffff; color-scheme: light; }
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                        font-size: 11px;
                        line-height: 1.4;
                        color: #000;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        margin: 0 auto;
                        padding: 8mm 12mm;
                        background: #ffffff;
                        box-sizing: border-box;
                        overflow-x: hidden;
                        position: relative;
                        ${bodyWidth}
                    }
                    img { max-width: 100%; height: auto; }
                    /* Perbaikan ke-4 (download PDF/html2canvas): JANGAN
                       border-collapse: collapse — html2canvas salah menaruh
                       garis collapse (di HP garis menembus teks header
                       tabel & baris Tax). Pakai separate + border-spacing 0,
                       garis hanya di sel (th/td), tidak pernah di tr/thead.
                       line-height eksplisit supaya teks tidak "turun"
                       menabrak garis di bawahnya. */
                    table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 12px; }
                    th, td { border: 1px solid #000; padding: 5px 6px; line-height: 1.35; }
                    th { background: #f3f4f6; }
                    /* Tabel grid surat jalan: garis 1px tunggal — tiap sel
                       hanya menggambar sisi kanan + bawah, sisi kiri + atas
                       digambar tabelnya, jadi tidak ada garis ganda. */
                    table.invoice-grid { border-top: 1px solid #000; border-left: 1px solid #000; }
                    table.invoice-grid th, table.invoice-grid td { border: none; border-right: 1px solid #000; border-bottom: 1px solid #000; }
                    table.invoice-grid th { white-space: nowrap; }
                    /* Faktur/Invoice (bukan Surat Jalan): tanpa garis grid —
                       hanya satu garis di bawah baris header. */
                    table.invoice-items { margin-bottom: 10px; table-layout: fixed; }
                    table.invoice-items th, table.invoice-items td { border: none; padding: 3px 6px; background: transparent; }
                    table.invoice-items thead th { border-bottom: 1.5px solid #000; padding: 4px 6px; white-space: nowrap; }
                    table.invoice-items td.num { white-space: nowrap; }
                    /* Faktur NCR: baris lebih rapat tapi tetap terbaca. */
                    table.invoice-items-ncr th, table.invoice-items-ncr td { padding: 2px 6px; }
                    table.invoice-items-ncr thead th { padding: 3px 6px; }
                    .no-border td, .no-border th { border: none !important; padding: 2px 4px !important; background: transparent !important;}
                    .meta-table td { white-space: nowrap; }
                    .flex-between { display: flex; justify-content: space-between; align-items: flex-start; }
                    .header-box { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 12px; }
                    .header-box .head-right { flex-shrink: 0; }
                    .title { font-size: 20px; font-weight: bold; margin: 0; }
                </style>
            </head>
            <body>
                ${showHeader ? `
                <div class="flex-between header-box">
                    <div style="display:flex; align-items:center;">
                        ${logoImg}
                        <div>
                            <h1 style="margin:0; font-size:17px;">${escapeHtml(storeName)}</h1>
                            ${storeAddress ? `<p style="margin:2px 0 0 0;">${escapeHtml(storeAddress)}</p>` : ''}
                            ${storePhone ? `<p style="margin:1px 0 0 0;">Phone: ${escapeHtml(storePhone)}</p>` : ''}
                        </div>
                    </div>
                    <div class="head-right" style="text-align:right;">
                        <h2 class="title">${docTitle}</h2>
                        <table class="no-border meta-table" style="margin-top:8px; width:auto; margin-left:auto;">
                            <tr><td>Number</td><td>: <b style="white-space: nowrap;">${layoutType === 'SURAT_JALAN' ? 'DO-' : ''}${sale.invoiceNumber}</b></td></tr>
                            <tr><td>Date</td><td>: ${dateStr}</td></tr>
                            ${layoutType !== 'SURAT_JALAN' ? `<tr><td>Payment</td><td>: ${escapeHtml(sale.paymentMethod)}</td></tr>` : ''}
                            <tr><td>Cashier</td><td>: ${escapeHtml(sale.cashier?.name || '-')}</td></tr>
                        </table>
                    </div>
                </div>
                ` : ''}

                ${showCustomerInfo ? `
                <div style="${isNcr ? 'padding: 0; margin-bottom: 8px;' : 'border: 1px solid #000; padding: 8px; margin-bottom: 10px;'} width: 50%; line-height: 1.35;">
                    <strong style="display:block;">CUSTOMER INFO</strong>
                    ${isNcr ? '' : '<div style="border-top:1px solid #000; margin: 3px 0 5px;"></div>'}
                    <table class="no-border" style="margin-bottom: 0;">
                        <tr><td style="width:60px;">Name</td><td>: <b>${escapeHtml(sale.customer?.name || 'Umum')}</b></td></tr>
                        <tr><td>Phone</td><td>: ${escapeHtml(sale.customer?.phone || '-')}</td></tr>
                        <tr><td>Address</td><td>: ${escapeHtml(sale.customer?.address || '-')}</td></tr>
                    </table>
                </div>
                ` : ''}

                <table${showPrices ? (isNcr ? ' class="invoice-items invoice-items-ncr"' : ' class="invoice-items"') : ' class="invoice-grid"'}>
                    <thead>
                        <tr>
                            <th style="width: 5%;">No</th>
                            <th style="width: ${showPrices ? '35%' : '85%'}; text-align:left;">Description</th>
                            <th style="width: 10%;">Qty</th>
                            ${showPrices ? `
                            <th style="width: 12%; text-align:right;">Price</th>
                            <th style="width: 12%; text-align:right;">Gross</th>
                            ` : ''}
                            ${showDiscountAndNet ? `
                            <th style="width: 5%;">%</th>
                            <th style="width: 10%; text-align:right;">Disc</th>
                            <th style="width: 11%; text-align:right;">Net</th>
                            ` : showPrices ? `
                            <th style="width: 12%; text-align:right;">Net</th>
                            ` : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtmlA4}
                    </tbody>
                </table>

                <div class="flex-between">
                    <div style="width: 60%;">
                        ${showPrices ? `
                        <div style="${isNcr ? 'padding: 0; margin-bottom: 8px;' : 'border:1px solid #000; padding:8px; margin-bottom:8px;'}">
                            <b>Terbilang:</b> <br/><i>${numberToWords(Math.floor(sale.grandTotal))} Rupiah</i>
                        </div>
                        ` : ''}
                        
                        ${showPaymentInfo && showPrices && hasBankInfo ? `
                        <div style="${isNcr ? 'padding: 0; margin-bottom: 8px; display:inline-block;' : 'border:1px solid #000; padding:8px; margin-bottom:8px; display:inline-block;'}">
                            <b>REKENING BANK:</b> ${escapeHtml(storeSetting?.bankName || '')} - ${escapeHtml(storeSetting?.bankAccount || '')}<br/>
                            a/n ${escapeHtml(storeSetting?.bankHolder || '')}
                        </div>
                        ` : ''}
                        
                        ${showSignature ? `
                        <div style="display:flex; justify-content:space-between; margin-top: 18px; text-align:center;">
                            <div style="width:30%;">
                                <p>Penerima,</p>
                                <br/><br/>
                                <p style="border-top:1px solid #000; display:inline-block; width:80%;">(${escapeHtml(sale.customer?.name || 'Customer')})</p>
                            </div>
                            <div style="width:30%;">
                                <p>Hormat Kami,</p>
                                <br/><br/>
                                <p style="border-top:1px solid #000; display:inline-block; width:80%;">(${escapeHtml(sale.cashier?.name || 'Admin')})</p>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    
                    ${showPrices ? `
                    <div style="width: 35%;">
                        <table style="${isNcr ? 'border: none;' : 'border:1px solid #000;'}">
                            <tr><td style="border:none; padding:2px 6px;">Gross Total</td><td style="border:none; padding:2px 6px; text-align:right;">${stripRp(sale.totalAmount)}</td></tr>
                            <tr><td style="border:none; padding:2px 6px;">Discount</td><td style="border:none; padding:2px 6px; text-align:right; color:red;">(${stripRp(sale.discount)})</td></tr>
                            <tr><td style="border:none; padding:2px 6px;">Tax</td><td style="border:none; padding:2px 6px; text-align:right;">${stripRp(sale.tax)}</td></tr>
                            <tr><td style="border:none; border-top:1px solid #000; padding:2px 6px;"><b>Grand Total</b></td><td style="border:none; border-top:1px solid #000; padding:2px 6px; text-align:right;"><b>${stripRp(sale.grandTotal)}</b></td></tr>
                            <tr><td style="border:none; padding:2px 6px;">Paid</td><td style="border:none; padding:2px 6px; text-align:right;">${stripRp(sale.paidAmount)}</td></tr>
                            <tr><td style="border:none; padding:2px 6px;">Change</td><td style="border:none; padding:2px 6px; text-align:right;">${stripRp(sale.changeAmount)}</td></tr>
                        </table>
                    </div>
                    ` : ''}
                </div>
                
                ${showFooter ? `
                <div style="text-align:center; margin-top:20px; font-size:10px; border-top:2px solid #000; padding-top:6px;">
                    <b>${escapeHtml(footerTerms)}</b>
                </div>
                ` : ''}
            </body>
        </html>
    `;
};

/**
 * Cetak lewat iframe tersembunyi — dipakai kalau window.open() diblokir
 * (umum di browser HP). Iframe dibuat selebar A4 supaya hasil cetak di HP
 * sama dengan di desktop, lalu dihapus setelah print selesai.
 */
const printViaHiddenIframe = (htmlContent: string) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = "210mm";
    iframe.style.height = "100px";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const cleanup = () => {
        window.setTimeout(() => {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 1000);
    };

    const doc = iframe.contentDocument;
    if (!doc) {
        document.body.removeChild(iframe);
        alert("Gagal membuka cetakan. Coba lagi.");
        return;
    }
    doc.open();
    doc.write(htmlContent);
    doc.close();
    const win = iframe.contentWindow;
    if (!win) {
        cleanup();
        return;
    }
    window.setTimeout(() => {
        win.focus();
        win.print();
        cleanup();
    }, 500);
};

export const printInvoice = (sale: InvoiceData, storeSetting: StoreSetting, customLayout?: CustomLayout) => {
    const htmlContent = generateInvoiceHtml(sale, storeSetting, customLayout);

    const htmlWithScript = htmlContent.replace('</body>', `
        <script>
            window.onload = function() {
                setTimeout(() => {
                    // Struk thermal: @page { size: 80mm auto } TIDAK dipatuhi
                    // Chrome — ukuran 'auto' membuat seluruh deklarasi size
                    // gugur dan kertas jatuh ke default (A4/Letter), isi
                    // struk cuma menempati pojok kiri atas. Karena tinggi
                    // struk dinamis (tergantung jumlah item), ukur tinggi
                    // isi saat print lalu tulis ulang @page dengan tinggi
                    // eksplisit (mm) supaya hasil cetak selebar struk dan
                    // setinggi isi — hemat kertas, tidak A4 penuh.
                    // (Terverifikasi di Chromium headless: 80mm x tinggi isi.)
                    try {
                        var pg = document.getElementById('thermal-page');
                        if (pg) {
                            var hMm = Math.ceil(document.body.scrollHeight * 25.4 / 96) + 2;
                            var w = pg.getAttribute('data-paper') || '80mm';
                            pg.textContent = '@page { size: ' + w + ' ' + hMm + 'mm; margin: 0; }';
                        }
                    } catch (e) {}
                    window.print();
                }, 500);
            };
            window.onafterprint = function() {
                window.close();
            };
        </script>
        </body>
    `);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        // Pop-up diblokir (umum di HP): cetak lewat iframe tersembunyi.
        printViaHiddenIframe(htmlWithScript);
        return;
    }

    printWindow.document.write(htmlWithScript);
    printWindow.document.close();
};