import nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  try {
    const port = Number(process.env.EMAIL_PORT) || 587;
    
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: port,
      secure: port === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
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