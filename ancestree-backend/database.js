const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Authentication database - contains only users table
const authDbPath = path.join(__dirname, 'databases', 'database_auth.db');
const authDb = new sqlite3.Database(authDbPath);

// Cache for family database connections
const familyDatabases = new Map();

/**
 * Get or create a family-specific database connection
 * @param {string} familyName - The family name to get the database for
 * @returns {sqlite3.Database} The family database connection
 */
const getFamilyDb = (familyName) => {
  if (!familyName) {
    throw new Error('Family name is required to get family database');
  }

  // Check if we already have this connection cached
  if (familyDatabases.has(familyName)) {
    return familyDatabases.get(familyName);
  }

  // Create new connection
  const familyDbPath = path.join(__dirname, 'databases', `database_family_${familyName}.db`);
  const familyDb = new sqlite3.Database(familyDbPath);
  
  // Initialize the family database schema
  initializeFamilyDb(familyDb);
  
  // Cache the connection
  familyDatabases.set(familyName, familyDb);
  
  return familyDb;
};

/**
 * Get a family database by family ID
 * @param {number} familyId - The family ID
 * @param {Function} callback - Callback with (err, db, familyName)
 */
const getFamilyDbById = (familyId, callback) => {
  authDb.get('SELECT family_name FROM users WHERE id = ?', [familyId], (err, row) => {
    if (err) {
      return callback(err);
    }
    if (!row) {
      return callback(new Error('Family not found'));
    }
    try {
      const db = getFamilyDb(row.family_name);
      callback(null, db, row.family_name);
    } catch (error) {
      callback(error);
    }
  });
};

/**
 * Close all family database connections
 */
const closeAllFamilyDatabases = () => {
  for (const [familyName, db] of familyDatabases.entries()) {
    db.close((err) => {
      if (err) {
        console.error(`Error closing database for family ${familyName}:`, err);
      }
    });
  }
  familyDatabases.clear();
};

/**
 * Initialize the authentication database schema
 */
const initializeAuthDb = () => {
  authDb.serialize(() => {
    // Users table for authentication
    authDb.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_name TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Error creating users table:', err);
      } else {
        console.log('Authentication database initialized');
      }
    });
  });
};

/**
 * Initialize a family-specific database schema
 * @param {sqlite3.Database} familyDb - The family database connection
 */
const initializeFamilyDb = (familyDb) => {
  familyDb.serialize(() => {
    // Nodes table
    familyDb.run(`CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      position_x REAL NOT NULL,
      position_y REAL NOT NULL,
      name TEXT,
      surname TEXT,
      maiden_name TEXT,
      birth_date TEXT,
      death_date TEXT,
      city TEXT,
      zip TEXT,
      country TEXT,
      phone TEXT,
      email TEXT,
      bloodline BOOLEAN DEFAULT 1,
      preferred_image_id TEXT,
      latitude REAL,
      longitude REAL,
      address_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (preferred_image_id) REFERENCES images (id) ON DELETE SET NULL
    )`);

    // Edges table
    familyDb.run(`CREATE TABLE IF NOT EXISTS edges (
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
    familyDb.run(`CREATE TABLE IF NOT EXISTS images (
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
    familyDb.run(`CREATE TABLE IF NOT EXISTS image_people (
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

    // Chat messages table for image discussions
    familyDb.run(`CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE
    )`);
  });
};

// Helper function to insert a default node for a family
const insertDefaultNodeForFamily = (familyId, callback) => {
  getFamilyDbById(familyId, (err, familyDb, familyName) => {
    if (err) {
      console.error('Error getting family database:', err);
      if (callback) callback(err);
      return;
    }

    familyDb.run(`INSERT INTO nodes (
      id, type, position_x, position_y, name, surname, maiden_name, birth_date, death_date,
      city, zip, country, phone, bloodline
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      `default-${familyId}-${Date.now()}`, 'person', 0, 50, 'Family', 'Ancestor', null, '1900-01-01', null,
      null, null, null, null, 1
    ], function(insertErr) {
      if (insertErr) {
        console.error('Error inserting default node for family', familyId, ':', insertErr);
      } else {
        console.log('Inserted default node for family', familyId);
      }
      if (callback) callback(insertErr);
    });
  });
};

// Function to check and ensure family has at least one node
const ensureFamilyHasNodes = (familyId) => {
  getFamilyDbById(familyId, (err, familyDb, familyName) => {
    if (err) {
      console.error('Error getting family database for node check:', err);
      return;
    }

    familyDb.get("SELECT COUNT(*) as count FROM nodes", [], (err, row) => {
      if (err) {
        console.error('Error checking node count for family', familyId, ':', err);
        return;
      }
      
      if (row && row.count === 0) {
        console.log('Family', familyId, 'has no nodes, inserting default node');
        insertDefaultNodeForFamily(familyId);
      }
    });
  });
};

// Initialize authentication database
initializeAuthDb();

// Ensure all families have at least one node (check after auth DB is ready)
authDb.all("SELECT id FROM users", [], (err, users) => {
  if (err) {
    console.error('Error getting users for node check:', err);
    return;
  }
  
  if (users && users.length > 0) {
    users.forEach(user => {
      ensureFamilyHasNodes(user.id);
    });
  }
});

module.exports = {
  authDb,
  getFamilyDb,
  getFamilyDbById,
  closeAllFamilyDatabases,
  insertDefaultNodeForFamily,
  ensureFamilyHasNodes
};