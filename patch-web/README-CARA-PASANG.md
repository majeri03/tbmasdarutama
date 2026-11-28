# API Khusus Bot Madama Agent + Bot v2.5 — Cara Pasang

Paket: API bot lengkap di bawah `/api/bot/*` (web) + bot v2.5 (LID otomatis Level 1/2 + header level).
Tanggal: 28 Nov 2026. Basis web: backend commit `c6065c6`. Basis bot: v2.4 commit `123858f`.

> **Paket ini LENGKAP.** WS-D (tulis transaksi: penjualan, bayar
> piutang/utang, delivery order) selesai dibangun 28 Nov 2026 setelah
> Jery mengonfirmasi eksplisit ("Ya, lanjutkan WS-D", 20:40 WITA).
> Bot sekarang bisa baca semua data + ubah master/stok + buat
> transaksi/penjualan, bayar utang, dan buat delivery order lewat API.
> Route lama `/api/*` TIDAK DIUBAH sama sekali.

## 1. Isi paket

| File | Isi |
|---|---|
| `patch-web.zip` | 5 patch web + README ini (di dalamnya) |
| `patch-web/ws-a-auth-audit-ratelimit.patch` | Fondasi: `src/lib/bot-auth.ts`, model `BotAuditLog` + migrasi, `WA_BOT_API_KEY` min 32 |
| `patch-web/ws-b-get.patch` | 7 route GET (stok, piutang, utang supplier, invoice, ringkasan harian) |
| `patch-web/ws-c-tulis-master-stok.patch` | 8 file tulis master data + stok (produk, satuan, pelanggan, poin, penyesuaian stok) |
| `patch-web/tsc-fix-3-error.patch` | Perbaikan 3 error `tsc` di WS-C (2 file, +5/−2, tanpa perubahan perilaku — lihat §2a) |
| `patch-web/ws-d-tulis-transaksi.patch` | 6 file tulis transaksi (penjualan, bayar piutang/utang, delivery order) |
| `madama-bot-v25-20261128.zip` | Bot v2.5: hanya `madama-realtime.js` (tidak ada `roles.json`/`.env`/kunci di dalamnya) |
| `ws-a-auth-audit-ratelimit/`, `ws-b-get/`, `ws-c-tulis-master-stok/`, `ws-d-tulis-transaksi/`, `ws-e-bot-v25/` | Patch + NOTES.md tiap workstream (detail + contoh curl per endpoint) |

## 2. Urutan pasang — WEB dulu, bot belakangan

### 2a. Pasang patch web (di laptop, folder repo `tbmasdarutama`)

Urutan WAJIB: **WS-A → WS-B → WS-C → tsc-fix-3-error → WS-D**. WS-B, WS-C, dan WS-D mengimpor `src/lib/bot-auth.ts`
yang dibuat WS-A — kalau WS-A belum dipasang, build gagal (modul tidak ditemukan).

```powershell
cd D:\laragon\www\proyekmasdarutama\tbmasdarutama
git apply ws-a-auth-audit-ratelimit.patch
git apply ws-b-get.patch
git apply ws-c-tulis-master-stok.patch
git apply tsc-fix-3-error.patch
git apply ws-d-tulis-transaksi.patch
```

(Download dulu kelima file `.patch` ke dalam folder repo sebelum `git apply` — jangan
ketik isi patch di chat.)

> **Catatan `tsc-fix-3-error`:** setelah WS-A/B/C terpasang, `npx tsc --noEmit`
> menampilkan 3 error di 2 file WS-C — `customers/[id]/route.ts:120` TS2531
> (`toNum()` mengembalikan `number | null`) dan `products/[id]/units/[unitId]/
> route.ts:174` TS18047 ×2 (`effSell`/`effBuy` possibly null). Patch ini
> memperbaikinya (`?? 0` dan guard `!== null`, 2 file, +5/−2) **tanpa
> perubahan perilaku** — validasi `sellPrice >= buyPrice` tetap jalan.
> Kalau kamu sudah memasang WS-A/B/C saja (belum WS-D), cukup `git apply
> tsc-fix-3-error.patch` lalu `npx tsc --noEmit` (harusnya 0 error),
> baru lanjut WS-D.

Lalu migrasi + cek + deploy (WS-A membawa migrasi baru — JANGAN lewatkan langkah ini):

