const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'inspections.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Create tables if not exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_name TEXT NOT NULL,
      ward TEXT NOT NULL,
      license_number TEXT NOT NULL,
      inspection_date DATE NOT NULL,
      inspector_name TEXT,
      findings TEXT,
      next_due_date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Index for faster queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_ward ON inspections(ward);`),
  db.run(`CREATE INDEX IF NOT EXISTS idx_next_due_date ON inspections(next_due_date);`);
});

module.exports = db;