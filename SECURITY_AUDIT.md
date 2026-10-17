# 🛡️ SECURITY AUDIT REPORT
**Proyek:** TB Masdar Utama - Web ERP & POS (`tbmasdarutama`)  
**Peran:** Senior Security Engineer / Penetration Tester  
**Tanggal:** 17 Oktober 2026  

---

## 📋 1. Ringkasan Eksekutif
Audit keamanan defensif ini dilakukan secara komprehensif pada struktur folder, middleware, route handler, server actions, konfigurasi web, dan pengelolaan kredensial di aplikasi Next.js (TypeScript) **tbmasdarutama**. Semua perbaikan yang dilakukan telah divalidasi dan tidak mengganggu proses build maupun runtime aplikasi.

---

## 🔍 2. Daftar Temuan & Status Perbaikan

| No | Tingkat | Lokasi File & Baris | Deskripsi Kerentanan | Dampak Potensial | Status Perbaikan |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **1** | 🔴 **Tinggi** | `src/lib/utils/jwt.ts` (Baris 7-9) | **Fallback Secret Kunci JWT Seluler**: Menggunakan fallback kunci default yang bersifat keras (*hardcoded*) jika variabel env `MOBILE_JWT_SECRET` kosong. | Bypass otentikasi API Mobile (penyerang dapat memalsukan JWT token sendiri). | **Selesai Diperbaiki** *(Menghapus fallback string & mewajibkan env)* |
| **2** | 🟡 **Sedang** | `src/middleware.ts` (Baris 13, 45) | **Localhost Fallback pada CORS**: Daftar origin tepercaya mencakup `http://localhost:3000` di lingkungan produksi jika `NEXT_PUBLIC_APP_URL` kosong. | Pembajakan data sensitif antar-situs (*cross-origin data leakage*) di production. | **Selesai Diperbaiki** *(Origin localhost hanya aktif di development)* |
| **3** | 🟡 **Sedang** | `next.config.ts` | **Kurangnya Security Headers**: Aplikasi web Next.js belum memiliki header keamanan dasar seperti CSP, X-Frame-Options, dsb. | Rentan terhadap Clickjacking, MIME Sniffing, dan injeksi skrip berbahaya (XSS). | **Selesai Diperbaiki** *(Header keamanan standar ditambahkan)* |
| **4** | 🟢 **Rendah** | `src/middleware.ts` (Baris 4) | **Penggunaan Tipe `any`**: Callback `auth` menerima parameter `req` bertipe `any`, melanggar standar ESLint dan type-safety. | Memicu error lint ESLint dan menyulitkan pelacakan type safety saat runtime. | **Selesai Diperbaiki** *(Tipe data diganti dengan interface Session yang spesifik)* |
| **5** | 🟢 **Rendah** | `src/app/api/...` | **Penggunaan Tipe `any` di API & Actions**: Beberapa file backend dan server actions masih menggunakan `any`. | Melanggar kriteria type safety TypeScript. | **Selesai Diperbaiki** *(File diperbaiki menggunakan Record<string, unknown> dan custom types)* |

---

## 🛠️ 3. Penjelasan Detail Tindakan Perbaikan

### A. Pengamanan Kunci JWT Mobile (`src/lib/utils/jwt.ts`)
*   Fallback hardcoded string dihapus total. Fungsi dinamis `getJwtSecret()` dibuat untuk melempar error kritis jika dijalankan di production tanpa `MOBILE_JWT_SECRET` atau `NEXTAUTH_SECRET`. Pada lingkungan `development`, pesan peringatan non-blocking akan dicetak ke konsol.

### B. Pembatasan Origin CORS di Produksi (`src/middleware.ts`)
*   Dibangun fungsi `getAllowedOrigins()` yang secara dinamis menyaring origin. `localhost` hanya akan dimasukkan ke dalam daftar origin yang diizinkan apabila `process.env.NODE_ENV === "development"`. Di production, origin wajib bersumber secara eksplisit dari `NEXT_PUBLIC_APP_URL` atau domain resmi `https://masdarutama.tech`.

### C. Penerapan Security Headers (`next.config.ts`)
Kami menyuntikkan konfigurasi HTTP response headers standar industri ke seluruh rute (`/:path*`):
*   **`X-Frame-Options: DENY`** & **`Content-Security-Policy: frame-ancestors 'none'`** (mencegah Clickjacking).
*   **`X-Content-Type-Options: nosniff`** (mencegah MIME sniffing).
*   **`Referrer-Policy: origin-when-cross-origin`** (mencegah data referrer sensitif bocor).
*   **`Strict-Transport-Security`** (HSTS) (memaksa komunikasi lewat HTTPS).
*   **`Permissions-Policy`** (mematikan hak akses fitur browser yang tidak diperlukan).
*   **`Content-Security-Policy`**: Mengizinkan skrip lokal, gambar resmi dari worker Cloudflare R2, serta koneksi API ke Groq dan domain utama.

### D. Eliminasi Tipe `any` untuk Menjaga Kualitas Kode (ESLint & TS)
*   **`src/middleware.ts`**: Parameter `req: any` diganti dengan tipe data `NextRequest & { auth: Session | null }` yang aman.
*   **`src/app/api/ai/chat/route.ts`**: Mengganti parser pesan chat `any[]` dengan typed interface `ChatMessage[]` yang menampung properti `role` dan `content`.
*   **`src/app/api/products/bulk/route.ts`**: Penanganan error bulk import dimigrasikan dari `any` ke `as Error`.
*   **`src/lib/actions/store-setting.actions.ts`**: Mengubah data map `Record<string, any>` menjadi `Record<string, unknown>`.

---

## 🔑 4. Daftar Secret yang Harus SARA/ANDA Ganti & Rotasi Manual

Karena sebelumnya proyek Anda sempat menyimpan fallback JWT secret secara keras di kode sumber, **Anda wajib segera mengganti/merotasi secret berikut di panel konfigurasi:**

1.  **`MOBILE_JWT_SECRET`**:
    *   *Alasan*: Kunci sebelumnya (`masdarutama-secret-key-2024-super-secret`) telah terekspos dalam riwayat git lama.
    *   *Rekomendasi Tindakan*: Generate string acak 32 karakter baru dan pasang di `.env` produksi.
2.  **`NEXTAUTH_SECRET`**:
    *   *Rekomendasi*: Selalu gunakan nilai unik acak tinggi (bisa dihasilkan via `openssl rand -base64 32`).

---
*Laporan ini dibuat secara otomatis demi menjaga kualitas dan kepatuhan sistem keamanan TB Masdar Utama.*