```powershell
npx prisma migrate deploy
npx prisma generate
npx tsc --noEmit
npm run build
git add -A
git commit -m "api bot madama: auth kunci + GET + tulis master/stok + tulis transaksi 28 nov 2026"
git push
```

Tunggu deploy Vercel sampai **Success**. Kalau `tsc`/`build` menampilkan error, kirim
baris error paling bawah ke Jett — jangan lanjut deploy.

### 2b. Isi kunci `WA_BOT_API_KEY` di Vercel — SEBELUM tes

Kunci harus acak, minimal 32 karakter. Buat di PowerShell:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Hasilnya 64 karakter hex. Pasang di Vercel: Project `tbmasdarutama` → Settings →
Environment Variables → tambah `WA_BOT_API_KEY` = hasil di atas (Production) →
**Redeploy** (env baru hanya berlaku setelah deploy ulang).

Perhatian: kalau kunci di Vercel kurang dari 32 karakter, boot production GAGAL
sengaja (fail-closed). Kalau kunci belum diisi sama sekali, semua `/api/bot/*`
menjawab 401.

### 2c. Pasang bot v2.5 di VM (setelah web deploy + kunci terisi)

Di VM (Debian, folder `~/madama-agent`):

```sh
curl -L -o madama-bot-v25.zip "<URL_ZIP>"
unzip -o madama-bot-v25.zip
node --check madama-realtime.js
pm2 restart madama
```

(URL zip diisi saat file dikirim. File `roles.json` dan `config.json` di VM TIDAK
tertimpa oleh zip.)

Lalu DUA langkah wajib di VM:

1. **Isi kunci yang SAMA di `.env` bot** (satu baris, tanpa spasi, tanpa tanda kutip):
   `WA_BOT_API_KEY=<KUNCI_SAMA_DENGAN_VERCEL>` — nilai kunci JANGAN pernah dikirim
   lewat chat/grup. Isi langsung di VM. `TB_API_KEY` lama boleh tetap ada selama masa
   transisi (v2.5 memakainya sebagai fallback satu rilis + log peringatan); setelah
   `WA_BOT_API_KEY` terisi dan teruji, `TB_API_KEY` boleh dihapus.
2. **Perbarui `config.json` di VM**: `config.json` Jery masih berisi allowlist lama
   (`/api/products` dkk) dan itu MENIMPA default baru di kode. Ubah
   `web.allowlistGet` menjadi `["/api/bot/products", "/api/bot/stock",
   "/api/bot/customers"]` (atau hapus kunci `web.allowlistGet` dari `config.json`
   supaya default kode dipakai). `web.enabled` tetap `false` (MATI) sampai Jery
   mengaktifkan sendiri. Setelah ubah `.env`/`config.json`, `pm2 restart madama`
   sekali lagi.

## 3. Cara kerja auth (ringkas)

- Bot kirim header `X-Bot-Key: <WA_BOT_API_KEY>` + `X-Bot-Level: 1/2/3` +
  `X-Bot-Sender: <nomor HP / LID pengirim>` di setiap panggilan `/api/bot/*`.
- Web cek kunci dengan `crypto.timingSafeEqual` di atas hash SHA-256 kedua sisi
  (helper baru `src/lib/bot-auth.ts`). Kunci belum diisi di Vercel ATAU header
  salah/kosong → **401** dengan satu pesan generik (tidak dibocorkan alasannya).
  Hanya HTTPS di production (`x-forwarded-proto` — Vercel selalu mengirimnya).
- Rate limit **60 request/menit per kunci** (pakai ulang model `RateLimit` yang
  sudah ada; kunci rate-limit = `'bot:' + sha256(kunci)`, kunci mentah TIDAK
  PERNAH disimpan). Lebih dari itu → **429**. Rate limit hanya dihitung SETELAH
  kunci lolos (request 401 tidak dihitung).
- Level dipercaya dari header HANYA karena request sudah diautentikasi kunci bot
  (bot menegakkan level dulu — defense in depth). Nomor HP Level 1/2 TIDAK
  di-hardcode di kode web (roles milik bot). **Jujur: kalau kunci bocor, pemegang
  kunci bisa mengaku Level 1** — mitigasinya rotasi kunci, audit log tiap tulis,
  dan rate limit (lihat §7).
- Semua respons: `{success:true, data:...}` (+ `pagination` untuk list) atau
  `{success:false, error:"..."}`. List: `page` + `limit` (default 20, maks 50).
