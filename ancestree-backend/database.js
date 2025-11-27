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
 * Close a specific family database connection
 * @param {string} familyName - The family name to close the database for
 * @param {Function} callback - Callback with (err)
 */
const closeFamilyDatabase = (familyName, callback) => {
  if (familyDatabases.has(familyName)) {
    const db = familyDatabases.get(familyName);
    db.close((err) => {
      if (err) {
        console.error(`Error closing database for family ${familyName}:`, err);
        if (callback) callback(err);
      } else {
        familyDatabases.delete(familyName);
        console.log(`Closed database connection for family ${familyName}`);
        if (callback) callback(null);
      }
    });
  } else {
    // Database not in cache, nothing to close
    if (callback) callback(null);
  }
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
      display_name TEXT,
      password_hash TEXT NOT NULL,
      admin_password_hash TEXT,
      purpose TEXT,
      encryption_enabled BOOLEAN DEFAULT 1,
      encryption_salt TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Error creating users table:', err);
      } else {
        console.log('Authentication database initialized');
        
        // Check and add missing columns for existing databases
        authDb.all("PRAGMA table_info(users)", (err, columns) => {
          if (err) {
            console.error('Error checking table structure:', err);
            return;
          }
          
          const columnNames = columns.map(col => col.name);
          
          // Check and add admin_password_hash
          if (!columnNames.includes('admin_password_hash')) {
            authDb.run("ALTER TABLE users ADD COLUMN admin_password_hash TEXT", (err) => {
              if (err) {
                console.error('Error adding admin_password_hash column:', err);
              } else {
                console.log('Added admin_password_hash column to users table');
              }
            });
          }
          
          // Check and add display_name
          if (!columnNames.includes('display_name')) {
            authDb.run("ALTER TABLE users ADD COLUMN display_name TEXT", (err) => {
              if (err) {
                console.error('Error adding display_name column:', err);
              } else {
                console.log('Added display_name column to users table');
              }
            });
          }
          
          // Check and add purpose
          if (!columnNames.includes('purpose')) {
            authDb.run("ALTER TABLE users ADD COLUMN purpose TEXT", (err) => {
              if (err) {
                console.error('Error adding purpose column:', err);
              } else {
                console.log('Added purpose column to users table');
              }
            });
          }
          
          // Check and add encryption_enabled
          if (!columnNames.includes('encryption_enabled')) {
            authDb.run("ALTER TABLE users ADD COLUMN encryption_enabled BOOLEAN DEFAULT 1", (err) => {
              if (err) {
                console.error('Error adding encryption_enabled column:', err);
              } else {
                console.log('Added encryption_enabled column to users table');
              }
            });
          }
          
          // Check and add encryption_salt
          if (!columnNames.includes('encryption_salt')) {
            authDb.run("ALTER TABLE users ADD COLUMN encryption_salt TEXT", (err) => {
              if (err) {
                console.error('Error adding encryption_salt column:', err);
              } else {
                console.log('Added encryption_salt column to users table');
              }
            });
          }
          
          // Check and add show_street_fields
          if (!columnNames.includes('show_street_fields')) {
            authDb.run("ALTER TABLE users ADD COLUMN show_street_fields BOOLEAN DEFAULT 1", (err) => {
              if (err) {
                console.error('Error adding show_street_fields column:', err);
              } else {
                console.log('Added show_street_fields column to users table');
              }
            });
          }
          
          // Check and add show_phone_field
          if (!columnNames.includes('show_phone_field')) {
            authDb.run("ALTER TABLE users ADD COLUMN show_phone_field BOOLEAN DEFAULT 1", (err) => {
              if (err) {
                console.error('Error adding show_phone_field column:', err);
              } else {
                console.log('Added show_phone_field column to users table');
              }
            });
          }
          
          // Check and add show_email_field
          if (!columnNames.includes('show_email_field')) {
            authDb.run("ALTER TABLE users ADD COLUMN show_email_field BOOLEAN DEFAULT 1", (err) => {
              if (err) {
                console.error('Error adding show_email_field column:', err);
              } else {
                console.log('Added show_email_field column to users table');
              }
            });
          }
          
          // Check and add node_creation_locked
          if (!columnNames.includes('node_creation_locked')) {
            authDb.run("ALTER TABLE users ADD COLUMN node_creation_locked BOOLEAN DEFAULT 0", (err) => {
              if (err) {
                console.error('Error adding node_creation_locked column:', err);
              } else {
                console.log('Added node_creation_locked column to users table');
              }
            });
          }
          
          // Check and add terms_accepted_at
          if (!columnNames.includes('terms_accepted_at')) {
            authDb.run("ALTER TABLE users ADD COLUMN terms_accepted_at DATETIME", (err) => {
              if (err) {
                console.error('Error adding terms_accepted_at column:', err);
              } else {
                console.log('Added terms_accepted_at column to users table');
              }
            });
          }
          
          // Check and add terms_version
          if (!columnNames.includes('terms_version')) {
            authDb.run("ALTER TABLE users ADD COLUMN terms_version TEXT", (err) => {
              if (err) {
                console.error('Error adding terms_version column:', err);
              } else {
                console.log('Added terms_version column to users table');
              }
            });
          }
        });
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
      street TEXT,
      housenumber TEXT,
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
      last_geocoded DATETIME,
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

    // Admin table for UI key-value settings (purpose, display_name, etc.)
    familyDb.run(`CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Error creating admin table:', err);
      } else {
        console.log('Admin table initialized');
      }
    });

    // Completion settings table for tracking required fields
    familyDb.run(`CREATE TABLE IF NOT EXISTS completion_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      show_missing_required BOOLEAN DEFAULT 0,
      require_name BOOLEAN DEFAULT 1,
      require_surname BOOLEAN DEFAULT 1,
      require_maiden_name BOOLEAN DEFAULT 1,
      require_birth_date BOOLEAN DEFAULT 1,
      require_street_fields BOOLEAN DEFAULT 1,
      require_city_zip BOOLEAN DEFAULT 1,
      require_country BOOLEAN DEFAULT 1,
      require_phone BOOLEAN DEFAULT 1,
      require_email BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Error creating completion_settings table:', err);
      } else {
        console.log('Completion settings table initialized');
        // Insert default settings if table is empty
        familyDb.get("SELECT COUNT(*) as count FROM completion_settings", [], (err, row) => {
          if (err) {
            console.error('Error checking completion_settings count:', err);
          } else if (row && row.count === 0) {
            familyDb.run(`INSERT INTO completion_settings (
              show_missing_required, require_name, require_surname, require_maiden_name,
              require_birth_date, require_street_fields, require_city_zip, require_country,
              require_phone, require_email
            ) VALUES (0, 1, 1, 1, 1, 1, 1, 1, 1, 1)`, (err) => {
              if (err) {
                console.error('Error inserting default completion settings:', err);
              } else {
                console.log('Inserted default completion settings');
              }
            });
          }
        });
      }
    });

    // Migration: Add last_geocoded column to nodes table if it doesn't exist
    familyDb.all("PRAGMA table_info(nodes)", (err, columns) => {
      if (err) {
        console.error('Error checking nodes table schema:', err);
        return;
      }
      
      const columnNames = columns.map(col => col.name);
      
      if (!columnNames.includes('last_geocoded')) {
        familyDb.run("ALTER TABLE nodes ADD COLUMN last_geocoded DATETIME", (err) => {
          if (err) {
            console.error('Error adding last_geocoded column to nodes:', err);
          } else {
            console.log('Added last_geocoded column to nodes table');
          }
        });
      }
      
      // Migration: Add street column to nodes table if it doesn't exist
      if (!columnNames.includes('street')) {
        familyDb.run("ALTER TABLE nodes ADD COLUMN street TEXT", (err) => {
          if (err) {
            console.error('Error adding street column to nodes:', err);
          } else {
            console.log('Added street column to nodes table');
          }
        });
      }
      
      // Migration: Add housenumber column to nodes table if it doesn't exist
      if (!columnNames.includes('housenumber')) {
        familyDb.run("ALTER TABLE nodes ADD COLUMN housenumber TEXT", (err) => {
          if (err) {
            console.error('Error adding housenumber column to nodes:', err);
          } else {
            console.log('Added housenumber column to nodes table');
          }
        });
      }
    });

    // Migration: Add has_open_questions column to images table if it doesn't exist
    familyDb.all("PRAGMA table_info(images)", (err, columns) => {
      if (err) {
        console.error('Error checking images table schema:', err);
        return;
      }
      
      const columnNames = columns.map(col => col.name);
      
      if (!columnNames.includes('has_open_questions')) {
        familyDb.run("ALTER TABLE images ADD COLUMN has_open_questions BOOLEAN DEFAULT 0", (err) => {
          if (err) {
            console.error('Error adding has_open_questions column to images:', err);
          } else {
            console.log('Added has_open_questions column to images table');
          }
        });
      }
    });
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
  closeFamilyDatabase,
  insertDefaultNodeForFamily,
  ensureFamilyHasNodes
};