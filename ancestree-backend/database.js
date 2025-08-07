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
    bloodline BOOLEAN DEFAULT 1,
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

  // Images table
  db.run(`CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    s3_url TEXT NOT NULL,
    description TEXT,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    file_size INTEGER,
    mime_type TEXT,
    uploaded_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Image people associations table (many-to-many relationship)
  db.run(`CREATE TABLE IF NOT EXISTS image_people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    position_x REAL,
    position_y REAL,
    width REAL,
    height REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES nodes (id) ON DELETE CASCADE,
    UNIQUE(image_id, person_id)
  )`);

  // Insert initial data if empty
  db.get("SELECT COUNT(*) as count FROM nodes", (err, row) => {
    if (row.count === 0) {
      db.run(`INSERT INTO nodes (
        id, type, position_x, position_y, name, surname, birth_date, death_date,
        street, city, zip, country, phone, gender, bloodline
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        '0', 'person', 0, 50, 'Moidal', 'Erler', '1890-01-01', '1950-01-01',
        'Hauptstraße 123', 'Tux', '6293', 'AT', '+43 5287 87123', 'female', 1
      ]);
    }
  });
});

module.exports = db;