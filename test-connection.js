import { Client } from 'pg';

// SECURITY FIX (Nov 2026): password database lokal sebelumnya ditulis
// langsung di file ini ('', 'root'). Sekarang dibaca dari environment.
// Cara pakai: PGPASSWORD=<password-postgres-lokal> node test-connection.js
// (file ini hanya untuk tes koneksi lokal, jangan dipakai di production)
const dbPassword = process.env.PGPASSWORD ?? process.env.DB_PASSWORD ?? '';

const client = new Client({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'tb_masdarutama',
  user: process.env.PGUSER || 'postgres',
  password: dbPassword,
});

client.connect()
  .then(() => {
    console.log('✅ Connected to PostgreSQL');
    client.end();
  })
  .catch((err) => {
    console.log('❌ Failed to connect. Cek PGPASSWORD / password PostgreSQL lokal.');
    console.error(err.message);
  });
