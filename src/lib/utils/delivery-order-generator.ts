import { DeliveryOrderData } from "@/types/delivery-order";
import { getStoreSetting } from "@/lib/actions/store-setting.actions"; // Import Action

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
  
  const storeName = storeSetting?.name || "TB Masdar Utama";
  const storeAddress = storeSetting?.address || "Alamat belum diatur";
  const storePhone = storeSetting?.phone ? `Telp: ${storeSetting.phone}` : "";

  // Logika Logo
  const storeLogo = storeSetting?.logoUrl
    ? `<img src="${storeSetting.logoUrl}" alt="Logo" style="height: 60px; width: auto; object-fit: contain;" />`
    : "";

  const deliveryDate = new Date(deliveryOrder.deliveryDate).toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
  });

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Surat Jalan - ${deliveryOrder.doNumber}</title>
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
                <h1>${storeName}</h1>
                <p>${storeAddress}</p>
                <p>${storePhone}</p>
            </div>
        </div>

        <div class="title-section">
            <h2>SURAT JALAN</h2>
            <p>NO: ${deliveryOrder.doNumber}</p>
        </div>

        <div class="info-grid">
            <div class="info-col">
                <div class="info-row"><div class="info-label">Kepada Yth:</div><div class="info-val">${deliveryOrder.customer.name}</div></div>
                <div class="info-row"><div class="info-label">Alamat:</div><div class="info-val">${deliveryOrder.customer.address || "-"}</div></div>
                <div class="info-row"><div class="info-label">Telepon:</div><div class="info-val">${deliveryOrder.customer.phone || "-"}</div></div>
            </div>
            <div class="info-col">
                <div class="info-row"><div class="info-label">Tanggal Kirim:</div><div class="info-val">${deliveryDate}</div></div>
                <div class="info-row"><div class="info-label">Pengemudi:</div><div class="info-val">${deliveryOrder.driver || "-"}</div></div>
                <div class="info-row"><div class="info-label">Kendaraan:</div><div class="info-val">${deliveryOrder.vehicle || "-"}</div></div>
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
                    <td>${item.product.code}</td>
                    <td>${item.product.name}</td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: center;">${item.unit.name}</td>
                    <td>${item.notes || ""}</td>
                </tr>
                `).join("")}
            </tbody>
        </table>

        <div class="signatures">
            <div class="sig-box">
                <p>Penerima,</p>
                <div class="sig-line"></div>
                <p>${deliveryOrder.receivedBy || "( ........................... )"}</p>
            </div>
            <div class="sig-box">
                <p>Pengemudi,</p>
                <div class="sig-line"></div>
                <p>${deliveryOrder.driver || "( ........................... )"}</p>
            </div>
            <div class="sig-box">
                <p>Hormat Kami,</p>
                <div class="sig-line"></div>
                <p>${storeName}</p>
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

// 2. Fungsi Print (ASYNC: Mengambil Data Toko Dulu Baru Print)
export async function printDeliveryOrder(deliveryOrder: DeliveryOrderData) {
  // Buka window kosong dulu agar tidak kena popup blocker
  const printWindow = window.open("", "_blank");
  
  if (printWindow) {
    printWindow.document.write("<p>Memuat data toko...</p>");
    
    try {
        // FETCH DATA SETTING DARI SERVER ACTION
        const res = await getStoreSetting();
        let settings: StoreSetting | null = null;
        
        if (res.success && res.data) {
            settings = {
                name: res.data.name,
                address: res.data.address,
                phone: res.data.phone,
                logoUrl: res.data.logoUrl
            };
        }

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
    alert("Pop-up diblokir. Izinkan pop-up untuk mencetak.");
  }
}

// 3. Fungsi Download PDF (ASYNC JUGA)
export async function downloadDeliveryOrderPDF(deliveryOrder: DeliveryOrderData) {
    try {
        const res = await getStoreSetting();
        let settings: StoreSetting | null = null;
        
        if (res.success && res.data) {
            settings = {
                name: res.data.name,
                address: res.data.address,
                phone: res.data.phone,
                logoUrl: res.data.logoUrl
            };
        }

        const html = generateDeliveryOrderHTML(deliveryOrder, settings);
        
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `SJ-${deliveryOrder.doNumber}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error("Gagal download:", error);
        alert("Gagal mendownload surat jalan.");
    }
}