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
    bankName?: string | null;
    bankAccount?: string | null;
    bankHolder?: string | null;
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

// --- FUNGSI BARU: GENERATE HTML SAJA ---
export const generateInvoiceHtml = (sale: InvoiceData, storeSetting: StoreSetting | null): string => {
    const storeName = storeSetting?.name || "PT. TB MASDAR UTAMA";
    const storeAddress = storeSetting?.address || "Alamat belum diatur";
    const storePhone = storeSetting?.phone ? `Phone: ${storeSetting.phone}` : "";
    
    const storeLogo = storeSetting?.logoUrl 
        ? `<img src="${storeSetting.logoUrl}" alt="Logo" style="width: 50px; height: 50px; object-fit: contain; margin-right: 10px;" />` 
        : "";

    const bankInfo = storeSetting?.bankName 
        ? `
            <p class="font-bold">TRANSFER VIA</p>
            <p>${storeSetting.bankName}</p>
            <p>A/C: ${storeSetting.bankAccount || "-"}</p>
            <p>A/N: ${storeSetting.bankHolder || "-"}</p>
          `
        : `<p class="italic text-gray-500">Informasi bank belum diatur</p>`;

    const itemsHtml = sale.saleItems.map((item, index) => {
        const unitPrice = item.unitPrice;
        const quantity = item.quantity;
        const discount = item.discount;
        const subtotal = item.subtotal;
        
        const grossAmount = unitPrice * quantity;
        const discountPercent = discount > 0 
            ? ((discount / grossAmount) * 100).toFixed(0) + "%" 
            : "0";
        
        const productName = item.product.name;
        const productCode = item.product.code;
        const unitName = item.unit.symbol || item.unit.name;

        return `
            <tr>
                <td class="text-center">${index + 1}</td>
                <td>
                    <span class="font-semibold">${productName}</span><br/>
                    <span class="text-[8px] text-gray-600">${productCode}</span>
                </td>
                <td class="text-center">${quantity} ${unitName}</td>
                <td class="text-right">${formatCurrency(unitPrice).replace("Rp ", "")}</td>
                <td class="text-right">${formatCurrency(grossAmount).replace("Rp ", "")}</td>
                <td class="text-center">${discountPercent}</td>
                <td class="text-right">${formatCurrency(discount).replace("Rp ", "")}</td>
                <td class="text-right font-semibold">${formatCurrency(subtotal).replace("Rp ", "")}</td>
            </tr>
        `;
    }).join("");

    return `
        <html>
            <head>
                <title>Invoice - ${sale.invoiceNumber}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    @page { size: A4 portrait; margin: 10mm; }
                    body { background: white; -webkit-print-color-adjust: exact; font-family: Arial, sans-serif; font-size: 12px; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid black; padding: 4px 8px; }
                    .no-border td { border: none; }
                    .text-xs { font-size: 10px; }
                    .text-xxs { font-size: 9px; }
                </style>
            </head>
            <body class="p-8">
                <div class="border-2 border-black p-4 mb-4">
                    <div class="flex justify-between items-start">
                        <div class="flex items-start">
                            ${storeLogo}
                            <div>
                                <h1 class="text-base font-bold uppercase mb-1">${storeName}</h1>
                                <p class="text-xs max-w-[250px]">${storeAddress}</p>
                                <p class="text-xs">${storePhone}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <h2 class="text-xl font-bold mb-2">INVOICE</h2>
                            <table class="text-xs ml-auto w-auto border-none">
                                <tr class="border-none"><td class="border-none py-0 text-left pr-2">Number</td><td class="border-none py-0 text-left">: ${sale.invoiceNumber}</td></tr>
                                <tr class="border-none"><td class="border-none py-0 text-left pr-2">Date</td><td class="border-none py-0 text-left">: ${format(new Date(sale.saleDate), "dd/MM/yyyy")}</td></tr>
                                <tr class="border-none"><td class="border-none py-0 text-left pr-2">Payment</td><td class="border-none py-0 text-left">: ${sale.paymentMethod}</td></tr>
                                <tr class="border-none"><td class="border-none py-0 text-left pr-2">Cashier</td><td class="border-none py-0 text-left">: ${sale.cashier?.name || "-"}</td></tr>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="mb-4 border border-black">
                    <div class="bg-gray-100 px-2 py-1 border-b border-black">
                        <p class="text-xs font-bold">Customer Info</p>
                    </div>
                    <div class="px-2 py-2">
                        <p class="text-xs font-bold">${sale.customer?.name || "Umum"}</p>
                        <p class="text-xxs">Phone: ${sale.customer?.phone || "-"}</p>
                        <p class="text-xxs">Address: ${sale.customer?.address || "-"}</p>
                    </div>
                </div>

                <table class="mb-4 text-xs">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="w-8">No</th>
                            <th class="text-left">Description</th>
                            <th class="w-20">Qty</th>
                            <th class="w-24 text-right">Price</th>
                            <th class="w-24 text-right">Gross</th>
                            <th class="w-10 text-center">%</th>
                            <th class="w-20 text-right">Disc</th>
                            <th class="w-24 text-right">Net</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div class="flex gap-4">
                    <div class="flex-1 border border-black p-3 flex flex-col justify-between">
                        <div>
                            <p class="text-xxs mb-1"><strong>Terbilang:</strong> ${numberToWords(Math.floor(sale.grandTotal))} Rupiah</p>
                            <div class="mt-2 pt-2 border-t border-gray-300 text-xxs">
                                ${bankInfo}
                            </div>
                        </div>
                        <div class="mt-4 text-center">
                            <p class="text-xxs font-bold underline">${sale.cashier?.name || "Admin"}</p>
                            <p class="text-[8px]">Authorized Signature</p>
                        </div>
                    </div>

                    <div class="w-64 border border-black">
                        <table class="w-full text-xs border-none">
                            <tr><td class="border-b border-black py-1">Gross Total</td><td class="border-b border-black py-1 text-right font-semibold">${formatCurrency(sale.totalAmount).replace("Rp ", "")}</td></tr>
                            <tr><td class="border-b border-black py-1">Discount</td><td class="border-b border-black py-1 text-right text-red-600">(${formatCurrency(sale.discount).replace("Rp ", "")})</td></tr>
                            <tr><td class="border-b border-black py-1">Tax</td><td class="border-b border-black py-1 text-right">${formatCurrency(sale.tax).replace("Rp ", "")}</td></tr>
                            <tr class="bg-gray-100"><td class="border-b border-black py-1 font-bold">Grand Total</td><td class="border-b border-black py-1 text-right font-bold text-sm">${formatCurrency(sale.grandTotal).replace("Rp ", "")}</td></tr>
                            <tr><td class="border-b border-black py-1">Paid</td><td class="border-b border-black py-1 text-right">${formatCurrency(sale.paidAmount).replace("Rp ", "")}</td></tr>
                            <tr><td class="py-1">Change</td><td class="py-1 text-right">${formatCurrency(sale.changeAmount).replace("Rp ", "")}</td></tr>
                        </table>
                    </div>
                </div>

                <div class="mt-4 text-center text-xxs border-t-2 border-black pt-1">
                    <p class="font-bold">BARANG YANG SUDAH DIBELI TIDAK DAPAT DITUKAR/DIKEMBALIKAN KECUALI ADA PERJANJIAN.</p>
                </div>
            </body>
        </html>
    `;
};

// --- UPDATE FUNGSI PRINT: PAKAI HTML DARI ATAS ---
export const printInvoice = (sale: InvoiceData, storeSetting: StoreSetting) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Pop-up diblokir. Izinkan pop-up untuk mencetak invoice.");
        return;
    }

    const htmlContent = generateInvoiceHtml(sale, storeSetting);
    
    // Tambahkan script: onafterprint akan mentrigger window.close()
    const htmlWithScript = htmlContent.replace('</body>', `
        <script>
            window.onload = function() {
                // Beri jeda sedikit agar style ter-load sempurna
                setTimeout(() => {
                    window.print();
                }, 1000);
            };

            // Event listener ini berjalan setelah dialog print ditutup (baik print atau cancel)
            window.onafterprint = function() {
                window.close();
            };
        </script>
        </body>
    `);

    printWindow.document.write(htmlWithScript);
    printWindow.document.close();
};