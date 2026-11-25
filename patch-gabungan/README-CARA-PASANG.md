# README — CARA PASANG PAKET PERBAIKAN GABUNGAN (25 Nov 2026)

Paket perbaikan web TB Masdar Utama: **44 item gagal** dari pengujian blackbox
8 batch (24–25 Nov 2026) + cacat-cil lain yang ditemukan saat membaca kode.
Semua patch berbasis backend HEAD **`ffb435e`**. Repo:
`https://github.com/majeri03/tbmasdarutama`.

> **BACA DULU — STATUS PAKET INI**
>
> Paket ini **BELUM terverifikasi / BELUM final**. Yang sudah dicek di sini:
> ke-19 patch lolos `git apply --check` + full apply **berurutan dalam satu
> fresh clone `ffb435e`** (terakhir dicek 25 Nov 2026), dan isi tiap patch
> dibaca ulang. Yang **TIDAK BISA** jalan di environment pembuat paket ini:
> `npx tsc` dan `npm run build` (tidak ada `node_modules` / toolchain di sana).
> **Laptop Jery yang memutuskan: `npx tsc --noEmit` dan `npm run build`
> HARUS lolos sebelum commit + push.** Kalau build gagal, JANGAN push —
> kirim baris error paling bawah ke Jett.
>
> Paket ini hanya untuk **website (Vercel)**. TIDAK ada patch APK di sini.
> APK tidak disentuh sama sekali.

---

## 0. Sebelum mulai — cek posisi repo

Jalankan dari folder repo backend di laptop
(`D:\laragon\www\proyekmasdarutama\tbmasdarutama`):

```powershell
cd D:\laragon\www\proyekmasdarutama\tbmasdarutama
git status
git log --oneline -1
```

Pastikan: tidak ada perubahan yang belum di-commit, dan HEAD adalah
`ffb435e`. Kalau HEAD sudah bukan `ffb435e` (ada push baru), **berhenti** dan
tanya Jett dulu — patch-patch ini dibuat di atas `ffb435e`.

