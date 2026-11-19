const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// SECURITY FIX (Nov 2026): password yang dicek sebelumnya ditulis langsung
// di file ini. Sekarang dibaca dari argumen / environment, supaya tidak ada
// lagi password literal di repo.
// Cara pakai: node scripts/check-users.js <password-yang-mau-dicek>
// atau: CHECK_PASSWORD=<password> node scripts/check-users.js
const passwordToCheck = process.argv[2] || process.env.CHECK_PASSWORD || '';
if (!passwordToCheck) {
  console.error('Cara pakai: node scripts/check-users.js <password>  (atau env CHECK_PASSWORD)');
  process.exit(1);
}

async function main() {
  const users = await prisma.user.findMany();
  for (const u of users) {
    const isMatched = await bcrypt.compare(passwordToCheck, u.password);
    console.log({ id: u.id, email: u.email, match: isMatched });
  }
}

main().finally(() => prisma.$disconnect());
