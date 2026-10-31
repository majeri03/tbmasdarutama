const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Hapus token yang bukan format Expo Push Token
  const deleted = await prisma.deviceToken.deleteMany({
    where: { NOT: { token: { startsWith: 'ExponentPushToken' } } }
  });
  console.log('Token FCM lama dihapus:', deleted.count);

  // Bersihkan juga di kolom User.expoPushToken
  const updated = await prisma.user.updateMany({
    where: {
      expoPushToken: { not: null },
      NOT: { expoPushToken: { startsWith: 'ExponentPushToken' } }
    },
    data: { expoPushToken: null }
  });
  console.log('User.expoPushToken dibersihkan:', updated.count);

  await prisma.$disconnect();
  console.log('DONE - Database bersih dari token FCM lama.');
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
