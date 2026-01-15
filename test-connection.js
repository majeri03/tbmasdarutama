import { Client } from 'pg';

const client1 = new Client({
  host: 'localhost',
  port: 5432,
  database: 'tb_masdarutama',
  user: 'postgres',
  password: '', 
});

client1.connect()
  .then(() => {
    console.log('✅ Connected with EMPTY password');
    client1.end();
  })
  .catch(() => {
    console.log('❌ Failed with empty password');
    
    const client2 = new Client({
      host: 'localhost',
      port: 5432,
      database: 'tb_masdarutama',
      user: 'postgres',
      password: 'root',
    });
    
    client2.connect()
      .then(() => {
        console.log('✅ Connected with password: root');
        client2.end();
      })
      .catch(() => {
        console.log('❌ Failed with password: root');
        console.log('⚠️  Coba cek password PostgreSQL di Laragon!');
      });
  });