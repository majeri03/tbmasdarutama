-- Migration: 20261123233000_perf_indexes
-- Audit optimasi database 23 Nov 2026 (OPT-A).
-- Menambah index pada kolom foreign key dan kolom yang dipakai di
-- where / orderBy / groupBy. Setiap index di sini punya query yang
-- memakainya (lihat opt-a-NOTES.md). Semua memakai IF NOT EXISTS
-- supaya migrasi aman diulang.
-- Nama index mengikuti konvensi default Prisma
-- ({tabel}_{kolom}_idx) supaya schema.prisma dan database cocok.
-- Catatan: CREATE INDEX biasa (bukan CONCURRENTLY) karena `migrate deploy`
-- jalan di dalam transaksi. Tabel-tabel ini masih kecil, jadi kunci
-- tulisnya hanya sepersekian detik.

-- CustomerDebt: cron utang jatuh tempo + statistik + daftar per pelanggan
CREATE INDEX IF NOT EXISTS "customer_debts_status_dueDate_idx" ON "customer_debts"("status", "dueDate");
CREATE INDEX IF NOT EXISTS "customer_debts_customerId_idx" ON "customer_debts"("customerId");
CREATE INDEX IF NOT EXISTS "customer_debts_createdAt_idx" ON "customer_debts"("createdAt");

-- SupplierDebt: sama seperti CustomerDebt, sisi supplier
CREATE INDEX IF NOT EXISTS "supplier_debts_status_dueDate_idx" ON "supplier_debts"("status", "dueDate");
CREATE INDEX IF NOT EXISTS "supplier_debts_supplierId_idx" ON "supplier_debts"("supplierId");
CREATE INDEX IF NOT EXISTS "supplier_debts_createdAt_idx" ON "supplier_debts"("createdAt");

-- Sale: daftar penjualan + statistik + laporan (filter status & rentang tanggal)
CREATE INDEX IF NOT EXISTS "sales_createdAt_idx" ON "sales"("createdAt");
CREATE INDEX IF NOT EXISTS "sales_status_createdAt_idx" ON "sales"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "sales_cashierId_idx" ON "sales"("cashierId");

-- SaleItem: detail penjualan + hitung per produk
CREATE INDEX IF NOT EXISTS "sale_items_saleId_idx" ON "sale_items"("saleId");
CREATE INDEX IF NOT EXISTS "sale_items_productId_idx" ON "sale_items"("productId");

-- Purchase: daftar pembelian + laporan (filter supplier & tanggal)
CREATE INDEX IF NOT EXISTS "purchases_supplierId_idx" ON "purchases"("supplierId");
CREATE INDEX IF NOT EXISTS "purchases_purchaseDate_idx" ON "purchases"("purchaseDate");

-- PurchaseItem: detail pembelian + hitung per produk
CREATE INDEX IF NOT EXISTS "purchase_items_purchaseId_idx" ON "purchase_items"("purchaseId");
CREATE INDEX IF NOT EXISTS "purchase_items_productId_idx" ON "purchase_items"("productId");

-- DeliveryOrder: daftar DO + penghitung badge (status PENDING)
CREATE INDEX IF NOT EXISTS "delivery_orders_customerId_idx" ON "delivery_orders"("customerId");
CREATE INDEX IF NOT EXISTS "delivery_orders_createdAt_idx" ON "delivery_orders"("createdAt");
CREATE INDEX IF NOT EXISTS "delivery_orders_status_idx" ON "delivery_orders"("status");

-- DeliveryItem: detail DO
CREATE INDEX IF NOT EXISTS "delivery_items_deliveryOrderId_idx" ON "delivery_items"("deliveryOrderId");

-- StockMovement: riwayat stok + statistik + cek referensi DO
CREATE INDEX IF NOT EXISTS "stock_movements_productId_idx" ON "stock_movements"("productId");
CREATE INDEX IF NOT EXISTS "stock_movements_createdAt_idx" ON "stock_movements"("createdAt");
CREATE INDEX IF NOT EXISTS "stock_movements_type_createdAt_idx" ON "stock_movements"("type", "createdAt");
CREATE INDEX IF NOT EXISTS "stock_movements_referenceId_idx" ON "stock_movements"("referenceId");

-- CashMovement: daftar kas + rekap bulanan
CREATE INDEX IF NOT EXISTS "cash_movements_createdAt_idx" ON "cash_movements"("createdAt");

-- Product: daftar produk (urut tanggal dibuat)
CREATE INDEX IF NOT EXISTS "products_createdAt_idx" ON "products"("createdAt");

-- ProductImage: gambar per produk
CREATE INDEX IF NOT EXISTS "product_images_productId_idx" ON "product_images"("productId");

-- Customer: cari pelanggan UMUM di POS
CREATE INDEX IF NOT EXISTS "customers_type_idx" ON "customers"("type");

-- User: kirim notifikasi push per peran + cek akun aktif
CREATE INDEX IF NOT EXISTS "users_role_isActive_idx" ON "users"("role", "isActive");

-- Notification: cegah notifikasi ganda (cek 24 jam terakhir)
CREATE INDEX IF NOT EXISTS "notifications_type_createdAt_idx" ON "notifications"("type", "createdAt");

-- DebtEmailLog: cegah email ganda di hari yang sama (PKG-H)
CREATE INDEX IF NOT EXISTS "debt_email_logs_sentAt_idx" ON "debt_email_logs"("sentAt");

-- RateLimit: sapu data rate limit lama (jalan di setiap request)
CREATE INDEX IF NOT EXISTS "rate_limits_windowStart_idx" ON "rate_limits"("windowStart");

-- FleetVehicle: daftar armada per sopir
CREATE INDEX IF NOT EXISTS "fleet_vehicles_driverUserId_idx" ON "fleet_vehicles"("driverUserId");
CREATE INDEX IF NOT EXISTS "fleet_vehicles_coDriverUserId_idx" ON "fleet_vehicles"("coDriverUserId");

-- DebtPayment: riwayat bayar per utang + statistik + nomor bayar terakhir
CREATE INDEX IF NOT EXISTS "debt_payments_customerDebtId_idx" ON "debt_payments"("customerDebtId");
CREATE INDEX IF NOT EXISTS "debt_payments_supplierDebtId_idx" ON "debt_payments"("supplierDebtId");
CREATE INDEX IF NOT EXISTS "debt_payments_paymentDate_idx" ON "debt_payments"("paymentDate");
CREATE INDEX IF NOT EXISTS "debt_payments_createdAt_idx" ON "debt_payments"("createdAt");
