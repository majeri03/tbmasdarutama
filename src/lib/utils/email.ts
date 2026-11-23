import nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  try {
    const port = Number(process.env.EMAIL_PORT) || 587;
    
    // ✅ CONDITIONAL: secure = true hanya untuk port 465
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: port,
      secure: port === 465, // ✅ true untuk 465, false untuk 587
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === "production",
      },
    });

    // Send email
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || "TB Masdar Utama"}" <${
        process.env.EMAIL_FROM || process.env.EMAIL_USER
      }>`,
      to,
      subject,
      html,
    });

    console.log("[EMAIL_SENT]", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[EMAIL_ERROR]", error);
    return { success: false, error: "Gagal mengirim email" };
  }
}

export function generatePasswordResetEmail(name: string, resetUrl: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Password</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 40px 30px;
          text-align: center;
          color: white;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content {
          padding: 40px 30px;
        }
        .content h2 {
          color: #333;
          font-size: 24px;
          margin-bottom: 20px;
        }
        .content p {
          color: #666;
          line-height: 1.6;
          margin-bottom: 20px;
        }
        .button {
          display: inline-block;
          padding: 14px 32px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white !important;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 20px 0;
          transition: transform 0.2s;
        }
        .button:hover {
          transform: translateY(-2px);
        }
        .info-box {
          background: #f8f9fa;
          border-left: 4px solid #667eea;
          padding: 16px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .footer {
          background: #f8f9fa;
          padding: 30px;
          text-align: center;
          color: #999;
          font-size: 12px;
          border-top: 1px solid #e9ecef;
        }
        .warning {
          color: #dc3545;
          font-size: 14px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Reset Password</h1>
        </div>
        
        <div class="content">
          <h2>Halo, ${name}!</h2>
          
          <p>Kami menerima permintaan untuk reset password akun Anda di <strong>TB Masdar Utama</strong>.</p>
          
          <p>Klik tombol di bawah ini untuk membuat password baru:</p>
          
          <a href="${resetUrl}" class="button">Reset Password Saya</a>
          
          <div class="info-box">
            <strong>⏰ Link berlaku selama 1 jam</strong><br>
            Setelah itu, Anda perlu request reset password lagi.
          </div>
          
          <p>Jika tombol tidak berfungsi, copy dan paste URL berikut ke browser Anda:</p>
          <p style="word-break: break-all; color: #667eea;">
            ${resetUrl}
          </p>
          
          <p class="warning">
            ⚠️ <strong>Abaikan email ini</strong> jika Anda tidak merasa melakukan permintaan reset password.
          </p>
        </div>
        
        <div class="footer">
          <p><strong>TB Masdar Utama</strong></p>
          <p>Distributor Bahan Bangunan Terpercaya</p>
          <p style="margin-top: 20px;">
            Email ini dikirim secara otomatis. Jangan balas email ini.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// PKG-I (23 Nov 2026, OTP verifikasi email akun baru): email berisi kode
// 6 digit (BUKAN link). Kode berlaku 15 menit, maks 5 kali salah.
// Yang memasukkan kode adalah pemilik akun baru sendiri di halaman
// /verify-email — SUPER_ADMIN tidak boleh tahu kodenya.
export function generateOtpEmail(name: string, otpCode: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Kode Verifikasi Email</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: #f3f4f6;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }
        .header {
          background: linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%);
          padding: 32px 30px;
          text-align: center;
          color: white;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }
        .content {
          padding: 32px 30px;
          text-align: center;
        }
        .content p {
          color: #666;
          line-height: 1.6;
          margin-bottom: 16px;
          text-align: left;
        }
        .otp-code {
          display: inline-block;
          font-size: 40px;
          font-weight: 700;
          letter-spacing: 12px;
          color: #1d4ed8;
          background: #eff6ff;
          border: 2px dashed #93c5fd;
          border-radius: 12px;
          padding: 16px 24px 16px 36px;
          margin: 12px 0 20px 0;
        }
        .info-box {
          background: #f8f9fa;
          border-left: 4px solid #1d4ed8;
          padding: 14px 16px;
          margin: 16px 0;
          border-radius: 4px;
          text-align: left;
        }
        .footer {
          background: #f8f9fa;
          padding: 24px 30px;
          text-align: center;
          color: #999;
          font-size: 12px;
          border-top: 1px solid #e9ecef;
        }
        .warning {
          color: #dc3545;
          font-size: 14px;
          margin-top: 16px;
          text-align: left;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✉️ Kode Verifikasi Email</h1>
        </div>

        <div class="content">
          <p>Halo, <strong>${name}</strong>!</p>
          <p>Akun Anda di <strong>TB Masdar Utama</strong> sudah dibuat. Masukkan kode 6 digit di bawah ini di halaman verifikasi untuk mengaktifkan akun Anda:</p>

          <div class="otp-code">${otpCode}</div>

          <div class="info-box">
            <strong>⏰ Kode berlaku 15 menit</strong> dan maksimal 5 kali salah.<br>
            Kalau kedaluwarsa atau percobaan habis, minta kirim ulang kode baru dari halaman verifikasi atau ke Super Admin.
          </div>

          <p class="warning">
            ⚠️ <strong>Jangan berikan kode ini ke siapa pun</strong>, termasuk yang mengaku dari TB Masdar Utama. Kode ini hanya untuk Anda.
          </p>
        </div>

        <div class="footer">
          <p><strong>TB Masdar Utama</strong></p>
          <p>Distributor Bahan Bangunan Terpercaya</p>
          <p style="margin-top: 16px;">
            Email ini dikirim secara otomatis. Jangan balas email ini.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// PKG-H (23 Nov 2026, email pengingat utang): satu email ringkasan per
// hari — piutang pelanggan + utang supplier yang sudah jatuh tempo dan
// yang akan jatuh tempo. Link tombol mengarah ke halaman utang di web
// (dibangun dari NEXT_PUBLIC_APP_URL oleh pemanggil, bukan hardcode).
// APK belum punya skema deep link, jadi tautan web adalah satu-satunya
// tautan — di HP tautan terbuka di browser.
export interface DebtDueEmailRow {
  name: string;
  ref: string; // nomor invoice (piutang) / nomor PO (utang supplier)
  dueDateLabel: string;
  remaining: number;
  daysOverdue: number; // >= 0 = sudah lewat jatuh tempo (0 = hari ini), < 0 = akan jatuh tempo
}

export interface DebtDueEmailData {
  isTest?: boolean; // true = email tes dari tab Pengaturan (tampilkan spanduk TES)
  dateLabel: string; // tanggal ringkasan, mis. "23 November 2026"
  customerOverdue: DebtDueEmailRow[];
  customerDueSoon: DebtDueEmailRow[];
  supplierOverdue: DebtDueEmailRow[];
  supplierDueSoon: DebtDueEmailRow[];
  totalCustomerOverdue: number;
  totalSupplierOverdue: number;
  customerDebtsUrl: string;
  supplierDebtsUrl: string;
  customerDebtsAppUrl?: string; // deep link tbmasdarutama://utang?jenis=customer (opsional — kalau kosong, hanya tombol web)
  supplierDebtsAppUrl?: string; // deep link tbmasdarutama://utang?jenis=supplier
}

function debtDueStatusLabel(row: DebtDueEmailRow): string {
  if (row.daysOverdue > 0) return `Terlambat ${row.daysOverdue} hari`;
  if (row.daysOverdue === 0) return "Jatuh tempo hari ini";
  const n = -row.daysOverdue;
  return `Jatuh tempo dalam ${n} hari`;
}

function debtDueRowsHtml(rows: DebtDueEmailRow[]): string {
  if (rows.length === 0) return "";
  return `
    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 12px 0 20px 0;">
      <thead>
        <tr style="background: #f8f9fa; color: #555;">
          <th style="text-align: left; padding: 10px 8px; border-bottom: 2px solid #e9ecef;">Nama</th>
          <th style="text-align: left; padding: 10px 8px; border-bottom: 2px solid #e9ecef;">No. Bukti</th>
          <th style="text-align: left; padding: 10px 8px; border-bottom: 2px solid #e9ecef;">Jatuh Tempo</th>
          <th style="text-align: right; padding: 10px 8px; border-bottom: 2px solid #e9ecef;">Sisa</th>
          <th style="text-align: left; padding: 10px 8px; border-bottom: 2px solid #e9ecef;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            <td style="padding: 10px 8px; border-bottom: 1px solid #f0f0f0;">${r.name}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #f0f0f0;">${r.ref}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #f0f0f0;">${r.dueDateLabel}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: 600;">Rp ${r.remaining.toLocaleString("id-ID")}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #f0f0f0;">${debtDueStatusLabel(r)}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

