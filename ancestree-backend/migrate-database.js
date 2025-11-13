const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

/**
 * Migration script to split monolithic database into:
 * 1. Auth database (databases/database_auth.db) - contains users table
 * 2. Family databases (databases/database_family_<family-name>.db) - contains family-specific data
 */

const oldDbPath = path.join(__dirname, 'databases', 'ancestree.db');
const authDbPath = path.join(__dirname, 'databases', 'database_auth.db');

// Check if old database exists
if (!fs.existsSync(oldDbPath)) {
  console.log('No old database found. Skipping migration.');
  process.exit(0);
}

// Check if migration has already been done
if (fs.existsSync(authDbPath)) {
  console.log('Migration already completed. Auth database exists.');
  process.exit(0);
}

console.log('Starting database migration...');

const oldDb = new sqlite3.Database(oldDbPath);
const authDb = new sqlite3.Database(authDbPath);

// Step 1: Create auth database and copy users table
console.log('Step 1: Creating authentication database...');

authDb.serialize(() => {
  authDb.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_name TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating users table in auth DB:', err);
      process.exit(1);
    }
    console.log('Auth database users table created');
    
    // Step 2: Copy users from old database
    oldDb.all('SELECT * FROM users', [], (err, users) => {
      if (err) {
        console.error('Error reading users from old database:', err);
        process.exit(1);
      }
      
      if (!users || users.length === 0) {
        console.log('No users found in old database');
        finishMigration();
        return;
      }
      
      console.log(`Found ${users.length} users to migrate`);
      
      let completed = 0;
      users.forEach(user => {
        authDb.run(
          'INSERT INTO users (id, family_name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [user.id, user.family_name, user.password_hash, user.created_at, user.updated_at],
          (err) => {
            if (err) {
              console.error(`Error inserting user ${user.family_name}:`, err);
            } else {
              console.log(`Migrated user: ${user.family_name}`);
            }
            
            completed++;
            if (completed === users.length) {
              // Step 3: Create family databases
              migrateFamilyData(users);
            }
          }
        );
      });
    });
  });
});

function migrateFamilyData(users) {
  console.log('Step 2: Creating family-specific databases...');
  
  let familiesCompleted = 0;
  
  users.forEach(user => {
    const familyDbPath = path.join(__dirname, 'databases', `database_family_${user.family_name}.db`);
    const familyDb = new sqlite3.Database(familyDbPath);
    
    familyDb.serialize(() => {
      // Create tables
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
      
      familyDb.run(`CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE
      )`, (err) => {
        if (err) {
          console.error(`Error creating tables for family ${user.family_name}:`, err);
          return;
        }
        
        // Copy data for this family
        copyFamilyData(user.id, user.family_name, familyDb, oldDb, () => {
          familyDb.close();
          familiesCompleted++;
          
          if (familiesCompleted === users.length) {
            finishMigration();
          }
        });
      });
    });
  });
}

