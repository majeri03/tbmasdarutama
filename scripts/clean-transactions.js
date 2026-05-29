const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const prisma = new PrismaClient();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('====================================================');
  console.log('   MEMBERSIHKAN DATA TRANSAKSI SIMULASI (TUTUP BUKU)');
  console.log('====================================================');
  console.log('PERINGATAN: Semua data penjualan, pembelian, utang piutang,');
  console.log('kas, surat jalan, dan riwayat stok akan dihapus PERMANEN.');
  console.log('Data master (Produk, Satuan, Pelanggan, Supplier, User) tetap aman.\n');

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
  
  const confirm = await question('Apakah Anda YAKIN ingin menghapus semua data transaksi? (Ketik "YAKIN" untuk lanjut): ');
  
  if (confirm !== 'YAKIN') {
    console.log('Proses dibatalkan.');
    rl.close();
    process.exit(0);
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Hapus Pembayaran Utang (debt_payments)
      const debtPayments = await tx.debtPayment.deleteMany();
      console.log(`[1/12] Terhapus ${debtPayments.count} data Pembayaran Utang (debt_payments)`);

      // 2. Hapus Utang Pelanggan (customer_debts)
      const customerDebts = await tx.customerDebt.deleteMany();
      console.log(`[2/12] Terhapus ${customerDebts.count} data Utang Pelanggan (customer_debts)`);

      // 3. Hapus Utang Supplier (supplier_debts)
      const supplierDebts = await tx.supplierDebt.deleteMany();
      console.log(`[3/12] Terhapus ${supplierDebts.count} data Utang Supplier (supplier_debts)`);

      // 4. Hapus Item Surat Jalan (delivery_items)
      const deliveryItems = await tx.deliveryItem.deleteMany();
      console.log(`[4/12] Terhapus ${deliveryItems.count} data Item Surat Jalan (delivery_items)`);

      // 5. Hapus Surat Jalan (delivery_orders)
      const deliveryOrders = await tx.deliveryOrder.deleteMany();
      console.log(`[5/12] Terhapus ${deliveryOrders.count} data Surat Jalan (delivery_orders)`);

      // 6. Hapus Item Penjualan POS (sale_items)
      const saleItems = await tx.saleItem.deleteMany();
      console.log(`[6/12] Terhapus ${saleItems.count} data Item Penjualan POS (sale_items)`);

      // 7. Hapus Penjualan POS (sales)
      const sales = await tx.sale.deleteMany();
      console.log(`[7/12] Terhapus ${sales.count} data Penjualan POS (sales)`);

      // 8. Hapus Item Pembelian PO (purchase_items)
      const purchaseItems = await tx.purchaseItem.deleteMany();
      console.log(`[8/12] Terhapus ${purchaseItems.count} data Item Pembelian PO (purchase_items)`);

      // 9. Hapus Pembelian PO (purchases)
      const purchases = await tx.purchase.deleteMany();
      console.log(`[9/12] Terhapus ${purchases.count} data Pembelian PO (purchases)`);

      // 10. Hapus Riwayat Gerak Stok (stock_movements)
      const stockMovements = await tx.stockMovement.deleteMany();
      console.log(`[10/12] Terhapus ${stockMovements.count} data Riwayat Gerak Stok (stock_movements)`);

      // 11. Hapus Kas Masuk/Keluar (cash_movements)
      const cashMovements = await tx.cashMovement.deleteMany();
      console.log(`[11/12] Terhapus ${cashMovements.count} data Kas Masuk/Keluar (cash_movements)`);

      // 12. Hapus Token Reset Password (password_reset_tokens)
      const pwdResetTokens = await tx.passwordResetToken.deleteMany();
      console.log(`[12/12] Terhapus ${pwdResetTokens.count} data Token Reset Password (password_reset_tokens)`);

      // 13. Reset stok produk ke 0 agar sinkron dengan transaksi yang kosong
      const resetStockResult = await tx.product.updateMany({
        data: { currentStock: 0 }
      });
      console.log(`\n-> Berhasil mereset stok ${resetStockResult.count} produk kembali ke 0`);
    });

    console.log('\n====================================================');
    console.log('SUKSES: Semua data transaksi simulasi berhasil dihapus!');
    console.log('Aplikasi siap masuk ke mode production/live.');
    console.log('====================================================');
  } catch (error) {
    console.error('\nERROR: Gagal membersihkan data transaksi:', error);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

main();
