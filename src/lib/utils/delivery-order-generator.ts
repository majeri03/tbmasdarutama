import { DeliveryOrderData } from "@/types/delivery-order";

export function generateDeliveryOrderHTML(deliveryOrder: DeliveryOrderData): string {
  const deliveryDate = new Date(deliveryOrder.deliveryDate).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const createdDate = new Date(deliveryOrder.createdAt).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const receivedDate = deliveryOrder.receivedDate
    ? new Date(deliveryOrder.receivedDate).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "-";

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Surat Jalan - ${deliveryOrder.doNumber}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 10mm;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, sans-serif;
            font-size: 11px;
            line-height: 1.5;
            color: #000;
            background: white;
        }
        
        .container {
            max-width: 190mm;
            margin: 0 auto;
            padding: 10mm;
        }
        
        .header {
            border: 2px solid #000;
            padding: 15px;
            margin-bottom: 15px;
        }
        
        .company-info {
            margin-bottom: 10px;
        }
        
        .company-name {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .company-details {
            font-size: 10px;
            line-height: 1.6;
        }
        
        .doc-title {
            text-align: center;
            font-size: 24px;
            font-weight: bold;
            margin: 15px 0;
            text-decoration: underline;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 15px;
        }
        
        .info-section {
            border: 1px solid #000;
        }
        
        .info-header {
            background: #e5e7eb;
            padding: 5px 10px;
            font-weight: bold;
            border-bottom: 1px solid #000;
        }
        
        .info-content {
            padding: 10px;
        }
        
        .info-row {
            display: flex;
            margin-bottom: 5px;
            font-size: 10px;
        }
        
        .info-label {
            width: 120px;
            font-weight: 500;
        }
        
        .info-value {
            flex: 1;
            font-weight: 600;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 10px;
        }
        
        th, td {
            border: 1px solid #000;
            padding: 8px;
            text-align: left;
        }
        
        th {
            background: #e5e7eb;
            font-weight: bold;
        }
        
        .text-center {
            text-align: center;
        }
        
        .text-right {
            text-align: right;
        }
        
        .signature-section {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 30px;
            margin-top: 40px;
        }
        
        .signature-box {
            text-align: center;
        }
        
        .signature-title {
            font-weight: bold;
            margin-bottom: 60px;
            font-size: 10px;
        }
        
        .signature-name {
            border-top: 1px solid #000;
            padding-top: 5px;
            font-size: 10px;
        }
        
        .notes-section {
            border: 1px solid #000;
            padding: 10px;
            margin-top: 15px;
            min-height: 60px;
        }
        
        .notes-title {
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 9px;
            color: #666;
        }
        
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
        }
        
        .status-pending {
            background: #fef3c7;
            color: #92400e;
        }
        
        .status-transit {
            background: #dbeafe;
            color: #1e40af;
        }
        
        .status-delivered {
            background: #d1fae5;
            color: #065f46;
        }
        
        .status-cancelled {
            background: #fee2e2;
            color: #991b1b;
        }
        
        @media print {
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            
            .no-print {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- HEADER -->
        <div class="header">
            <div class="company-info">
                <div class="company-name">PT. TB MASDAR UTAMA</div>
                <div class="company-details">
                    Ruko Graha Arteri Mas<br>
                    Jl. Panjang Blok 101 No.1, Jakarta 12233<br>
                    Phone: (021) 58365578 (Hunting) | Fax: (021) 58453581
                </div>
            </div>
        </div>
        
        <!-- TITLE -->
        <div class="doc-title">SURAT JALAN</div>
        
        <!-- INFO GRID -->
        <div class="info-grid">
            <!-- Left: Delivery Info -->
            <div class="info-section">
                <div class="info-header">Informasi Pengiriman</div>
                <div class="info-content">
                    <div class="info-row">
                        <div class="info-label">No. Surat Jalan</div>
                        <div class="info-value">: ${deliveryOrder.doNumber}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Tanggal Pengiriman</div>
                        <div class="info-value">: ${deliveryDate}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Tanggal Dibuat</div>
                        <div class="info-value">: ${createdDate}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Status</div>
                        <div class="info-value">
                            : <span class="status-badge status-${deliveryOrder.status.toLowerCase()}">${deliveryOrder.status}</span>
                        </div>
                    </div>
                    ${
                      deliveryOrder.driver
                        ? `
                    <div class="info-row">
                        <div class="info-label">Pengemudi</div>
                        <div class="info-value">: ${deliveryOrder.driver}</div>
                    </div>
                    `
                        : ""
                    }
                    ${
                      deliveryOrder.vehicle
                        ? `
                    <div class="info-row">
                        <div class="info-label">Kendaraan</div>
                        <div class="info-value">: ${deliveryOrder.vehicle}</div>
                    </div>
                    `
                        : ""
                    }
                </div>
            </div>
            
            <!-- Right: Customer Info -->
            <div class="info-section">
                <div class="info-header">Tujuan Pengiriman</div>
                <div class="info-content">
                    <div class="info-row">
                        <div class="info-label">Nama Customer</div>
                        <div class="info-value">: ${deliveryOrder.customer.name}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Kode Customer</div>
                        <div class="info-value">: ${deliveryOrder.customer.code}</div>
                    </div>
                    ${
                      deliveryOrder.customer.phone
                        ? `
                    <div class="info-row">
                        <div class="info-label">Telepon</div>
                        <div class="info-value">: ${deliveryOrder.customer.phone}</div>
                    </div>
                    `
                        : ""
                    }
                    ${
                      deliveryOrder.customer.address
                        ? `
                    <div class="info-row">
                        <div class="info-label">Alamat</div>
                        <div class="info-value">: ${deliveryOrder.customer.address}</div>
                    </div>
                    `
                        : ""
                    }
                    ${
                      deliveryOrder.sale
                        ? `
                    <div class="info-row">
                        <div class="info-label">No. Invoice</div>
                        <div class="info-value">: ${deliveryOrder.sale.invoiceNumber}</div>
                    </div>
                    `
                        : ""
                    }
                </div>
            </div>
        </div>
        
        <!-- ITEMS TABLE -->
        <table>
            <thead>
                <tr>
                    <th class="text-center" style="width: 40px;">No.</th>
                    <th>Kode Produk</th>
                    <th>Nama Produk</th>
                    <th class="text-center" style="width: 100px;">Jumlah</th>
                    <th class="text-center" style="width: 80px;">Satuan</th>
                    <th>Keterangan</th>
                </tr>
            </thead>
            <tbody>
                ${deliveryOrder.deliveryItems
                  .map(
                    (item, index) => `
                <tr>
                    <td class="text-center">${index + 1}</td>
                    <td>${item.product.code}</td>
                    <td><strong>${item.product.name}</strong></td>
                    <td class="text-center"><strong>${item.quantity}</strong></td>
                    <td class="text-center">${item.unit.name}</td>
                    <td>${item.notes || "-"}</td>
                </tr>
                `
                  )
                  .join("")}
            </tbody>
        </table>
        
        <!-- NOTES -->
        ${
          deliveryOrder.notes
            ? `
        <div class="notes-section">
            <div class="notes-title">Catatan:</div>
            <div>${deliveryOrder.notes}</div>
        </div>
        `
            : ""
        }
        
        <!-- RECEIVED INFO -->
        ${
          deliveryOrder.status === "DELIVERED"
            ? `
        <div class="info-section" style="margin-top: 15px;">
            <div class="info-header">Informasi Penerimaan</div>
            <div class="info-content">
                <div class="info-row">
                    <div class="info-label">Diterima Oleh</div>
                    <div class="info-value">: ${deliveryOrder.receivedBy || "-"}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Tanggal Diterima</div>
                    <div class="info-value">: ${receivedDate}</div>
                </div>
            </div>
        </div>
        `
            : ""
        }
        
        <!-- SIGNATURES -->
        <div class="signature-section">
            <div class="signature-box">
                <div class="signature-title">Pengirim</div>
                <div class="signature-name">${deliveryOrder.createdBy.name}</div>
            </div>
            <div class="signature-box">
                <div class="signature-title">Pengemudi</div>
                <div class="signature-name">${deliveryOrder.driver || "________________"}</div>
            </div>
            <div class="signature-box">
                <div class="signature-title">Penerima</div>
                <div class="signature-name">${deliveryOrder.receivedBy || "________________"}</div>
            </div>
        </div>
        
        <!-- FOOTER -->
        <div class="footer">
            <p>Dokumen ini dibuat secara otomatis oleh sistem TB Masdar Utama</p>
            <p>Dicetak pada: ${new Date().toLocaleString("id-ID")}</p>
        </div>
    </div>
</body>
</html>
  `;
}

export function printDeliveryOrder(deliveryOrder: DeliveryOrderData) {
  const html = generateDeliveryOrderHTML(deliveryOrder);
  const printWindow = window.open("", "_blank");

  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }
}

export function downloadDeliveryOrderPDF(deliveryOrder: DeliveryOrderData) {
  const html = generateDeliveryOrderHTML(deliveryOrder);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Surat-Jalan-${deliveryOrder.doNumber}.html`;
  link.click();
  URL.revokeObjectURL(url);
}