- TIDAK PERNAH dikembalikan di respons mana pun: `buyPrice`, password, token,
  secret, fee salesman di invoice. Error Prisma/SQL/stack trace TIDAK PERNAH keluar
  (diganti pesan generik).
- Setiap tulis dicatat di tabel baru `bot_audit_logs` (model `BotAuditLog` +
  migrasi `20261128203000_bot_audit_log`): waktu, level, sender, method, endpoint,
  ID yang diubah, sebelum/sesudah ringkas — TANPA kunci. Gagal mencatat audit
  tidak menggagalkan tulis.

## 4. Level — siapa boleh apa

| Aksi | Level 1 (pemilik) | Level 2 | Level 3 |
|---|---|---|---|
| Baca (semua GET) | ✅ | ✅ | ✅ |
| Buat/ubah/hapus produk + satuan (termasuk ubah harga) | ✅ | ❌ 403 | ❌ 403 |
| Buat/ubah/hapus pelanggan + sesuaikan poin | ✅ | ❌ 403 | ❌ 403 |
| Penyesuaian stok | ✅ | ❌ 403 | ❌ 403 |
| Buat penjualan, bayar piutang/utang, buat delivery order | ✅ | ✅ | ❌ 403 |
| Ubah penjualan / delivery, batalkan penjualan / delivery | ✅ | ❌ 403 | ❌ 403 |

Level 3 yang mencoba tulis ditolak sopan 403: "Maaf, akun ini hanya bisa
melihat, tidak bisa mengubah data."

## 5. Daftar endpoint baru (34 endpoint)

### GET — semua level (WS-B + WS-C + WS-D)

| Metode + path | Keterangan |
|---|---|
| GET `/api/bot/stock?search=&low=true&page=&limit=` | List produk + stok (unit utama + sellPrice; tanpa buyPrice) |
| GET `/api/bot/products?search=&page=&limit=` | List produk + units (sellPrice saja) |
| GET `/api/bot/products/[id]` | Detail produk + semua units (tanpa buyPrice) |
| GET `/api/bot/customers?search=&type=&page=&limit=` | List pelanggan (+ poin, totalBelanja) |
| GET `/api/bot/customers/[id]` | Detail pelanggan + ringkasan utang + total belanja |
| GET `/api/bot/debts/customers?search=&status=&page=&limit=` | List piutang (status UNPAID/PARTIAL/PAID/OVERDUE) |
| GET `/api/bot/debts/customers/[id]` | Detail piutang + payments[] (paymentDate, paymentMethod) |
| GET `/api/bot/debts/suppliers?search=&status=&page=&limit=` | List utang supplier |
| GET `/api/bot/debts/suppliers/[id]` | Detail utang supplier + payments[] |
| GET `/api/bot/invoices/[id]` | Data invoice satu Sale (id = id Sale; tanpa fee salesman, tanpa buyPrice) |
| GET `/api/bot/sales?search=&status=&paymentMethod=&customerId=&dateFrom=&dateTo=&page=&limit=` | List penjualan + items + utang + Surat Jalan per baris |
| GET `/api/bot/sales/[id]` | Detail penjualan + items + pelanggan + utang + Surat Jalan |
| GET `/api/bot/delivery-orders?search=&status=&customerId=&page=&limit=` | List delivery order |
| GET `/api/bot/delivery-orders/[id]` | Detail delivery + items + sale + foto bukti |
| GET `/api/bot/summary/daily` | Ringkasan hari ini (WITA): penjualan, piutang baru, utang belum lunas, stok menipis |

"Hari ini" = hari kalender WITA (00:00–23:59:59 Asia/Makassar), pola sama seperti
kode laporan yang ada. Penjualan hari ini hanya status COMPLETED.

### Tulis — Level 1 saja (WS-C)

