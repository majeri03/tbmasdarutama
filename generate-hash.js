import { hash as _hash } from 'bcryptjs';

async function generateHash() {
  const password = 'admin123';
  const hash = await _hash(password, 10);
  console.log('Password Hash untuk admin123:');
  console.log(hash);
}

generateHash();