const { createClient } = require('@libsql/client');
require('dotenv').config();

const url = process.env.TURSO_DB_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

const db = createClient({
  url: url || 'file:local.db',
  authToken: authToken,
});

async function check() {
  try {
    console.log('🔍 Checking users table schema...');
    const result = await db.execute("PRAGMA table_info(users)");
    console.log('--- Columns Found ---');
    result.rows.forEach(row => {
      console.log(`- ${row.name} (${row.type})`);
    });
    
    const hasBarcode = result.rows.some(r => r.name === 'barcode_id');
    const hasComplete = result.rows.some(r => r.name === 'profile_complete');
    
    if (!hasBarcode) console.log('❌ barcode_id is MISSING');
    if (!hasComplete) console.log('❌ profile_complete is MISSING');
    
    if (hasBarcode && hasComplete) console.log('✅ All columns are present!');
    
  } catch (e) {
    console.error('❌ Error checking schema:', e.message);
  }
}

check();