| Metode + path | Keterangan |
|---|---|
| POST `/api/bot/products` | Buat produk + satuan utama (kode server `PRD-xxxxx`; `categoryId` + `unitId` + `sellPrice` + `buyPrice` wajib; buyPrice diterima tapi tidak dikembalikan) |
| PUT `/api/bot/products/[id]` | Ubah nama/minStock/isActive (harga TIDAK di sini) |
| DELETE `/api/bot/products/[id]` | Soft-delete (`isActive=false`) |
| POST `/api/bot/products/[id]/units` | Tambah satuan (P2002 → pesan sopan bila satuan sudah ada) |
| PUT `/api/bot/products/[id]/units/[unitId]` | Ubah sellPrice/buyPrice/conversionValue/isPrimary |
| DELETE `/api/bot/products/[id]/units/[unitId]` | Hapus satuan (ditolak bila primary / pernah dipakai di SaleItem) |
| POST `/api/bot/customers` | Buat pelanggan (kode server `CUST-xxxxx`; type UMUM selalu ditolak) |
| PUT `/api/bot/customers/[id]` | Ubah pelanggan (type tidak boleh jadi UMUM) |
| DELETE `/api/bot/customers/[id]` | Soft-delete (ditolak bila sisa utang > 0 / bila UMUM) |
| POST `/api/bot/customers/[id]/points` | Sesuaikan poin (`delta` ≠ 0, `reason` wajib, hasil ≥ 0, UMUM ditolak) |
| POST `/api/bot/stock/adjust` | Penyesuaian stok (`quantity` = delta, `reason` wajib; stok akhir negatif HANYA bila ada reason — tercatat di StockMovement.notes + audit) |

Aturan harga mengikuti skema web: `sellPrice >= buyPrice`, satuan utama
`conversionValue` = 1, tepat 1 primary. Stok awal produk baru dicatat sebagai
StockMovement (IN bila > 0, ADJUSTMENT 0 bila 0), pola web.

### Tulis — transaksi (WS-D)

| Metode + path | Level | Keterangan |
|---|---|---|
| POST `/api/bot/sales` | 1, 2 | Buat penjualan lengkap (total dihitung server dari `sellPrice` master; `DP` = alias CREDIT; nomor `INV-YYYYMMDD-XXXX` dibuat server; CREDIT sisa > 0 → `CustomerDebt` +30 hari; poin hanya lunas non-CREDIT non-UMUM) |
| PUT `/api/bot/sales/[id]` | 1 saja | Ubah penjualan — cermin `updateSale` web (items baru penuh; cicilan dipertahankan; utang ikut metode bayar; DO ikut diperbarui) |
| DELETE `/api/bot/sales/[id]` | 1 saja | BATALKAN (Tutup Buku), bukan hard-delete — status `CANCELLED`, stok kembali, utang belum bercicilan dihapus, kas dibalik; DITOLAK bila sudah lunas |
| POST `/api/bot/debts/customers/[id]/pay` | 1, 2 | Bayar piutang (amount > 0, tidak melebihi sisa; nomor `PAY-######`; `Sale.paidAmount` naik, `Sale` jadi `COMPLETED` bila lunas; tanpa `CashMovement`, sama seperti web) |
| POST `/api/bot/debts/suppliers/[id]/pay` | 1, 2 | Bayar utang supplier (nomor `PAY-YYYYMMDD-NNN`; `Purchase.paidAmount` naik, status `Purchase` tidak diubah) |
| POST `/api/bot/delivery-orders` | 1, 2 | Buat delivery (saleId wajib; validasi pasangan sopir–plat; nomor `DO/YYYYMM/NNNN` dibuat server; status awal `PENDING`; stok TIDAK dipotong saat buat) |
| PUT `/api/bot/delivery-orders/[id]` | 1 saja | Ubah metadata + ubah status (state machine web; `DELIVERED` memotong stok bila sale belum memotong; `CANCELLED` via PUT = pola batalkan) |
| DELETE `/api/bot/delivery-orders/[id]` | 1 saja | BATALKAN (CANCELLED), bukan hard-delete; DITOLAK bila sudah DELIVERED |

Detail lengkap + contoh curl per endpoint ada di
`ws-d-tulis-transaksi/NOTES.md`.

## 6. Tes dengan curl (SETELAH deploy + kunci terisi)

Ganti `$WA_BOT_API_KEY` dengan nilai dari env (JANGAN tulis nilai asli di chat/log).
Contoh lengkap per endpoint ada di NOTES.md tiap workstream.

