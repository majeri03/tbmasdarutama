-- ==================== INSERT USERS ====================
-- Password: admin123 (hashed dengan bcrypt)
INSERT INTO users (id, name, email, password, role, phone, address, "isActive", "createdAt", "updatedAt")
VALUES 
('cm5admin001', 'Super Admin', 'admin@tbmasdarutama.com', '$2b$10$2Jj4WejCXAbJGBlCI65d2erXic.fEONZA8F8S4pugGD00FY/rqe4K', 'SUPER_ADMIN', '081234567890', 'Jl. Raya Bangunan No. 123', true, NOW(), NOW()),
('cm5kasir001', 'Kasir 1', 'kasir@tbmasdarutama.com', '$2b$10$2Jj4WejCXAbJGBlCI65d2erXic.fEONZA8F8S4pugGD00FY/rqe4K', 'KASIR', '081234567891', NULL, true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- ==================== INSERT UNITS (SATUAN) ====================
INSERT INTO units (id, name, description, "createdAt", "updatedAt")
VALUES 
('unit001', 'Pcs', 'Pieces / Per buah', NOW(), NOW()),
('unit002', 'Sak', 'Sak / Karung', NOW(), NOW()),
('unit003', 'Kg', 'Kilogram', NOW(), NOW()),
('unit004', 'Dus', 'Dus / Kotak', NOW(), NOW()),
('unit005', 'Box', 'Box', NOW(), NOW()),
('unit006', 'Lusin', '1 Lusin = 12 Pcs', NOW(), NOW()),
('unit007', 'Meter', 'Meter (untuk panjang)', NOW(), NOW()),
('unit008', 'Roll', 'Roll / Gulungan', NOW(), NOW()),
('unit009', 'Lembar', 'Per lembar', NOW(), NOW()),
('unit010', 'Batang', 'Per batang', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- ==================== INSERT CATEGORIES ====================
INSERT INTO categories (id, name, description, "createdAt", "updatedAt")
VALUES 
('cat001', 'Semen', 'Semen berbagai merk', NOW(), NOW()),
('cat002', 'Besi & Baja', 'Besi beton, hollow, dll', NOW(), NOW()),
('cat003', 'Cat & Finishing', 'Cat tembok, cat kayu, dll', NOW(), NOW()),
('cat004', 'Pasir & Batu', 'Pasir, batu split, dll', NOW(), NOW()),
('cat005', 'Paku & Baut', 'Berbagai jenis paku dan baut', NOW(), NOW()),
('cat006', 'Kayu', 'Kayu berbagai ukuran', NOW(), NOW()),
('cat007', 'Keramik & Granit', 'Keramik lantai dan dinding', NOW(), NOW()),
('cat008', 'Pipa & Fitting', 'Pipa PVC, fitting, dll', NOW(), NOW()),
('cat009', 'Listrik', 'Kabel, saklar, stop kontak', NOW(), NOW()),
('cat010', 'Tools', 'Peralatan konstruksi', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- ==================== INSERT SUPPLIERS ====================
INSERT INTO suppliers (id, code, name, phone, email, address, city, province, description, "isActive", "createdAt", "updatedAt")
VALUES 
('sup001', 'SUP-001', 'PT Semen Indonesia', '0211234567', 'sales@semengresik.com', 'Jl. Semen Raya No. 1', 'Jakarta', 'DKI Jakarta', NULL, true, NOW(), NOW()),
('sup002', 'SUP-002', 'PT Sumber Besi Jaya', '0217654321', 'info@besijaya.com', 'Jl. Industri No. 45', 'Bekasi', 'Jawa Barat', NULL, true, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- ==================== INSERT CUSTOMERS ====================
INSERT INTO customers (id, code, name, phone, email, address, city, province, type, "isActive", "createdAt", "updatedAt")
VALUES 
('cust001', 'CUST-001', 'Toko Maju Jaya', '081234567890', 'tokojaya@gmail.com', 'Jl. Raya Pembangunan No. 45', 'Bandung', 'Jawa Barat', 'GROSIR', true, NOW(), NOW()),
('cust002', 'CUST-002', 'CV Bangun Sejahtera', '081234567891', 'bangun@gmail.com', 'Jl. Raya Sukamaju No. 12', 'Jakarta', 'DKI Jakarta', 'PROYEK', true, NOW(), NOW()),
('cust003', 'CUST-003', 'Toko Berkah', '081234567892', NULL, 'Jl. Pasar No. 5', 'Bandung', 'Jawa Barat', 'REGULER', true, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- ==================== INSERT SAMPLE PRODUCTS ====================
INSERT INTO products (id, code, barcode, name, description, "categoryId", "subCategoryId", "supplierId", "minStock", "currentStock", "isActive", "createdAt", "updatedAt")
VALUES 
('prod001', 'PRD-001', '8992761001011', 'Semen Gresik 50kg', 'Semen Portland Type 1', 'cat001', NULL, 'sup001', 20, 100, true, NOW(), NOW()),
('prod002', 'PRD-002', '8992761001012', 'Semen Tiga Roda 40kg', 'Semen Portland Abu-abu', 'cat001', NULL, 'sup001', 20, 80, true, NOW(), NOW()),
('prod003', 'PRD-003', '8888888888888', 'Besi Beton 10mm', 'Besi beton polos ukuran 10mm', 'cat002', NULL, 'sup002', 50, 200, true, NOW(), NOW()),
('prod004', 'PRD-004', '8888888888889', 'Besi Beton 12mm', 'Besi beton polos ukuran 12mm', 'cat002', NULL, 'sup002', 50, 150, true, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- ==================== INSERT PRODUCT UNITS & PRICES ====================
-- Semen Gresik 50kg
INSERT INTO product_units (id, "productId", "unitId", "conversionValue", "buyPrice", "sellPrice", "isPrimary", "createdAt", "updatedAt")
VALUES 
('pu001', 'prod001', 'unit002', 1, 60000, 65000, true, NOW(), NOW()),  -- Per Sak
('pu002', 'prod001', 'unit003', 50, 1200, 1300, false, NOW(), NOW())   -- Per Kg (1 Sak = 50 Kg)
ON CONFLICT ("productId", "unitId") DO NOTHING;

-- Semen Tiga Roda 40kg
INSERT INTO product_units (id, "productId", "unitId", "conversionValue", "buyPrice", "sellPrice", "isPrimary", "createdAt", "updatedAt")
VALUES 
('pu003', 'prod002', 'unit002', 1, 55000, 60000, true, NOW(), NOW()),  -- Per Sak
('pu004', 'prod002', 'unit003', 40, 1375, 1500, false, NOW(), NOW())   -- Per Kg
ON CONFLICT ("productId", "unitId") DO NOTHING;

-- Besi Beton 10mm
INSERT INTO product_units (id, "productId", "unitId", "conversionValue", "buyPrice", "sellPrice", "isPrimary", "createdAt", "updatedAt")
VALUES 
('pu005', 'prod003', 'unit010', 1, 85000, 95000, true, NOW(), NOW()),  -- Per Batang
('pu006', 'prod003', 'unit003', 12, 7083, 7916, false, NOW(), NOW())   -- Per Kg (1 Batang = 12 Kg)
ON CONFLICT ("productId", "unitId") DO NOTHING;

-- Besi Beton 12mm
INSERT INTO product_units (id, "productId", "unitId", "conversionValue", "buyPrice", "sellPrice", "isPrimary", "createdAt", "updatedAt")
VALUES 
('pu007', 'prod004', 'unit010', 1, 110000, 125000, true, NOW(), NOW()), -- Per Batang
('pu008', 'prod004', 'unit003', 14, 7857, 8928, false, NOW(), NOW())    -- Per Kg (1 Batang = 14 Kg)
ON CONFLICT ("productId", "unitId") DO NOTHING;