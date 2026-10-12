const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  for (const u of users) {
    const isMatched = await bcrypt.compare('admin123', u.password);
    console.log({ id: u.id, email: u.email, matchAdmin123: isMatched });
  }
}

main().finally(() => prisma.$disconnect());
