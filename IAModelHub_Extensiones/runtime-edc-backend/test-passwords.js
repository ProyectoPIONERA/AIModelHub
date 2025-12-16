const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function testPasswords() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'ml_assets_db',
    user: 'ml_assets_user',
    password: 'ml_assets_password'
  });
  
  const result = await pool.query('SELECT username, password_hash FROM users');
  
  const passwords = {
    'user-conn-oeg-demo': 'a!ulzZ5dJvLJSzvM',
    'user-conn-edmundo-demo': 'D1S*ty@!UFTmr6U^'
  };
  
  console.log('Testing passwords...\n');
  
  for (const user of result.rows) {
    const password = passwords[user.username];
    if (password) {
      const match = await bcrypt.compare(password, user.password_hash);
      console.log(`${user.username}:`);
      console.log(`  Password: ${password}`);
      console.log(`  Hash: ${user.password_hash}`);
      console.log(`  Match: ${match}\n`);
    }
  }
  
  // Try with simple passwords
  console.log('\nTrying simple passwords...');
  const simplePasswords = ['password', 'password123', 'demo', 'admin', 'test'];
  
  for (const user of result.rows) {
    console.log(`\n${user.username}:`);
    for (const pass of simplePasswords) {
      const match = await bcrypt.compare(pass, user.password_hash);
      if (match) {
        console.log(`  ✓ FOUND: "${pass}"`);
      }
    }
  }
  
  await pool.end();
}

testPasswords().catch(console.error);
