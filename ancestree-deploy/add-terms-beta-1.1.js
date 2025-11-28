const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Authentication database path
const authDbPath = path.join(__dirname, 'databases', 'database_auth.db');

// Read the TermsAndConditions.jsx file from the built dist folder
const termsFilePath = path.join(__dirname, 'dist/assets/TermsAndConditions-*.js');
const glob = require('glob');

console.log('Adding terms version beta-1.1 to the database...');

// Try to find the terms file in dist
let termsContent = null;
try {
  // For deployment, we'll use a hardcoded version since the file is bundled
  // In production, you should extract this from your source or have it as a separate file
  const termsSourcePath = path.join(__dirname, '../ancestree-app/src/TermsAndConditions.jsx');
  if (fs.existsSync(termsSourcePath)) {
    termsContent = fs.readFileSync(termsSourcePath, 'utf8');
    console.log('Using terms from source file');
  } else {
    console.log('Source file not found, will add placeholder');
    termsContent = '// Terms content for beta-1.1 (private S3 bucket)\n// Full content should be updated from TermsAndConditions.jsx';
  }
} catch (error) {
  console.error('Error reading terms file:', error);
  termsContent = '// Terms content for beta-1.1 (private S3 bucket)\n// Full content should be updated from TermsAndConditions.jsx';
}

const db = new sqlite3.Database(authDbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  
  console.log('Database opened successfully');
  
  // First, check if the content column exists
  db.all("PRAGMA table_info(terms)", (err, columns) => {
    if (err) {
      console.error('Error checking terms table schema:', err);
      db.close();
      process.exit(1);
    }
    
    const columnNames = columns.map(col => col.name);
    
    if (!columnNames.includes('content')) {
      console.log('Content column does not exist, adding it...');
      db.run("ALTER TABLE terms ADD COLUMN content TEXT", (err) => {
        if (err) {
          console.error('Error adding content column:', err);
          db.close();
          process.exit(1);
        }
        console.log('Content column added successfully');
        insertNewTermsVersion();
      });
    } else {
      console.log('Content column already exists');
      insertNewTermsVersion();
    }
  });
  
  function insertNewTermsVersion() {
    // Check if beta-1.1 already exists
    db.get('SELECT id FROM terms WHERE version = ?', ['beta-1.1'], (err, row) => {
      if (err) {
        console.error('Error checking for existing terms version:', err);
        db.close();
        process.exit(1);
      }
      
      if (row) {
        console.log('Terms version beta-1.1 already exists, updating content...');
        db.run(
          'UPDATE terms SET content = ?, release_date = ? WHERE version = ?',
          [termsContent, '2025-11-28', 'beta-1.1'],
          function(err) {
            if (err) {
              console.error('Error updating terms version:', err);
              db.close();
              process.exit(1);
            }
            console.log('Terms version beta-1.1 updated successfully');
            
            // Also update beta-1.0 with content if it doesn't have it
            updateBeta10Content();
          }
        );
      } else {
        console.log('Inserting new terms version beta-1.1...');
        db.run(
          'INSERT INTO terms (version, release_date, content) VALUES (?, ?, ?)',
          ['beta-1.1', '2025-11-28', termsContent],
          function(err) {
            if (err) {
              console.error('Error inserting new terms version:', err);
              db.close();
              process.exit(1);
            }
            console.log('Terms version beta-1.1 inserted successfully with ID:', this.lastID);
            
            // Also update beta-1.0 with content if it doesn't have it
            updateBeta10Content();
          }
        );
      }
    });
  }
  
  function updateBeta10Content() {
    db.get('SELECT id, content FROM terms WHERE version = ?', ['beta-1.0'], (err, row) => {
      if (err) {
        console.error('Error checking beta-1.0:', err);
      } else if (row && !row.content) {
        console.log('beta-1.0 exists but has no content, adding note...');
        const beta10Note = '// Terms content for beta-1.0 (before private S3 bucket change)\n// See beta-1.1 for the updated version with private S3 bucket changes';
        db.run(
          'UPDATE terms SET content = ? WHERE version = ?',
          [beta10Note, 'beta-1.0'],
          (err) => {
            if (err) {
              console.error('Error updating beta-1.0:', err);
            } else {
              console.log('Added note to beta-1.0');
            }
            finishUp();
          }
        );
      } else {
        finishUp();
      }
    });
  }
  
  function finishUp() {
    // List all terms versions
    console.log('\nAll terms versions in database:');
    db.all('SELECT version, release_date, LENGTH(content) as content_length FROM terms ORDER BY release_date', (err, rows) => {
      if (err) {
        console.error('Error listing terms:', err);
      } else {
        rows.forEach(row => {
          console.log(`  - ${row.version} (${row.release_date}) - Content length: ${row.content_length || 0} bytes`);
        });
      }
      
      console.log('\nDone!');
      db.close();
    });
  }
});
