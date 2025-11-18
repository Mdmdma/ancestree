/**
 * Migration script to add admin_password_hash column and set default admin password
 * Run this script once to update existing databases
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const authDbPath = path.join(__dirname, 'databases', 'database_auth.db');
const authDb = new sqlite3.Database(authDbPath);

const DEFAULT_ADMIN_PASSWORD = 'adminn';

async function migrateAdminPassword() {
  console.log('Starting admin password migration...');
  
  try {
    // Check if column exists
    authDb.all("PRAGMA table_info(users)", async (err, columns) => {
      if (err) {
        console.error('Error checking table structure:', err);
        process.exit(1);
      }
      
      const hasAdminPassword = columns.some(col => col.name === 'admin_password_hash');
      
      if (!hasAdminPassword) {
        console.log('Adding admin_password_hash column...');
        authDb.run("ALTER TABLE users ADD COLUMN admin_password_hash TEXT", (err) => {
          if (err) {
            console.error('Error adding column:', err);
            process.exit(1);
          }
          console.log('✓ Column added successfully');
          setDefaultPasswords();
        });
      } else {
        console.log('Column already exists, checking for null values...');
        setDefaultPasswords();
      }
    });
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

async function setDefaultPasswords() {
  authDb.all("SELECT id, family_name, admin_password_hash FROM users", async (err, users) => {
    if (err) {
      console.error('Error fetching users:', err);
      process.exit(1);
    }
    
    console.log(`Found ${users.length} user(s)`);
    
    const usersWithoutAdminPassword = users.filter(u => !u.admin_password_hash);
    
    if (usersWithoutAdminPassword.length === 0) {
      console.log('All users already have admin passwords set');
      closeDatabase();
      return;
    }
    
    console.log(`Setting default admin password for ${usersWithoutAdminPassword.length} user(s)...`);
    
    const saltRounds = 10;
    const defaultAdminHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, saltRounds);
    
    let completed = 0;
    
    for (const user of usersWithoutAdminPassword) {
      authDb.run(
        "UPDATE users SET admin_password_hash = ? WHERE id = ?",
        [defaultAdminHash, user.id],
        (err) => {
          if (err) {
            console.error(`Error updating user ${user.family_name}:`, err);
          } else {
            console.log(`✓ Set default admin password for family: ${user.family_name}`);
          }
          
          completed++;
          if (completed === usersWithoutAdminPassword.length) {
            console.log('\n✓ Migration completed successfully!');
            console.log(`Default admin password: "${DEFAULT_ADMIN_PASSWORD}"`);
            closeDatabase();
          }
        }
      );
    }
  });
}

function closeDatabase() {
  authDb.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    }
    process.exit(0);
  });
}

// Run migration
migrateAdminPassword();
