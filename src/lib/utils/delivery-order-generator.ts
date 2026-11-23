import { DeliveryOrderData } from "@/types/delivery-order";
import { getStoreSetting } from "@/lib/actions/store-setting.actions"; // Import Action
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// XSS fix (Nov 2026): semua teks dari database (nama customer, sopir,
// kendaraan, produk, catatan) di-escape sebelum ditempel ke HTML Surat Jalan.
const escapeHtml = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"} as Record<string, string>)[c]);

// Interface untuk Setting Toko
export interface StoreSetting {
  name: string;
  address?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
}

// 1. Fungsi Generate HTML (Tetap Menerima Data, Tidak Fetch Sendiri)
export function generateDeliveryOrderHTML(
  deliveryOrder: DeliveryOrderData,
  storeSetting: StoreSetting | null
): string {
  
  // Nama toko dari DB; kalau kosong tampilkan catatan jelas, bukan nama rekaan.
  // Surat jalan TIDAK PERNAH menampilkan info bank (bukan dokumen pembayaran).
  const storeName = (storeSetting?.name || "").trim() || "Data toko belum diisi";
  const storeAddress = (storeSetting?.address || "").trim();
  const storePhone = storeSetting?.phone ? `Telp: ${storeSetting.phone}` : "";

  // Logika Logo
  const storeLogo = storeSetting?.logoUrl
    ? `<img src="${escapeHtml(storeSetting.logoUrl)}" alt="Logo" style="height: 60px; width: auto; object-fit: contain;" />`
    : "";

  const deliveryDate = new Date(deliveryOrder.deliveryDate).toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
  });

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Surat Jalan - ${escapeHtml(deliveryOrder.doNumber)}</title>
    <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #333; }
        
        .container { width: 100%; max-width: 210mm; margin: 0 auto; }
        
        .header-container {
            display: flex;
            align-items: center;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .logo-box { margin-right: 15px; min-width: 60px; }
        .store-info h1 { margin: 0; font-size: 18px; font-weight: bold; text-transform: uppercase; }
        .store-info p { margin: 2px 0; font-size: 11px; }

        .title-section { text-align: center; margin-bottom: 20px; }
        .title-section h2 { text-decoration: underline; font-size: 16px; margin-bottom: 5px; }
        
        .info-grid { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .info-col { width: 48%; }
        .info-row { display: flex; margin-bottom: 4px; }
        .info-label { width: 100px; font-weight: bold; }
        .info-val { flex: 1; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #000; padding: 6px; }
        th { background-color: #f0f0f0; text-align: center; font-weight: bold; }
        
        .signatures { display: flex; justify-content: space-between; margin-top: 40px; page-break-inside: avoid; }
        .sig-box { text-align: center; width: 30%; }
        .sig-line { margin-top: 60px; border-bottom: 1px solid #000; }
        
        .footer { margin-top: 30px; font-size: 9px; text-align: right; color: #666; font-style: italic; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header-container">
            <div class="logo-box">
                ${storeLogo}
            </div>
            <div class="store-info">
                <h1>${escapeHtml(storeName)}</h1>
                ${storeAddress ? `<p>${escapeHtml(storeAddress)}</p>` : ''}
                ${storePhone ? `<p>${escapeHtml(storePhone)}</p>` : ''}
            </div>
        </div>

        <div class="title-section">
            <h2>SURAT JALAN</h2>
            <p>NO: ${escapeHtml(deliveryOrder.doNumber)}</p>
        </div>

        <div class="info-grid">
            <div class="info-col">
                <div class="info-row"><div class="info-label">Kepada Yth:</div><div class="info-val">${escapeHtml(deliveryOrder.customer.name)}</div></div>
                <div class="info-row"><div class="info-label">Alamat:</div><div class="info-val">${escapeHtml(deliveryOrder.customer.address || "-")}</div></div>
                <div class="info-row"><div class="info-label">Telepon:</div><div class="info-val">${escapeHtml(deliveryOrder.customer.phone || "-")}</div></div>
            </div>
            <div class="info-col">
                <div class="info-row"><div class="info-label">Tanggal Kirim:</div><div class="info-val">${deliveryDate}</div></div>
                <div class="info-row"><div class="info-label">Pengemudi:</div><div class="info-val">${escapeHtml(deliveryOrder.driver || "-")}</div></div>
                <div class="info-row"><div class="info-label">Kendaraan:</div><div class="info-val">${escapeHtml(deliveryOrder.vehicle || "-")}</div></div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width: 40px;">No</th>
                    <th>Kode Barang</th>
                    <th>Nama Barang</th>
                    <th style="width: 80px;">Qty</th>
                    <th style="width: 80px;">Satuan</th>
                    <th>Keterangan</th>
                </tr>
            </thead>
            <tbody>
                ${deliveryOrder.deliveryItems.map((item, i) => `
                <tr>
                    <td style="text-align: center;">${i + 1}</td>
                    <td>${escapeHtml(item.product.code)}</td>
                    <td>${escapeHtml(item.product.name)}</td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: center;">${escapeHtml(item.unit.name)}</td>
                    <td>${escapeHtml(item.notes || "")}</td>
                </tr>
                `).join("")}
            </tbody>
        </table>

        <div class="signatures">
            <div class="sig-box">
                <p>Penerima,</p>
                <div class="sig-line"></div>
                <p>${escapeHtml(deliveryOrder.receivedBy || "( ........................... )")}</p>
            </div>
            <div class="sig-box">
                <p>Pengemudi,</p>
                <div class="sig-line"></div>
                <p>${escapeHtml(deliveryOrder.driver || "( ........................... )")}</p>
            </div>
            <div class="sig-box">
                <p>Hormat Kami,</p>
                <div class="sig-line"></div>
                <p>${escapeHtml(storeName)}</p>
            </div>
        </div>

        <div class="footer">
            Dicetak pada: ${new Date().toLocaleString("id-ID")}
        </div>
    </div>
</body>
</html>
  `;
}

// Lebar render A4 di layar (96 dpi) — dipakai supaya hasil di HP sama
// dengan di desktop, tidak menyempit mengikuti lebar layar HP.
const DO_RENDER_WIDTH_PX = 794;

/** Ambil data toko dari server action; null kalau belum ada / gagal. */
async function loadStoreSetting(): Promise<StoreSetting | null> {
    try {
        const res = await getStoreSetting();
        if (res.success && res.data) {
            return {
                name: res.data.name,
                address: res.data.address,
                phone: res.data.phone,
                logoUrl: res.data.logoUrl,
            };
        }
    } catch (error) {
        console.error("Gagal memuat data toko:", error);
    }
    return null;
}

/** Render HTML surat jalan ke iframe tersembunyi selebar A4. */
function renderToHiddenIframe(html: string): Promise<HTMLIFrameElement> {
    return new Promise((resolve, reject) => {
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.left = "-9999px";
        iframe.style.top = "0";
        iframe.style.width = `${DO_RENDER_WIDTH_PX}px`;
        iframe.style.height = "100px";
        iframe.style.border = "0";
        document.body.appendChild(iframe);
        const doc = iframe.contentDocument;
        if (!doc) {
            iframe.remove();
            reject(new Error("Gagal membuat iframe"));
            return;
        }
        // Tunggu gambar logo selesai dimuat supaya ikut tercetak / ter-capture.
        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            resolve(iframe);
        };
        iframe.onload = () => window.setTimeout(done, 300);
        doc.open();
        doc.write(html);
        doc.close();
        // Fallback kalau onload tidak jalan (mis. tanpa gambar eksternal).
        window.setTimeout(done, 1500);
    });
}

function removeIframe(iframe: HTMLIFrameElement) {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
}

// 2. Fungsi Print (ASYNC: Mengambil Data Toko Dulu Baru Print)
export async function printDeliveryOrder(deliveryOrder: DeliveryOrderData) {
  // Buka window kosong dulu agar tidak kena popup blocker
  const printWindow = window.open("", "_blank");

  if (printWindow) {
    printWindow.document.write("<p>Memuat data toko...</p>");

    try {
        // FETCH DATA SETTING DARI SERVER ACTION
        const settings = await loadStoreSetting();

        // GENERATE HTML DENGAN DATA YANG BARU DIAMBIL
        const html = generateDeliveryOrderHTML(deliveryOrder, settings);

        // TULIS KE WINDOW & PRINT
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();

        // Tunggu sebentar untuk load gambar logo jika ada
        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print();
                // printWindow.close(); // Opsional: tutup setelah print
            }, 500);
        };

    } catch (error) {
        console.error("Gagal print:", error);
        printWindow.document.write("<p>Gagal memuat surat jalan.</p>");
    }
  } else {
    // Pop-up diblokir (umum di HP): cetak lewat iframe tersembunyi.
    try {
        const settings = await loadStoreSetting();
        const html = generateDeliveryOrderHTML(deliveryOrder, settings);
        const iframe = await renderToHiddenIframe(html);
        const win = iframe.contentWindow;
        if (win) {
            win.focus();
            win.print();
        }
        window.setTimeout(() => removeIframe(iframe), 1000);
    } catch (error) {
        console.error("Gagal print:", error);
        alert("Gagal mencetak surat jalan.");
    }
  }
}

// 3. Fungsi Download PDF — PDF ASLI (jsPDF + html2canvas, A4 multi-halaman),
//    bukan lagi file .html. Surat jalan panjang mengalir ke halaman 2 dst.
export async function downloadDeliveryOrderPDF(deliveryOrder: DeliveryOrderData) {
    let iframe: HTMLIFrameElement | null = null;
    try {
        const settings = await loadStoreSetting();
        const html = generateDeliveryOrderHTML(deliveryOrder, settings);

        iframe = await renderToHiddenIframe(html);
        const doc = iframe.contentDocument;
        if (!doc || !doc.body) throw new Error("Isi surat jalan tidak bisa dibaca");

        const canvas = await html2canvas(doc.body, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff",
            windowWidth: DO_RENDER_WIDTH_PX,
        });

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pdfWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        pdf.save(`SJ-${deliveryOrder.doNumber}.pdf`);
    } catch (error) {
        console.error("Gagal download:", error);
        alert("Gagal mendownload surat jalan.");
    } finally {
        if (iframe) removeIframe(iframe);
    }
}