```bash
# 1. Tanpa kunci -> 401
curl -i https://tbmasdarutama.vercel.app/api/bot/stock

# 2. Kunci salah -> 401 (pesan SAMA persis dengan tanpa kunci)
curl -i https://tbmasdarutama.vercel.app/api/bot/stock -H "X-Bot-Key: <KUNCI_SALAH>"

# 3. Kunci benar -> 200
curl -i https://tbmasdarutama.vercel.app/api/bot/stock \
  -H "X-Bot-Key: $WA_BOT_API_KEY" -H "X-Bot-Level: 3" -H "X-Bot-Sender: 6281234567890"

# 4. GET contoh
curl -H "X-Bot-Key: $WA_BOT_API_KEY" "https://tbmasdarutama.vercel.app/api/bot/stock?search=semen&limit=20"
curl -H "X-Bot-Key: $WA_BOT_API_KEY" "https://tbmasdarutama.vercel.app/api/bot/debts/customers?status=UNPAID"
curl -H "X-Bot-Key: $WA_BOT_API_KEY" "https://tbmasdarutama.vercel.app/api/bot/summary/daily"

# 5. Tulis Level 3 -> 403 sopan (pakai endpoint WS-C)
curl -i -X POST https://tbmasdarutama.vercel.app/api/bot/products \
  -H "X-Bot-Key: $WA_BOT_API_KEY" -H "X-Bot-Level: 3" -H "X-Bot-Sender: 6281234567890" \
  -H "Content-Type: application/json" -d '{}'

# 6. Tulis Level 1 -> 200/400 (contoh buat pelanggan)
curl -X POST https://tbmasdarutama.vercel.app/api/bot/customers \
  -H "X-Bot-Key: $WA_BOT_API_KEY" -H "X-Bot-Level: 1" -H "X-Bot-Sender: 6289527675959" \
  -H "Content-Type: application/json" \
  -d '{"name":"Budi Santoso","phone":"081234567890","type":"REGULER"}'

# 7. Rate limit: ulangi request benar > 60x dalam 1 menit -> 429
for i in $(seq 1 65); do curl -s -o /dev/null -w "%{http_code}\n" \
  https://tbmasdarutama.vercel.app/api/bot/stock -H "X-Bot-Key: $WA_BOT_API_KEY"; done

# 8. WS-D — buat penjualan (Level 2 boleh; harga dihitung server)
curl -X POST https://tbmasdarutama.vercel.app/api/bot/sales \
  -H "X-Bot-Key: $WA_BOT_API_KEY" -H "X-Bot-Level: 2" -H "X-Bot-Sender: 6281524273550" \
  -H "Content-Type: application/json" \
  -d '{"customerId": "<ID_CUSTOMER>", "items": [{"productId": "<ID_PRODUK>", "productUnitId": "<ID_SATUAN>", "quantity": 2}], "paymentMethod": "CASH"}'

# 9. WS-D — POST penjualan Level 3 -> 403 sopan
curl -i -X POST https://tbmasdarutama.vercel.app/api/bot/sales \
  -H "X-Bot-Key: $WA_BOT_API_KEY" -H "X-Bot-Level: 3" -H "X-Bot-Sender: 6281234567890" \
  -H "Content-Type: application/json" -d '{}'

# 10. WS-D — DELETE penjualan lunas -> 400 sopan (Level 1)
curl -i -X DELETE https://tbmasdarutama.vercel.app/api/bot/sales/<ID_PENJUALAN_LUNAS> \
  -H "X-Bot-Key: $WA_BOT_API_KEY" -H "X-Bot-Level: 1" -H "X-Bot-Sender: 6289527675959"

# 11. WS-D — bayar piutang (Level 2 boleh)
curl -X POST https://tbmasdarutama.vercel.app/api/bot/debts/customers/<ID_UTANG>/pay \
  -H "X-Bot-Key: $WA_BOT_API_KEY" -H "X-Bot-Level: 2" -H "X-Bot-Sender: 6281524273550" \
  -H "Content-Type: application/json" -d '{"amount": 500000, "paymentMethod": "CASH"}'

# 12. WS-D — bayar melebihi sisa utang -> 400 sopan
curl -X POST https://tbmasdarutama.vercel.app/api/bot/debts/customers/<ID_UTANG>/pay \
  -H "X-Bot-Key: $WA_BOT_API_KEY" -H "X-Bot-Level: 2" -H "X-Bot-Sender: 6281524273550" \
  -H "Content-Type: application/json" -d '{"amount": 999999999, "paymentMethod": "CASH"}'

# 13. WS-D — buat delivery order (Level 2 boleh)
curl -X POST https://tbmasdarutama.vercel.app/api/bot/delivery-orders \
  -H "X-Bot-Key: $WA_BOT_API_KEY" -H "X-Bot-Level: 2" -H "X-Bot-Sender: 6281524273550" \
  -H "Content-Type: application/json" \
  -d '{"saleId": "<ID_SALE>", "deliveryDate": "2026-11-29", "driver": "Budi", "vehicle": "DD 1234 AB", "items": [{"productId": "<ID_PRODUK>", "unitId": "<ID_SATUAN>", "quantity": 10}]}'

# 14. WS-D — DELETE delivery yang sudah DELIVERED -> 400 sopan (Level 1)
curl -i -X DELETE https://tbmasdarutama.vercel.app/api/bot/delivery-orders/<ID_DO_TERKIRIM> \
  -H "X-Bot-Key: $WA_BOT_API_KEY" -H "X-Bot-Level: 1" -H "X-Bot-Sender: 6289527675959"
```

