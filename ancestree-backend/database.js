const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ancestree.db');
const db = new sqlite3.Database(dbPath);

// Helper function to insert a default node for a family
const insertDefaultNodeForFamily = (familyId, callback) => {
  db.run(`INSERT INTO nodes (
    id, family_id, type, position_x, position_y, name, surname, maiden_name, birth_date, death_date,
    city, zip, country, phone, bloodline
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    `default-${familyId}-${Date.now()}`, familyId, 'person', 0, 50, 'Family', 'Ancestor', null, '1900-01-01', null,
    null, null, null, null, 1
  ], function(insertErr) {
    if (insertErr) {
      console.error('Error inserting default node for family', familyId, ':', insertErr);
    } else {
      console.log('Inserted default node for family', familyId);
    }
    if (callback) callback(insertErr);
  });
};

// Function to check and ensure family has at least one node
const ensureFamilyHasNodes = (familyId) => {
  db.get("SELECT COUNT(*) as count FROM nodes WHERE family_id = ?", [familyId], (err, row) => {
    if (err) {
      console.error('Error checking node count for family', familyId, ':', err);
      return;
    }
    
    if (row && row.count === 0) {
      console.log('Family', familyId, 'has no nodes, inserting default node');
      insertDefaultNodeForFamily(familyId);
    }
  });
};

// Initialize database tables
db.serialize(() => {
  // Nodes table
  db.run(`CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    family_id INTEGER NOT NULL,
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
    bloodline BOOLEAN DEFAULT 1,
    preferred_image_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (family_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (preferred_image_id) REFERENCES images (id) ON DELETE SET NULL
  )`);

  // Edges table
  db.run(`CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    family_id INTEGER NOT NULL,
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    source_handle TEXT,
    target_handle TEXT,
    type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (family_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (source) REFERENCES nodes (id) ON DELETE CASCADE,
    FOREIGN KEY (target) REFERENCES nodes (id) ON DELETE CASCADE
  )`);

  // Images table
  db.run(`CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    family_id INTEGER NOT NULL,
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
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (family_id) REFERENCES users (id) ON DELETE CASCADE
  )`);

  // Image people associations table (many-to-many relationship)
  db.run(`CREATE TABLE IF NOT EXISTS image_people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL,
    image_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    position_x REAL,
    position_y REAL,
    width REAL,
    height REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (family_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES nodes (id) ON DELETE CASCADE,
    UNIQUE(image_id, person_id)
  )`);

  // Users table for authentication
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_name TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Chat messages table for image discussions
  db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_id TEXT NOT NULL,
    family_id INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE,
    FOREIGN KEY (family_id) REFERENCES users (id) ON DELETE CASCADE
  )`);

  // Add preferred_image_id column to nodes table if it doesn't exist
  db.run(`PRAGMA table_info(nodes)`, (err, result) => {
    if (err) {
      console.error('Error checking table info:', err);
      return;
    }
  });
  
  // Check if new columns exist, if not add them
  db.all(`PRAGMA table_info(nodes)`, (err, columns) => {
    if (err) {
      console.error('Error checking table columns:', err);
      return;
    }
    
    const columnNames = columns.map(col => col.name);
    
    const hasPreferredImageId = columnNames.includes('preferred_image_id');
    const hasEmail = columnNames.includes('email');
    const hasLatitude = columnNames.includes('latitude');
    const hasLongitude = columnNames.includes('longitude');
    const hasAddressHash = columnNames.includes('address_hash');
    const hasFamilyId = columnNames.includes('family_id');
    const hasMaidenName = columnNames.includes('maiden_name');
    const hasStreet = columnNames.includes('street');
    
    if (!hasPreferredImageId) {
      db.run(`ALTER TABLE nodes ADD COLUMN preferred_image_id TEXT REFERENCES images(id) ON DELETE SET NULL`, (alterErr) => {
        if (alterErr) {
          console.error('Error adding preferred_image_id column:', alterErr);
        } else {
          console.log('Successfully added preferred_image_id column to nodes table');
        }
      });
    }
    
    if (!hasEmail) {
      db.run(`ALTER TABLE nodes ADD COLUMN email TEXT`, (alterErr) => {
        if (alterErr) {
          console.error('Error adding email column:', alterErr);
        } else {
          console.log('Successfully added email column to nodes table');
        }
      });
    }
    
    if (!hasLatitude) {
      db.run(`ALTER TABLE nodes ADD COLUMN latitude REAL`, (alterErr) => {
        if (alterErr) {
          console.error('Error adding latitude column:', alterErr);
        } else {
          console.log('Successfully added latitude column to nodes table');
        }
      });
    }
    
    if (!hasLongitude) {
      db.run(`ALTER TABLE nodes ADD COLUMN longitude REAL`, (alterErr) => {
        if (alterErr) {
          console.error('Error adding longitude column:', alterErr);
        } else {
          console.log('Successfully added longitude column to nodes table');
        }
      });
    }
    
    if (!hasAddressHash) {
      db.run(`ALTER TABLE nodes ADD COLUMN address_hash TEXT`, (alterErr) => {
        if (alterErr) {
          console.error('Error adding address_hash column:', alterErr);
        } else {
          console.log('Successfully added address_hash column to nodes table');
        }
      });
    }
    
    if (!hasFamilyId) {
      db.run(`ALTER TABLE nodes ADD COLUMN family_id INTEGER REFERENCES users(id) ON DELETE CASCADE`, (alterErr) => {
        if (alterErr) {
          console.error('Error adding family_id column to nodes:', alterErr);
        } else {
          console.log('Successfully added family_id column to nodes table');
          
          // Set family_id = 1 for existing nodes (assuming first family)
          db.run(`UPDATE nodes SET family_id = 1 WHERE family_id IS NULL`, (updateErr) => {
            if (updateErr) {
              console.error('Error updating existing nodes with family_id:', updateErr);
            } else {
              console.log('Updated existing nodes with family_id = 1');
            }
          });
        }
      });
    }
    
    // Add maiden_name column if it doesn't exist
    if (!hasMaidenName) {
      db.run(`ALTER TABLE nodes ADD COLUMN maiden_name TEXT`, (alterErr) => {
        if (alterErr) {
          console.error('Error adding maiden_name column:', alterErr);
        } else {
          console.log('Successfully added maiden_name column to nodes table');
        }
      });
    }
    
    // Note: SQLite doesn't support DROP COLUMN easily, so we'll ignore the street column in code
    // The street column will remain in the database but won't be used
    if (hasStreet) {
      console.log('Street column exists but will be ignored in application logic');
    }
  });

  // Add family_id to edges table
  db.all(`PRAGMA table_info(edges)`, (err, columns) => {
    if (err) {
      console.error('Error checking edges table columns:', err);
      return;
    }
    
    const columnNames = columns.map(col => col.name);
    const hasFamilyId = columnNames.includes('family_id');
    
    if (!hasFamilyId) {
      db.run(`ALTER TABLE edges ADD COLUMN family_id INTEGER REFERENCES users(id) ON DELETE CASCADE`, (alterErr) => {
        if (alterErr) {
          console.error('Error adding family_id column to edges:', alterErr);
        } else {
          console.log('Successfully added family_id column to edges table');
          
          // Set family_id = 1 for existing edges
          db.run(`UPDATE edges SET family_id = 1 WHERE family_id IS NULL`, (updateErr) => {
            if (updateErr) {
              console.error('Error updating existing edges with family_id:', updateErr);
            } else {
              console.log('Updated existing edges with family_id = 1');
            }
          });
        }
      });
    }
  });

  // Add family_id to images table
  db.all(`PRAGMA table_info(images)`, (err, columns) => {
    if (err) {
      console.error('Error checking images table columns:', err);
      return;
    }
    
    const columnNames = columns.map(col => col.name);
    const hasFamilyId = columnNames.includes('family_id');
    
    if (!hasFamilyId) {
      db.run(`ALTER TABLE images ADD COLUMN family_id INTEGER REFERENCES users(id) ON DELETE CASCADE`, (alterErr) => {
        if (alterErr) {
          console.error('Error adding family_id column to images:', alterErr);
        } else {
          console.log('Successfully added family_id column to images table');
          
          // Set family_id = 1 for existing images
          db.run(`UPDATE images SET family_id = 1 WHERE family_id IS NULL`, (updateErr) => {
            if (updateErr) {
              console.error('Error updating existing images with family_id:', updateErr);
            } else {
              console.log('Updated existing images with family_id = 1');
            }
          });
        }
      });
    }
  });

  // Add family_id to image_people table
  db.all(`PRAGMA table_info(image_people)`, (err, columns) => {
    if (err) {
      console.error('Error checking image_people table columns:', err);
      return;
    }
    
    const columnNames = columns.map(col => col.name);
    const hasFamilyId = columnNames.includes('family_id');
    
    if (!hasFamilyId) {
      db.run(`ALTER TABLE image_people ADD COLUMN family_id INTEGER REFERENCES users(id) ON DELETE CASCADE`, (alterErr) => {
        if (alterErr) {
          console.error('Error adding family_id column to image_people:', alterErr);
        } else {
          console.log('Successfully added family_id column to image_people table');
          
          // Set family_id = 1 for existing image_people records
          db.run(`UPDATE image_people SET family_id = 1 WHERE family_id IS NULL`, (updateErr) => {
            if (updateErr) {
              console.error('Error updating existing image_people with family_id:', updateErr);
            } else {
              console.log('Updated existing image_people with family_id = 1');
            }
          });
        }
      });
    }
  });

  // Ensure all families have at least one node
  db.get("SELECT COUNT(*) as count FROM nodes", (err, row) => {
    if (err) {
      console.error('Error checking total node count:', err);
      return;
    }

    if (row && row.count === 0) {
      // No nodes at all, check if there are any families and add default nodes
      db.all("SELECT id FROM users", (err, users) => {
        if (err) {
          console.error('Error getting users:', err);
          return;
        }
        
        users.forEach(user => {
          insertDefaultNodeForFamily(user.id);
        });
      });
    } else {
      // Some nodes exist, check each family individually to ensure they all have nodes
      db.all("SELECT id FROM users", (err, users) => {
        if (err) {
          console.error('Error getting users for node check:', err);
          return;
        }
        
        users.forEach(user => {
          ensureFamilyHasNodes(user.id);
        });
      });
    }
  });
});

module.exports = {
  db,
  insertDefaultNodeForFamily,
  ensureFamilyHasNodes
};