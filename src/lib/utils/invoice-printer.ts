import { format } from "date-fns";
import { formatCurrency } from "./pos-helpers";

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
    const storeName = storeSetting?.name || "TB MASDAR UTAMA";
    const storeAddress = storeSetting?.address || "-";
    const storePhone = storeSetting?.phone ? `${storeSetting.phone}` : "-";
    const dateStr = format(new Date(sale.saleDate), "dd/MM/yyyy HH:mm");
    
    const layoutType = customLayout?.layoutType || "STRUK_KECIL";
    const paperSize = customLayout?.paperSize || "58mm";
    const showHeader = customLayout?.showHeader ?? true;
    const showLogo = customLayout?.showLogo ?? true;
    const showCustomerInfo = customLayout?.showCustomerInfo ?? true;
    const showPaymentInfo = customLayout?.showPaymentInfo ?? true;
    const showSignature = customLayout?.showSignature ?? true;
    const showFooter = customLayout?.showFooter ?? true;
    const footerTerms = customLayout?.footerTerms ?? "BARANG YANG SUDAH DIBELI TIDAK DAPAT DITUKAR/DIKEMBALIKAN KECUALI ADA PERJANJIAN.";
    
    const logoUrl = storeSetting?.logoUrl ? (storeSetting.logoUrl.startsWith('http') ? storeSetting.logoUrl : `http://localhost:3000${storeSetting.logoUrl}`) : null;
    const logoImg = showLogo && logoUrl ? `<img src="${logoUrl}" style="width: 44px; height: 44px; object-fit: contain; margin-right: 10px; border-radius: 4px;" />` : 
                    showLogo ? `<div style="width: 36px; height: 36px; background-color: #DC2626; display: flex; align-items: center; justify-content: center; margin-right: 10px; color: white; font-weight: bold;">MU</div>` : '';

    // STRUK KECIL (THERMAL)
    if (layoutType === "STRUK_KECIL") {
        let widthCss = "48mm";
        let fontSize = "11px";
        if (paperSize === "80mm") { widthCss = "72mm"; fontSize = "12px"; }
        else if (paperSize !== "58mm") { widthCss = `calc(${paperSize} - 10mm)`; fontSize = "12px"; }
        
        const itemsHtml = sale.saleItems.map(item => `
            <div style="margin-bottom: 6px;">
                <div style="font-weight: bold;">${item.product.name}</div>
                <div style="display: flex; justify-content: space-between;">
                    <div>${item.quantity} ${item.unit.symbol || item.unit.name} x ${formatCurrency(item.unitPrice).replace('Rp ','')}</div>
                    <div style="font-weight: bold;">${formatCurrency(item.subtotal).replace('Rp ','')}</div>
                </div>
                ${item.discount > 0 ? `<div style="text-align: right; font-size: 0.9em; color: #444;">Disc: -${formatCurrency(item.discount).replace('Rp ','')}</div>` : ''}
            </div>
        `).join("");

        return `
            <html>
                <head>
                    <title>Struk - ${sale.invoiceNumber}</title>
                    <style>
                        @page { margin: 0; size: ${paperSize} auto; }
                        body { 
                            font-family: 'Courier New', Courier, monospace; 
                            font-size: ${fontSize}; 
                            color: #000; 
                            margin: 0; 
                            padding: 4mm;
                            width: ${widthCss};
                            background: white;
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
                        <div class="center bold" style="font-size: 1.2em; margin-top: 4px;">${storeName}</div>
                        <div class="center">${storeAddress}</div>
                        <div class="center">Telp: ${storePhone}</div>
                    </div>
                    <div class="divider"></div>
                    ` : ''}
                    
                    <div class="row"><span>No</span><span>${sale.invoiceNumber}</span></div>
                    <div class="row"><span>Tgl</span><span>${dateStr}</span></div>
                    <div class="row"><span>Kasir</span><span>${sale.cashier?.name || '-'}</span></div>
                    ${showCustomerInfo && sale.customer ? `<div class="row"><span class="bold">Plgn</span><span class="bold">${sale.customer.name}</span></div>` : ''}
                    
                    <div class="divider"></div>
                    <div class="bold" style="margin-bottom: 4px;">DAFTAR BARANG</div>
                    ${itemsHtml}
                    
                    <div class="divider"></div>
                    <div class="row"><span>Subtotal</span><span>${formatCurrency(sale.totalAmount).replace('Rp ','')}</span></div>
                    ${sale.discount > 0 ? `<div class="row"><span>Diskon</span><span>-${formatCurrency(sale.discount).replace('Rp ','')}</span></div>` : ''}
                    ${sale.tax > 0 ? `<div class="row"><span>Pajak</span><span>${formatCurrency(sale.tax).replace('Rp ','')}</span></div>` : ''}
                    <div class="row bold" style="font-size: 1.1em; margin-top: 4px;">
                        <span>TOTAL</span><span>${formatCurrency(sale.grandTotal).replace('Rp ','')}</span>
                    </div>
                    <div class="divider"></div>
                    <div class="row"><span>Bayar (${sale.paymentMethod})</span><span>${formatCurrency(sale.paidAmount).replace('Rp ','')}</span></div>
                    <div class="row bold"><span>Kembali</span><span>${formatCurrency(sale.changeAmount).replace('Rp ','')}</span></div>
                    
                    ${showFooter ? `
                    <div class="divider"></div>
                    <div class="center bold" style="margin-top: 8px;">TERIMA KASIH</div>
                    <div class="center" style="font-size: 0.9em;">${footerTerms}</div>
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
                    <b>${item.product.name}</b><br/>
                    <span style="font-size:10px; color:#555;">${item.product.code}</span>
                </td>
                <td style="text-align:center;">${item.quantity} ${item.unit.symbol || item.unit.name}</td>
                ${showPrices ? `
                <td style="text-align:right;">${formatCurrency(item.unitPrice).replace("Rp ","")}</td>
                <td style="text-align:right;">${formatCurrency(gross).replace("Rp ","")}</td>
                ` : ''}
                ${showDiscountAndNet ? `
                <td style="text-align:center;">${discPercent}</td>
                <td style="text-align:right;">${item.discount > 0 ? formatCurrency(item.discount).replace("Rp ","") : '-'}</td>
                <td style="text-align:right; font-weight:bold;">${formatCurrency(item.subtotal).replace("Rp ","")}</td>
                ` : showPrices ? `
                <td style="text-align:right; font-weight:bold;">${formatCurrency(item.subtotal).replace("Rp ","")}</td>
                ` : ''}
            </tr>
        `;
    }).join("");

    let pageConfig = "@page { size: A4 portrait; margin: 15mm; }";
    let bodyWidth = "";
    if (paperSize && paperSize.trim() !== "" && paperSize.toLowerCase() !== "a4") {
        if (paperSize.toLowerCase() === "a5" || paperSize.toLowerCase() === "letter") {
             pageConfig = `@page { size: ${paperSize} portrait; margin: 15mm; }`;
        } else {
             bodyWidth = `max-width: ${paperSize}; margin-left: auto; margin-right: auto;`;
        }
    }

    return `
        <html>
            <head>
                <title>${docTitle} - ${sale.invoiceNumber}</title>
                <style>
                    ${pageConfig}
                    body { font-family: Arial, sans-serif; font-size: 12px; color: #000; -webkit-print-color-adjust: exact; margin: 0; ${bodyWidth} }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                    th, td { border: 1px solid #000; padding: 6px; }
                    th { background: #f0f0f0; }
                    .no-border td, .no-border th { border: none !important; padding: 2px !important; background: transparent !important;}
                    .flex-between { display: flex; justify-content: space-between; align-items: flex-start; }
                    .header-box { border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
                    .title { font-size: 24px; font-weight: bold; margin: 0; }
                </style>
            </head>
            <body>
                ${showHeader ? `
                <div class="flex-between header-box">
                    <div style="display:flex; align-items:center;">
                        ${logoImg}
                        <div>
                            <h1 style="margin:0; font-size:20px;">${storeName}</h1>
                            <p style="margin:4px 0 0 0;">${storeAddress}</p>
                            <p style="margin:2px 0 0 0;">Phone: ${storePhone}</p>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <h2 class="title">${docTitle}</h2>
                        <table class="no-border" style="margin-top:10px; width:auto; margin-left:auto;">
                            <tr><td>Number</td><td>: <b>${layoutType === 'SURAT_JALAN' ? 'DO-' : ''}${sale.invoiceNumber}</b></td></tr>
                            <tr><td>Date</td><td>: ${dateStr}</td></tr>
                            ${layoutType !== 'SURAT_JALAN' ? `<tr><td>Payment</td><td>: ${sale.paymentMethod}</td></tr>` : ''}
                            <tr><td>Cashier</td><td>: ${sale.cashier?.name || '-'}</td></tr>
                        </table>
                    </div>
                </div>
                ` : ''}

                ${showCustomerInfo ? `
                <div style="border: 1px solid #000; padding: 10px; margin-bottom: 20px; width: 50%;">
                    <strong style="border-bottom:1px solid #000; display:block; margin-bottom:5px;">CUSTOMER INFO</strong>
                    <table class="no-border">
                        <tr><td style="width:60px;">Name</td><td>: <b>${sale.customer?.name || 'Umum'}</b></td></tr>
                        <tr><td>Phone</td><td>: ${sale.customer?.phone || '-'}</td></tr>
                        <tr><td>Address</td><td>: ${sale.customer?.address || '-'}</td></tr>
                    </table>
                </div>
                ` : ''}

                <table>
                    <thead>
                        <tr>
                            <th style="width: 5%;">No</th>
                            <th style="width: ${showPrices ? '35%' : '75%'}; text-align:left;">Description</th>
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
                        <div style="border:1px solid #000; padding:10px; margin-bottom:10px;">
                            <b>Terbilang:</b> <br/><i>${numberToWords(Math.floor(sale.grandTotal))} Rupiah</i>
                        </div>
                        ` : ''}
                        
                        ${showPaymentInfo && showPrices && sale.paymentMethod === 'TRANSFER' && storeSetting?.bankName ? `
                        <div style="border:1px solid #000; padding:10px; margin-bottom:10px; display:inline-block;">
                            <b>TRANSFER:</b> ${storeSetting.bankName} - ${storeSetting.bankAccount}<br/>
                            a/n ${storeSetting.bankHolder}
                        </div>
                        ` : ''}
                        
                        ${showSignature ? `
                        <div style="display:flex; justify-content:space-between; margin-top: 30px; text-align:center;">
                            <div style="width:30%;">
                                <p>Penerima,</p>
                                <br/><br/><br/>
                                <p style="border-top:1px solid #000; display:inline-block; width:80%;">(${sale.customer?.name || 'Customer'})</p>
                            </div>
                            <div style="width:30%;">
                                <p>Hormat Kami,</p>
                                <br/><br/><br/>
                                <p style="border-top:1px solid #000; display:inline-block; width:80%;">(${sale.cashier?.name || 'Admin'})</p>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    
                    ${showPrices ? `
                    <div style="width: 35%;">
                        <table style="border:1px solid #000;">
                            <tr><td style="border:none; padding:4px 8px;">Gross Total</td><td style="border:none; padding:4px 8px; text-align:right;">${formatCurrency(sale.totalAmount).replace("Rp ","")}</td></tr>
                            <tr><td style="border:none; padding:4px 8px;">Discount</td><td style="border:none; padding:4px 8px; text-align:right; color:red;">(${formatCurrency(sale.discount).replace("Rp ","")})</td></tr>
                            <tr><td style="border:none; padding:4px 8px;">Tax</td><td style="border:none; padding:4px 8px; text-align:right;">${formatCurrency(sale.tax).replace("Rp ","")}</td></tr>
                            <tr style="border-top:1px solid #000;"><td style="border:none; padding:4px 8px;"><b>Grand Total</b></td><td style="border:none; padding:4px 8px; text-align:right;"><b>${formatCurrency(sale.grandTotal).replace("Rp ","")}</b></td></tr>
                            <tr><td style="border:none; padding:4px 8px;">Paid</td><td style="border:none; padding:4px 8px; text-align:right;">${formatCurrency(sale.paidAmount).replace("Rp ","")}</td></tr>
                            <tr><td style="border:none; padding:4px 8px;">Change</td><td style="border:none; padding:4px 8px; text-align:right;">${formatCurrency(sale.changeAmount).replace("Rp ","")}</td></tr>
                        </table>
                    </div>
                    ` : ''}
                </div>
                
                ${showFooter ? `
                <div style="text-align:center; margin-top:40px; font-size:10px; border-top:2px solid #000; padding-top:10px;">
                    <b>${footerTerms}</b>
                </div>
                ` : ''}
            </body>
        </html>
    `;
};

export const printInvoice = (sale: InvoiceData, storeSetting: StoreSetting, customLayout?: CustomLayout) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Pop-up diblokir. Izinkan pop-up untuk mencetak invoice.");
        return;
    }

    const htmlContent = generateInvoiceHtml(sale, storeSetting, customLayout);
    
    const htmlWithScript = htmlContent.replace('</body>', `
        <script>
            window.onload = function() {
                setTimeout(() => {
                    window.print();
                }, 500);
            };
            window.onafterprint = function() {
                window.close();
            };
        </script>
        </body>
    `);

    printWindow.document.write(htmlWithScript);
    printWindow.document.close();
};