## 7. Model ancaman — dibaca jujur

- **Kunci bocor → pemegang kunci bisa mengaku Level 1.** Web percaya header
  level dari bot karena request diautentikasi kunci. Mitigasi: rotasi kunci
  (ganti di Vercel + VM bot, tanpa ganggu akun user), audit log tiap tulis
  (penyalahgunaan ketahuan dan bisa ditelusuri siapa/kapan/apa), rate limit
  60/menit. Belum ada: daftar nomor Level 1/2 di sisi web, atau kunci terpisah
  per level (bisa ditambah nanti bila Jery mau).
- **Kunci tidak pernah ditulis ke log/audit/respons** — tapi Jery harus memastikan
  kunci tidak pernah ditempel di chat/WhatsApp, hanya di env Vercel + `.env` VM.
- **Rate limit per kunci, bukan per pengirim** — satu pengirim yang membanjiri
  request bisa menghabiskan kuota untuk semua level.
- **Audit log bukan bukti anti-rusak** — admin DB bisa mengubah/menghapus barisnya.
  Untuk kebutuhan toko ini, audit sebagai jejak operasional sudah cukup.
- **DB mati → rate limit gagal TERBUKA** (mengikuti konvensi `rate-limit.ts` yang
  ada) — rate limit tidak boleh memblokir bot saat DB bermasalah; route-nya tetap
  gagal di query berikutnya kalau DB memang mati.
- **Race kecil pada hitungan rate limit** — dua request yang tiba persis bersamaan
  bisa sama-sama lolos (paling banyak 1 ekstra); tidak ada request sah yang
  terblokir karenanya.

## 8. WS-D — selesai (riwayat singkat)

WS-D sempat terhenti saat dibangun pertama kali karena pemeriksaan
keamanan sistem pada clone repo, dan tidak boleh dilanjutkan diam-diam.
Jery mengonfirmasi eksplisit pada 28 Nov 2026 20:40 WITA ("Ya,
lanjutkan WS-D") bahwa repo `tbmasdarutama` boleh diproses untuk
membangun patch WS-D. Patch dibangun dengan pola yang sama seperti
WS-A/B/C: POST/PUT/DELETE penjualan (meniru aturan POS: hitung total di
server, konversi satuan utama, utang CREDIT, poin), POST bayar
piutang/utang, POST/PUT/DELETE delivery order — dengan `Sale.cashierId`
dan `DeliveryOrder.createdById` diisi dari `getBotActorUserId()`, dan
logika batalkan penjualan meniru `sale.actions.ts` (Tutup Buku) persis
karena `DebtStatus` tidak punya CANCELLED. Satu perbaikan koordinator:
celah guard lunas DELETE penjualan ditutup — CREDIT yang dibayar lunas
saat checkout (tanpa baris utang) ikut ditolak, jadi "DELETE penjualan
lunas harus ditolak" berlaku untuk semua metode bayar (lihat
`ws-d-tulis-transaksi/NOTES.md`).

## 9. Yang belum terverifikasi (jujur — laptop + deploy Jery yang memutuskan)

