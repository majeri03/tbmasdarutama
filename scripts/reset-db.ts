import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as readline from 'readline';

const prisma = new PrismaClient();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('=============================================');
  console.log('  WARNING: DATABASE RESET SCRIPT (DANGER)  ');
  console.log('=============================================');
  
  const email = await question('Masukkan Email SUPER_ADMIN: ');
  const password = await question('Masukkan Password: ');
  
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user || user.role !== 'SUPER_ADMIN') {
    console.error('❌ Akses ditolak! Email tidak ditemukan atau bukan SUPER_ADMIN.');
    rl.close();
    process.exit(1);
  }
  
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    console.error('❌ Akses ditolak! Password salah.');
    rl.close();
    process.exit(1);
  }
  
  const confirm = await question('Apakah Anda YAKIN ingin mereset seluruh data transaksi, produk, utang, dll? (Ketik "YAKIN" untuk lanjut): ');
  
  if (confirm !== 'YAKIN') {
    console.log('Proses dibatalkan.');
    rl.close();
    process.exit(0);
  }

  console.log('\nMemulai proses pembersihan database...');
  try {
    // 1. Hapus Semua Transaksi & Operasional
    console.log('- Menghapus Orderan WA...');
    await prisma.waOrder.deleteMany({});
    
    console.log('- Menghapus Surat Jalan...');
    await prisma.deliveryItem.deleteMany({});
    await prisma.deliveryOrder.deleteMany({});
    
    console.log('- Menghapus Pergerakan Kas & Stok...');
    await prisma.cashMovement.deleteMany({});
    await prisma.stockMovement.deleteMany({});
    
    console.log('- Menghapus Utang Piutang...');
    await prisma.debtPayment.deleteMany({});
    await prisma.supplierDebt.deleteMany({});
    await prisma.customerDebt.deleteMany({});
    
    console.log('- Menghapus Transaksi PO (Pembelian)...');
    await prisma.purchaseItem.deleteMany({});
    await prisma.purchase.deleteMany({});
    
    console.log('- Menghapus Transaksi POS (Penjualan)...');
    await prisma.saleItem.deleteMany({});
    await prisma.sale.deleteMany({});
    
    // 2. Hapus Data Produk & Master Barang
    console.log('- Menghapus Data Produk & Stok...');
    await prisma.productImage.deleteMany({});
    await prisma.productUnit.deleteMany({});
    await prisma.product.deleteMany({});
    
    console.log('- Menghapus Kategori & Supplier...');
    await prisma.subCategory.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.supplier.deleteMany({});
    
    // 3. Hapus Data Customer (Kecuali UMUM)
    console.log('- Menghapus Data Pelanggan (Kecuali UMUM)...');
    await prisma.customer.deleteMany({
      where: {
        type: { not: 'UMUM' }
      }
    });

    console.log('\n✅ BERHASIL! Database telah di-reset (Produk, Transaksi, Surat Jalan, dll telah dihapus).');
    console.log('ℹ️ Data yang DIPERTAHANKAN: Akun Pengguna, Pengaturan Toko, Satuan (Unit), dan Pelanggan UMUM.');
  } catch (error) {
    console.error('❌ Terjadi kesalahan saat menghapus data:', error);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

main();
