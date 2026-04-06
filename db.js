const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DB_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

// Logging for deployment debugging
if (url) {
  console.log('✅ Found TURSO_DB_URL');
} else {
  console.warn('⚠️ TURSO_DB_URL is MISSING from environment variables.');
}

const db = createClient({
  url: url || 'file:local.db', 
  authToken: authToken,
});


/**
 * Initialize the database schema.
 */
async function initDb() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        college_id TEXT UNIQUE NOT NULL,
        name TEXT,
        roll_no TEXT,
        course TEXT,
        branch TEXT,
        semester INTEGER,
        section TEXT,
        email TEXT,
        phone TEXT,
        profile_image TEXT,
        barcode_id TEXT UNIQUE,
        profile_complete BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Safeguard: Ensure required columns exist if table was created previously
    const columns = [
      "ALTER TABLE users ADD COLUMN barcode_id TEXT UNIQUE",
      "ALTER TABLE users ADD COLUMN profile_complete BOOLEAN DEFAULT 0",
      "ALTER TABLE users ADD COLUMN profile_image TEXT"
    ];

    for (const sql of columns) {
      try {
        await db.execute(sql);
        console.log(`✅ Database Migration: ${sql.split('ADD COLUMN ')[1]} added.`);
      } catch (e) {
        // Ignore "duplicate column name" or "already exists" errors
        if (!e.message.toLowerCase().includes("duplicate") && !e.message.toLowerCase().includes("already exists")) {
          // console.warn('⚠️ Migration notice:', e.message);
        }
      }
    }

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
  }
}

/**
 * Test the database connection.
 */
async function checkConnection() {
  try {
    const result = await db.execute("SELECT 1");
    return { status: "connected", message: "Successfully connected to Turso" };
  } catch (error) {
    return { status: "error", message: error.message };
  }
}

// Automatically init DB on start
initDb();

module.exports = { db, checkConnection };