- `npx tsc --noEmit`, `npm run build`, `npx prisma generate`, dan curl live
  TIDAK BISA jalan di lingkungan kerja Jett (tidak ada `node_modules`, install
  gagal karena jaringan). Yang sudah diverifikasi Jett sendiri: urutan lengkap
  WS-A → WS-B → WS-C → tsc-fix-3-error → WS-D apply bersih berurutan pada fresh clone `c6065c6`
  (25 file, +7251/−1); semua nama helper yang diimpor WS-B/C/D ADA di `src/lib/bot-auth.ts`
  (12 nama wajib + tambahan); semua field Prisma yang dipakai ADA di schema
  (dicek field-per-field, termasuk `Product.deletedAt`, `Sale.saleDate/tax/
  paidAmount/changeAmount`, `DebtPayment.paymentDate/paymentMethod`);
  `buyPrice` hanya muncul di body tulis + audit internal, TIDAK PERNAH di
  serializer respons; `salesmanFee` hanya di komentar; `getAuthenticatedUser`
  = 0 di semua route bot; migrasi SQL cocok persis dengan model `BotAuditLog`;
  patch bot v2.5 apply bersih + `node --check` lolos + file hasil apply identik
  dengan deliverable; uji logika WS-E 16 cek, 0 gagal; tidak ada kunci di
  patch/zip/NOTES mana pun (dicek dengan grep); WS-D: tidak ada raw SQL,
  guard lunas DELETE penjualan ada dan berlaku untuk semua metode bayar,
  PUT/DELETE delivery Level 1 saja. `tsc` sendiri tetap harus lolos di laptop
  Jery setelah semua patch terpasang (patch `tsc-fix-3-error` memperbaiki 3
  error yang ditemukan Jery di WS-C).
- `webGet` di bot v2.5 sudah mengirim header baru, TAPI belum dipanggil oleh
  `answer()` (web default OFF) — wiring pemanggilan `webGet(pathname, level,
  sender)` menjadi tugas berikutnya setelah endpoint deploy dan `web.enabled`
  diaktifkan.
- Tes live bot v2.5 di VM + grup Madama Test belum dilakukan: kirim pesan dari
  nomor Level 1 yang LID-nya belum ada di `roles.json`, cek log
  `[LEVEL] LID ... otomatis ditambah ke Level 1` dan isi `roles.json` di VM.

## 10. Keputusan yang masih butuh jawaban Jery

1. **Konfirmasi WS-D** — ✅ SELESAI 28 Nov 2026 20:40 WITA (Jery: "Ya,
   lanjutkan WS-D"). Patch WS-D sudah dibangun, terverifikasi, dan ada di
   paket ini.
2. **Stok minus dengan alasan saat ini diizinkan** (sesuai "stok tidak boleh minus
   tanpa alasan"). Kalau mau ditolak MUTLAK (alasan apa pun), satu baris di
   `stock/adjust/route.ts` yang diubah.
3. **`sellPrice < buyPrice` saat ini ditolak** (mengikuti skema web). Kalau ada
   kasus promo/jual rugi lewat bot, aturan ini perlu dilonggarkan khusus bot.
4. **Bot tidak pernah boleh membuat/mengubah-menjadi/menghapus UMUM.** Kalau Jery
   ingin bot bisa memperbaiki data Umum (mis. telepon), perlu dibuka khusus.
   (PUT pada customer Umum untuk field selain `type` saat ini tetap diizinkan.)
5. **`getBotActorUserId` memakai SUPER_ADMIN pertama tanpa filter `isActive`.**
   Boleh tetap begitu, atau hanya SUPER_ADMIN yang aktif?
6. **`BOT_API_KEY` (kunci lama) punya masalah yang sama seperti `WA_BOT_API_KEY`
   dulu** — ada di skema env tapi tidak pernah divalidasi. Perlu ikut diperbaiki?
7. **Penyesuaian stok = Level 1 saja** (keputusan koordinator — mengikuti web
   yang opname-nya ADMIN saja). Kalau Level 2 juga boleh, beri tahu.
8. **LID Level 3 sengaja TIDAK ditambahkan otomatis** (Level 3 tetap hanya-baca;
   siapa pun di grup memang sudah boleh bertanya). Sudah sesuai?

## 11. File baru/diubah (web)

Baru: `src/lib/bot-auth.ts`; `prisma/migrations/20261128203000_bot_audit_log/
migration.sql`; 21 file route di `src/app/api/bot/` (7 WS-B + 8 WS-C + 6 WS-D).
Diubah: `prisma/schema.prisma` (model `BotAuditLog`); `src/lib/env.ts`
(`WA_BOT_API_KEY` min 32 + masuk input `safeParse` — sebelumnya validasinya
mati/tidak pernah jalan); `tsc-fix-3-error` mengubah 2 file WS-C
(`customers/[id]/route.ts`, `products/[id]/units/[unitId]/route.ts`) tanpa
perubahan perilaku. Route lama: TIDAK ADA yang diubah.
