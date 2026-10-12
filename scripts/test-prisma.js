const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true }
  });
  console.log('Connected to DB successfully!');
  console.log('Users found:', users);
  
  const customerCount = await prisma.customer.count();
  const productCount = await prisma.product.count();
  const saleCount = await prisma.sale.count();
  const debtCount = await prisma.customerDebt.count();
  const doCount = await prisma.deliveryOrder.count();
  
  console.log({ customerCount, productCount, saleCount, debtCount, doCount });
}

main()
  .catch((e) => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