**Download-first:** simpan SEMUA file `.patch` dari paket ini ke dalam folder
repo dulu (satu folder, mis. `D:\laragon\www\proyekmasdarutama\tbmasdarutama\patch-gabungan\`),
baru jalankan `git apply`. Jangan apply dari folder lain.

---

## 1. Urutan pasang — 19 patch, HARUS berurutan

Jangan diubah urutannya: beberapa patch menyentuh file yang sama dan hanya
apply bersih dalam urutan ini. Pasang satu per satu; kalau satu patch gagal,
berhenti di situ dan kirim pesan errornya ke Jett.

```powershell
cd D:\laragon\www\proyekmasdarutama\tbmasdarutama
git apply patch-gabungan\pos-diskon-rounding.patch
git apply patch-gabungan\pos-batch-1b-bug25-26-28.patch
git apply patch-gabungan\ws-a-auth.patch
git apply patch-gabungan\ws-b-dashboard.patch
git apply patch-gabungan\ws-d-sales.patch
git apply patch-gabungan\ws-e-products.patch
git apply patch-gabungan\ws-f-masterdata.patch
git apply patch-gabungan\ws-g-stock-po.patch
git apply patch-gabungan\ws-h-do.patch
git apply patch-gabungan\ws-l-salesman-notif.patch
git apply patch-gabungan\ws-j-reports.patch
git apply patch-gabungan\ws-k-settings.patch
git apply patch-gabungan\ws-n-pageaccess.patch
git apply patch-gabungan\ws-o-landing.patch
git apply patch-gabungan\ws-p-invoice.patch
git apply patch-gabungan\ws-p2-invoicepdf.patch
git apply patch-gabungan\ws-q-api-cash.patch
git apply patch-gabungan\ws-j2-nomor-tanggal.patch
git apply patch-gabungan\koordinator.patch
```

Nama file patch di tiap folder:

| No | Folder | File patch | Isi singkat |
|----|--------|-----------|-------------|
| 1 | `01-pos-diskon-rounding` | `pos-diskon-rounding.patch` | Diskon POS dibulatkan SEKALI (item 23) |
| 2 | `02-pos-ui` | `pos-batch-1b-bug25-26-28.patch` | Barcode+Enter, poin di POS, quick-add auto-pilih (item 25, 26, 28) |
| 3 | `ws-a-auth` | `ws-a-auth.patch` | Logout loop sesi basi, redirect domain lama |
| 4 | `ws-b-dashboard` | `ws-b-dashboard.patch` | Grafik dashboard, tautan Laporan, "+100%" |
| 5 | `ws-d-sales` | `ws-d-sales.patch` | Statistik + pagination + pencarian penjualan, filter tanggal inklusif, label "Batalkan Penjualan (Tutup Buku)" (item 46, 47, 50, 57) |
| 6 | `ws-e-products` | `ws-e-products.patch` | Stok Menipis, restore produk, "Zak"→"Sak" (item 58, 66, 70) |
| 7 | `ws-f-masterdata` | `ws-f-masterdata.patch` | Kode supplier, Total Piutang, Total Belanja, badge UMUM, pesan poin jujur, dropdown sub-kategori, jam pembayaran benar (item 83, 87, 92) |
| 8 | `ws-g-stock-po` | `ws-g-stock-po.patch` | Definisi Stok Rendah satu pintu, produk stok 0 tampil di PO (item 96, 108) |
| 9 | `ws-h-do` | `ws-h-do.patch` | Simpan Edit DO + kolom alamat, Update Status DO terkirim, hapus foto tersimpan (item 118, 120) |
| 10 | `ws-l-salesman-notif` | `ws-l-salesman-notif.patch` | Tombol Hapus salesman / Hapus yang Dibaca / Hapus penerima (item 166, 193, 174), notifikasi DO usang (item 194) |
| 11 | `ws-j-reports` | `ws-j-reports.patch` | Crash Laporan Inventory & Katalog, rekonsiliasi Laporan Keuangan, stempel WITA (item 141, 142, 144, 147) |
| 12 | `ws-k-settings` | `ws-k-settings.patch` | Tombol Hapus Logo, Pengiriman Terakhir, Kirim Email Tes, cron 08:00 WITA, label HAPUS MASSAL (item 153, 175, 176, 163) |
| 13 | `ws-n-pageaccess` | `ws-n-pageaccess.patch` | Migrasi data Akses Halaman sesuai keputusan (item 184) |
| 14 | `ws-o-landing` | `ws-o-landing.patch` | Hero + carousel, katalog #products, logo fallback (item 204, 205) |
| 15 | `ws-p-invoice` | `ws-p-invoice.patch` | Faktur NCR tanpa logo/garis, watermark PAID/UNPAID, lookup invoice (item 208, 211, 220) |
| 16 | `ws-p2-invoicepdf` | `ws-p2-invoicepdf.patch` | Faktur NCR di generator PDF kedua (item 208) |
| 17 | `ws-q-api-cash` | `ws-q-api-cash.patch` | Halaman + menu Kas, rute GET /api/reports/sales, batas atas "Bulan Ini" (item 233, 235, 225) |
| 18 | `ws-j2-nomor-tanggal` | `ws-j2-nomor-tanggal.patch` | Nomor dokumen memakai tanggal WITA (item 139) |
| 19 | `19-koordinator` | `koordinator.patch` | CSP izinkan Google Maps, Stok Rendah dashboard `<=`, stempel WITA di pdf-helpers, komentar cron, offset WITA +7→+8 |

Dua folder **TIDAK berisi patch** (sengaja — baca isinya):
- `ws-m-users-investigasi/NOTES.md` — penyelidikan item 178 (user pending OTP
  hilang): tidak ada mekanisme di kode yang bisa menghapus mereka. Kemungkinan
  besar dihapus manual. Tidak ada perbaikan mengada-ada yang dibuat.
- `apk-fleet-investigasi/CATATAN.md` — penyelidikan kenapa tracking armada
  tidak tampil untuk ADMIN/KASIR di APK (read-only, tanpa patch — perbaikannya
  ditunda sampai Jery selesai testing APK).

---

## 2. Migrasi database (WAJIB, sebelum build)

Patch nomor 13 membawa migrasi baru
`prisma/migrations/20261125190000_page_access_defaults/migration.sql` yang
menulis nilai Akses Halaman sesuai keputusan Jery (POS ADMIN+KASIR aktif,
dst). Migrasi ini idempotent (aman dijalankan ulang) dan hanya jalan sekali.

```powershell
npx prisma migrate deploy
npx prisma generate
```

---

## 3. Type check + build (WAJIB, yang memutuskan)

```powershell
npx tsc --noEmit
npm run build
```

- Kalau `tsc` gagal: kirim errornya ke Jett, jangan lanjut.
- Kalau `npm run build` gagal: yang penting adalah **satu error di baris
  paling bawah** log — kirim baris itu (warning di atasnya biasanya bukan
  masalah). Pelajaran lama: `tsc` lolos TIDAK menjamin build lolos.
- Kalau keduanya lolos, baru commit + push:

```powershell
git add -A
git commit -m "perbaikan gabungan 44 item hasil blackbox 24-25 Nov 2026"
git push
```

Vercel akan deploy otomatis dari push. Tunggu deploy selesai (status Success
di dashboard Vercel) sebelum mengetes.

---

## 4. Langkah manual di Vercel (TIDAK bisa diperbaiki dari kode)

### 4a. Env domain — WAJIB (kalau tidak, redirect domain lama tetap terjadi)
Di dashboard Vercel → Project → Settings → Environment Variables, ubah
ketiga variabel ini menjadi domain baru, lalu **Redeploy**:

- `AUTH_URL` = `https://tbmasdarutama.vercel.app`
- `NEXTAUTH_URL` = `https://tbmasdarutama.vercel.app`
- `NEXT_PUBLIC_APP_URL` = `https://tbmasdarutama.vercel.app`

Penyebab: Auth.js mengambil base URL dari env ini. Selama env masih
`https://masdarutama.tech`, login/logout/redirect Auth.js tetap memakai
domain lama (temuan WS-A). Kode tidak bisa menimpa env dari dalam aplikasi.

### 4b. Kembalikan logo asli toko — WAJIB (logo tes masih tampil)
Saat pengujian item 153, logo asli toko tertimpa logo tes (kesalahan Jett —
sudah diakui). File logo asli hanya tersisa di repo APK. Caranya:
Settings → Info Toko → Upload Logo → pilih file
`D:\laragon\www\proyekmasdarutama\masdarutamaapk\assets\logomasdarutama.png`
→ Simpan. Setelah paket ini dipasang, ada tombol **Hapus Logo** bila nanti
logo perlu dihapus (tidak perlu upload untuk menghapus).

### 4c. Perbaiki data satuan "Zak" → "Sak" — WAJIB (item 70)
"Zak" bukan dari kode — itu baris DATA di tabel `units` (kemungkinan salah
ketik dulu). Patch nomor 6 mencegah baris "Zak" baru dibuat, tapi baris lama
harus digabung manual. Jalankan di database produksi (Neon) — ganti
`<id-zak>` dan `<id-sak>` dengan id sebenarnya dari SELECT pertama:

```sql
SELECT id, name FROM units WHERE UPPER(name) IN ('ZAK','SAK');
-- Misal id Zak = '<id-zak>', id Sak = '<id-sak>':
UPDATE product_units  SET "unitId" = '<id-sak>' WHERE "unitId" = '<id-zak>';
UPDATE sale_items     SET "unitId" = '<id-sak>' WHERE "unitId" = '<id-zak>';
UPDATE purchase_items SET "unitId" = '<id-sak>' WHERE "unitId" = '<id-zak>';
UPDATE delivery_items SET "unitId" = '<id-sak>' WHERE "unitId" = '<id-zak>';
DELETE FROM units WHERE id = '<id-zak>';
```

JANGAN sekadar `UPDATE units SET name='Sak' WHERE name='Zak'` kalau baris
"Sak" sudah ada — kolom `name` itu unik, rename langsung akan gagal.
Setelah dibersihkan, cetak ulang invoice lama akan menampilkan "Sak"
karena invoice membaca nama satuan secara live.

### 4d. DATABASE_URL — masih tertunda dari audit sebelumnya
Tambahkan `?connection_limit=5&pool_timeout=10` ke `DATABASE_URL` di env
Vercel, lalu redeploy. (Bisa digabung dengan redeploy 4a.)

---

## 5. Yang diputuskan Jery (sudah diterapkan di patch — tidak perlu diutak-atik)

- **Item 57 (hapus penjualan): TIDAK ada hard-delete.** Tombol berubah
  menjadi "Batalkan Penjualan (Tutup Buku)" dengan penjelasan jujur.
  Penjualan CANCELLED dikeluarkan dari SEMUA total (Total Belanja, kartu
  statistik, laporan) tapi barisnya tetap tampil sebagai arsip "Dibatalkan".
  Tanpa tabel baru, tanpa cascade — tidak membebani database.
- **Item 184 (Akses Halaman):** POS ADMIN AKTIF + KASIR AKTIF; Reports dan
  Settings ADMIN AKTIF + KASIR NONAKTIF; PO Barang ADMIN AKTIF + KASIR
  NONAKTIF; Desain dan Layout Invoice khusus SUPER_ADMIN; Stock Opname ADMIN
  AKTIF + KASIR NONAKTIF. Nilai ini ditulis migrasi (patch 13). **Jery bisa
  mengubah toggle apa pun kapan saja** di halaman Akses Halaman — perubahan
  manual setelah migrasi tetap bertahan (migrasi hanya jalan sekali).
- **Item 225 (kartu "Pembayaran Bulan Ini" naik 2x):** pelacakan kode
  membuktikan satu pembayaran hanya membuat SATU baris — jadi kenaikan 2x
  berarti ada baris pembayaran kedua Rp1.000 di bulan itu (kemungkinan
  pembayaran terkirim dua kali — API belum punya proteksi idempotency).
  Patch 17 memperbaiki cacat agregasi yang nyata (filter "Bulan Ini" tanpa
  batas atas). **Sebelum mengetes ulang, cek tabel `DebtPayment` November:**
  kalau ada dua baris Rp1.000 untuk DEBT-CUST-001, anomali sudah terjawab
  dan itu data ganda, bukan bug hitungan. Proteksi idempotency belum dibuat
  (butuh keputusan desain — lihat §7).
- **Fleet tracking APK:** hanya diselidiki, TIDAK diperbaiki. Penyebab
  paling mungkin sudah ditulis di `apk-fleet-investigasi/CATATAN.md` —
  perbaikannya ditunda sampai Jery selesai testing APK.

---

## 6. Item yang TIDAK diperbaiki (dengan alasan)

- **178** — dua user pending OTP hilang dari daftar: tidak ada mekanisme di
  kode yang bisa menghapus/menyembunyikan mereka (diselidiki di
  `ws-m-users-investigasi/NOTES.md`). Kemungkinan dihapus manual.
- **186** — bukan bug (backfill 0 baru karena semua file sudah terlacak).
- **196** — bukan bug (23 menu benar: ada 2 menu baru Salesman + Poin).
- **159 / 164** — sengaja tidak dieksekusi saat tes (form ganti password dan
  Tutup Buku tidak disubmit) — tidak ada yang diperbaiki.
- **126 / 132 / 177 / 189 / 234** — belum bisa dites (butuh APK / kondisi
  yang belum ada) — tidak ada perbaikan yang bisa dibuat dari hasil tes.
- **Paruh berbasis peran (183, 216, 217, 223, 229, 232, dst.)** — butuh login
  kasir/admin; Jery menunda pengecekan peran ("lainkali"). Setelah deploy,
  cek peran ini dengan login kasir/admin.
- **Logo header rusak (bagian dari 204)** — pulih sendiri saat logo asli
  di-upload ulang (§4b); komponennya sudah dibuat menangani logo kosong
  dengan anggun (monogram huruf).
- **Notifikasi usang (bagian dari 194)** — notifikasi lama untuk DO yang
  sudah dihapus TIDAK dihapus otomatis oleh patch; saat diketuk, tampil
  banner penjelasan + tombol hapus notifikasi usang itu. Ke depannya, hapus
  DO juga menghapus notifikasinya.
- **Dua customer bernama "Umum"** — patch hanya memperbaiki tampilan (badge
  TIPE + pilihan filter Umum). Nama customer TIDAK diubah lewat kode. Kalau
  mau, hapus/gabung duplikatnya manual lewat halaman Pelanggan.

---

## 7. Follow-up yang belum diputuskan / perlu Jery

1. **Idempotency pencatatan pembayaran utang** (item 225): butuh idempotency
   key dari client (modal + API + action) supaya satu pembayaran tidak bisa
   tercatat dua baris. Belum dibuat — butuh keputusan desain.
2. **Pelunasan piutang tidak mencatat `CashMovement`** (temuan WS-Q):
   saldo halaman Kas tidak mencerminkan uang pelunasan piutang / pembayaran
   utang supplier. Saat ini dibiarkan seperti perilaku lama. Mau dibuat
   otomatis atau tidak?
3. **Permission khusus kas** (temuan WS-Q): menu + halaman Kas saat ini
   memakai permission `VIEW_REPORTS` (ADMIN+). Kalau Jery mau Kas punya hak
   akses sendiri, perlu `VIEW_CASH_MOVEMENTS` + `pageKey` baru.
4. **Fee salesman untuk penjualan CANCELLED/RETURN** — keputusan lama yang
   masih terbuka: saat ini fee dihitung untuk semua baris penjualan.
5. **Turnstile (Cloudflare)** — setup masih tertunda (buat site gratis,
   isi `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` di Vercel, redeploy).
   Sampai saat itu Turnstile fail-open (login tetap jalan tanpa bot check).
6. **Ganti password default kasir/admin yang lemah** — Jery bilang 24 Nov
   sudah mengatur password kasir/admin; pastikan password default yang lemah
   sudah tidak dipakai lagi.
7. **Cek `admin123` di database produksi** (seed lama) — kalau masih ada,
   ganti/nonaktifkan. Juga rotasi `NEXTAUTH_SECRET`, `MOBILE_JWT_SECRET`,
   `NOTIFICATION_CRON_SECRET` dan hapus `GROQ_API_KEYS` dari env Vercel
   (fitur AI sudah dihapus dari kode).

---

## 8. Setelah deploy — yang harus dites ulang

Tes ulang semua 44 item gagal di spreadsheet, minimal yang paling terlihat:
logout dari sesi basi, redirect login, grafik dashboard, pencarian &
pagination penjualan, tombol "Batalkan Penjualan (Tutup Buku)", Total
Piutang & Total Belanja, simpan Edit DO, tombol Nonaktifkan kendaraan,
Generate Laporan Inventory & Katalog, Hapus Logo, Hapus salesman/penerima,
Kirim Email Tes, toggle Akses Halaman (POS untuk ADMIN/KASIR), hero +
katalog beranda + peta, watermark PAID/UNPAID, halaman Kas baru
(`/dashboard/cash`), dan satu penjualan baru pukul 00:xx–07:59 WITA
(nomornya harus berprefiks tanggal hari itu juga, bukan kemarin).

Lalu update spreadsheet "Daftar Fitur TB Masdar Utama — Cek Production"
(ID `1iloAQ4PfuGLIIpwzCNSTW4yTzJBTlzY7rZAZRchhHHU`) sesuai hasil tes ulang.

---

## 9. Isi paket (19 patch + 2 catatan tanpa patch)

```
perbaikan-gabungan-20261125/
├── README-CARA-PASANG.md            ← file ini
├── 01-pos-diskon-rounding/          (patch 1)
├── 02-pos-ui/                       (patch 2)
├── ws-a-auth/                       (patch 3)
├── ws-b-dashboard/                  (patch 4)
├── ws-d-sales/                      (patch 5)
├── ws-e-products/                   (patch 6)
├── ws-f-masterdata/                 (patch 7)
├── ws-g-stock-po/                   (patch 8)
├── ws-h-do/                         (patch 9)
├── ws-l-salesman-notif/             (patch 10)
├── ws-j-reports/                    (patch 11)
├── ws-k-settings/                   (patch 12)
├── ws-n-pageaccess/                 (patch 13)
├── ws-o-landing/                    (patch 14)
├── ws-p-invoice/                    (patch 15)
├── ws-p2-invoicepdf/                (patch 16)
├── ws-q-api-cash/                   (patch 17)
├── ws-j2-nomor-tanggal/             (patch 18)
├── 19-koordinator/                  (patch 19)
├── ws-m-users-investigasi/          (NOTES saja — penyelidikan item 178)
└── apk-fleet-investigasi/           (CATATAN saja — penyelidikan fleet APK)
```

Tiap folder berisi file `.patch` + `NOTES.md` (apa yang diubah, kenapa, apa
yang TIDAK diubah, dan apa yang belum terverifikasi di sini). Baca NOTES
folder yang bersangkutan kalau ada yang kurang jelas sebelum memasang.