function debtDueSectionHtml(
  title: string,
  overdue: DebtDueEmailRow[],
  dueSoon: DebtDueEmailRow[],
  totalOverdue: number,
  pageUrl: string,
  buttonLabel: string,
  appUrl?: string
): string {
  if (overdue.length === 0 && dueSoon.length === 0) return "";
  return `
    <h2 style="color: #333; font-size: 20px; margin: 28px 0 8px 0;">${title}</h2>
    ${
      overdue.length > 0
        ? `<p style="color: #b91c1c; font-weight: 600; margin: 0 0 4px 0;">Sudah jatuh tempo — total sisa Rp ${totalOverdue.toLocaleString("id-ID")}</p>
           ${debtDueRowsHtml(overdue)}`
        : `<p style="color: #666; margin: 0 0 4px 0;">Tidak ada yang sudah jatuh tempo.</p>`
    }
    ${
      dueSoon.length > 0
        ? `<p style="color: #92400e; font-weight: 600; margin: 0 0 4px 0;">Akan jatuh tempo</p>
           ${debtDueRowsHtml(dueSoon)}`
        : ""
    }
    ${
      appUrl
        ? `<a href="${appUrl}" style="display: inline-block; padding: 12px 28px; background: #991b1b; color: white !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 8px 8px 4px 0;">Buka di Aplikasi</a>`
        : ""
    }
    <a href="${pageUrl}" style="display: inline-block; padding: 12px 28px; background: #1d4ed8; color: white !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 8px 0 4px 0;">${buttonLabel}</a>
    <p style="word-break: break-all; color: #1d4ed8; font-size: 13px;">${pageUrl}</p>
    ${
      appUrl
        ? `<p style="color: #999; font-size: 12px; margin: 4px 0 0 0;">Tombol "Buka di Aplikasi" hanya berfungsi kalau aplikasi TB Masdar Utama sudah terinstal di HP ini — kalau belum, pakai tombol web di atas.</p>`
        : ""
    }`;
}