function copyFamilyData(familyId, familyName, familyDb, oldDb, callback) {
  console.log(`Migrating data for family: ${familyName} (ID: ${familyId})`);
  
  // Copy nodes
  oldDb.all('SELECT * FROM nodes WHERE family_id = ?', [familyId], (err, nodes) => {
    if (err) {
      console.error(`Error reading nodes for family ${familyName}:`, err);
      callback();
      return;
    }
    
    if (nodes && nodes.length > 0) {
      let nodesInserted = 0;
      nodes.forEach(node => {
        familyDb.run(`INSERT INTO nodes (
          id, type, position_x, position_y, name, surname, maiden_name, birth_date, death_date,
          city, zip, country, phone, email, latitude, longitude, address_hash, bloodline,
          preferred_image_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [node.id, node.type, node.position_x, node.position_y, node.name, node.surname,
         node.maiden_name, node.birth_date, node.death_date, node.city, node.zip, node.country,
         node.phone, node.email, node.latitude, node.longitude, node.address_hash, node.bloodline,
         node.preferred_image_id, node.created_at, node.updated_at],
        (err) => {
          if (err) console.error(`Error inserting node ${node.id}:`, err);
          nodesInserted++;
          if (nodesInserted === nodes.length) {
            console.log(`  Migrated ${nodes.length} nodes`);
            copyEdges();
          }
        });
      });
    } else {
      copyEdges();
    }
    
    function copyEdges() {
      // Copy edges
      oldDb.all('SELECT * FROM edges WHERE family_id = ?', [familyId], (err, edges) => {
        if (err) {
          console.error(`Error reading edges for family ${familyName}:`, err);
          callback();
          return;
        }
        
        if (edges && edges.length > 0) {
          let edgesInserted = 0;
          edges.forEach(edge => {
            familyDb.run(`INSERT INTO edges (
              id, source, target, source_handle, target_handle, type, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [edge.id, edge.source, edge.target, edge.source_handle, edge.target_handle,
             edge.type, edge.created_at],
            (err) => {
              if (err) console.error(`Error inserting edge ${edge.id}:`, err);
              edgesInserted++;
              if (edgesInserted === edges.length) {
                console.log(`  Migrated ${edges.length} edges`);
                copyImages();
              }
            });
          });
        } else {
          copyImages();
        }
      });
    }
    
    function copyImages() {
      // Copy images
      oldDb.all('SELECT * FROM images WHERE family_id = ?', [familyId], (err, images) => {
        if (err) {
          console.error(`Error reading images for family ${familyName}:`, err);
          callback();
          return;
        }
        
        if (images && images.length > 0) {
          let imagesInserted = 0;
          images.forEach(image => {
            familyDb.run(`INSERT INTO images (
              id, filename, original_filename, s3_key, s3_url, description, upload_date,
              file_size, mime_type, uploaded_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [image.id, image.filename, image.original_filename, image.s3_key, image.s3_url,
             image.description, image.upload_date, image.file_size, image.mime_type,
             image.uploaded_by, image.created_at, image.updated_at],
            (err) => {
              if (err) console.error(`Error inserting image ${image.id}:`, err);
              imagesInserted++;
              if (imagesInserted === images.length) {
                console.log(`  Migrated ${images.length} images`);
                copyImagePeople();
              }
            });
          });
        } else {
          copyImagePeople();
        }
      });
    }
    
    function copyImagePeople() {
      // Copy image_people
      oldDb.all('SELECT * FROM image_people WHERE family_id = ?', [familyId], (err, imagePeople) => {
        if (err) {
          console.error(`Error reading image_people for family ${familyName}:`, err);
          callback();
          return;
        }
        
        if (imagePeople && imagePeople.length > 0) {
          let ipInserted = 0;
          imagePeople.forEach(ip => {
            familyDb.run(`INSERT INTO image_people (
              image_id, person_id, position_x, position_y, width, height, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [ip.image_id, ip.person_id, ip.position_x, ip.position_y, ip.width, ip.height,
             ip.created_at],
            (err) => {
              if (err) console.error(`Error inserting image_people:`, err);
              ipInserted++;
              if (ipInserted === imagePeople.length) {
                console.log(`  Migrated ${imagePeople.length} image_people records`);
                copyChatMessages();
              }
            });
          });
        } else {
          copyChatMessages();
        }
      });
    }
    
    function copyChatMessages() {
      // Copy chat_messages
      oldDb.all('SELECT * FROM chat_messages WHERE family_id = ?', [familyId], (err, messages) => {
        if (err) {
          console.error(`Error reading chat_messages for family ${familyName}:`, err);
          callback();
          return;
        }
        
        if (messages && messages.length > 0) {
          let msgsInserted = 0;
          messages.forEach(msg => {
            familyDb.run(`INSERT INTO chat_messages (
              image_id, user_name, message, created_at
            ) VALUES (?, ?, ?, ?)`,
            [msg.image_id, msg.user_name, msg.message, msg.created_at],
            (err) => {
              if (err) console.error(`Error inserting chat_message:`, err);
              msgsInserted++;
              if (msgsInserted === messages.length) {
                console.log(`  Migrated ${messages.length} chat messages`);
                callback();
              }
            });
          });
        } else {
          callback();
        }
      });
    }
  });
}

function finishMigration() {
  console.log('\n=== Migration Complete ===');
  console.log('Old database has been split into:');
  console.log('  - database_auth.db (authentication)');
  console.log('  - database_family_<family-name>.db (family data)');
  console.log('\nYou can now rename or backup ancestree.db');
  console.log('The new database architecture is ready to use.');
  
  oldDb.close();
  authDb.close();
  process.exit(0);
}
