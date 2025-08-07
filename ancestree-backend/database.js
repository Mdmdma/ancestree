const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ancestree.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
db.serialize(() => {
  // Nodes table
  db.run(`CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    position_x REAL NOT NULL,
    position_y REAL NOT NULL,
    name TEXT,
    surname TEXT,
    birth_date TEXT,
    death_date TEXT,
    street TEXT,
    city TEXT,
    zip TEXT,
    country TEXT,
    phone TEXT,
    gender TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Edges table
  db.run(`CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    source_handle TEXT,
    target_handle TEXT,
    type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source) REFERENCES nodes (id) ON DELETE CASCADE,
    FOREIGN KEY (target) REFERENCES nodes (id) ON DELETE CASCADE
  )`);

  // Insert initial data if empty
  db.get("SELECT COUNT(*) as count FROM nodes", (err, row) => {
    if (row.count === 0) {
      db.run(`INSERT INTO nodes (
        id, type, position_x, position_y, name, surname, birth_date, death_date,
        street, city, zip, country, phone, gender
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        '0', 'person', 0, 50, 'Moidal', 'Erler', '1890-01-01', '1950-01-01',
        'Hauptstraße 123', 'Tux', '6293', 'AT', '+43 5287 87123', 'female'
      ]);
    }
  });
});

module.exports = db;