export function generateDebtDueEmail(data: DebtDueEmailData) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Ringkasan Utang Jatuh Tempo</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: #f3f4f6;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }
        .header {
          background: linear-gradient(135deg, #991b1b 0%, #b45309 100%);
          padding: 32px 30px;
          text-align: center;
          color: white;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }
        .content {
          padding: 32px 30px;
        }
        .content p {
          color: #666;
          line-height: 1.6;
          margin-bottom: 12px;
        }
        .footer {
          background: #f8f9fa;
          padding: 24px 30px;
          text-align: center;
          color: #999;
          font-size: 12px;
          border-top: 1px solid #e9ecef;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 Ringkasan Utang Jatuh Tempo</h1>
          <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9);">${data.dateLabel}</p>
        </div>

        <div class="content">
          ${
            data.isTest
              ? `<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 16px; margin-bottom: 20px; border-radius: 4px;">
                   <strong>✉️ Ini email TES</strong> dari tab Notifikasi Utang — dikirim untuk memastikan pengiriman email berjalan. Isi di bawah ini adalah data nyata saat ini (atau contoh kalau belum ada utang).
                 </div>`
              : ""
          }
          <p>Halo, berikut ringkasan utang <strong>TB Masdar Utama</strong> per hari ini. Klik tombol di bawah setiap bagian untuk membuka langsung halaman utang terkait di aplikasi atau di web.</p>
          ${debtDueSectionHtml(
            "Piutang Pelanggan",
            data.customerOverdue,
            data.customerDueSoon,
            data.totalCustomerOverdue,
            data.customerDebtsUrl,
            "Lihat Piutang Pelanggan",
            data.customerDebtsAppUrl
          )}
          ${debtDueSectionHtml(
            "Utang ke Supplier",
            data.supplierOverdue,
            data.supplierDueSoon,
            data.totalSupplierOverdue,
            data.supplierDebtsUrl,
            "Lihat Utang Supplier",
            data.supplierDebtsAppUrl
          )}
          <p style="margin-top: 24px; font-size: 13px; color: #999;">
            Email ini dikirim otomatis sekali sehari (pukul 08:00 WITA) hanya kalau ada utang yang mencapai jadwal pengingat. Daftar penerima diatur SUPER_ADMIN di Pengaturan → Notifikasi Utang.
          </p>
        </div>

        <div class="footer">
          <p><strong>TB Masdar Utama</strong></p>
          <p>Distributor Bahan Bangunan Terpercaya</p>
          <p style="margin-top: 16px;">
            Email ini dikirim secara otomatis. Jangan balas email ini.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}