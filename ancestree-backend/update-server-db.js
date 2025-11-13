const fs = require('fs');
const path = require('path');

/**
 * Script to update server.js to use new database architecture
 * Replaces all `db.` calls with appropriate `familyDb.` calls
 * Ensures family_id parameters are removed from SQL queries
 */

const serverPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

console.log('Starting server.js database architecture update...');

// Track changes
let changeCount = 0;

// Pattern 1: Replace WHERE clauses that filter by family_id
// Since each family has its own database, we don't need WHERE family_id = ?
const familyIdWherePatterns = [
  // Pattern: WHERE family_id = ?
  {
    search: /WHERE family_id = \?(?!\s*AND)/g,
    replace: ''
  },
  // Pattern: WHERE column = ? AND family_id = ?
  {
    search: /WHERE (\w+) = \? AND family_id = \?/g,
    replace: 'WHERE $1 = ?'
  },
  // Pattern: WHERE column = ? AND column2 = ? AND family_id = ?
  {
    search: /WHERE (.*?) AND family_id = \?/g,
    replace: 'WHERE $1'
  },
  // Pattern: (source = ? OR target = ?) AND family_id = ?
  {
    search: /\(source = \? OR target = \?\) AND family_id = \?/g,
    replace: '(source = ? OR target = ?)'
  }
];

familyIdWherePatterns.forEach((pattern, index) => {
  const matches = content.match(pattern.search);
  if (matches) {
    content = content.replace(pattern.search, pattern.replace);
    changeCount += matches.length;
    console.log(`  Applied pattern ${index + 1}: ${matches.length} replacements`);
  }
});

// Pattern 2: Remove family_id from parameter arrays
// This is tricky - we need to remove the last familyId parameter from arrays
// We'll handle this manually in specific cases

// Pattern 3: Replace remaining db. with getFamilyDb() pattern
// Find all remaining db.run, db.get, db.all calls that aren't in auth endpoints

const lines = content.split('\n');
let inAuthEndpoint = false;
let inCleanupRoute = false;
let updatedLines = [];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  
  // Track if we're in an auth endpoint
  if (line.includes("app.post('/api/auth") || line.includes("app.get('/api/auth")) {
    inAuthEndpoint = true;
  } else if (line.match(/^app\.(get|post|put|delete)\(/)) {
    inAuthEndpoint = false;
  }
  
  // Track cleanup routes
  if (line.includes('// Cleanup routes') || line.includes('// Database cleanup')) {
    inCleanupRoute = true;
  } else if (line.match(/^app\.(get|post|put|delete)\(/) && !line.includes('/api/cleanup')) {
    inCleanupRoute = false;
  }
  
  // Don't replace db. in auth endpoints (they should use authDb)
  // Don't replace db. in cleanup routes (we'll handle those separately)
  if (!inAuthEndpoint && !inCleanupRoute) {
    // Check if line has db.run, db.get, or db.all and doesn't already have familyDb
    if ((line.includes('db.run(') || line.includes('db.get(') || line.includes('db.all(')) && 
        !line.includes('authDb') && !line.includes('familyDb')) {
      
      // Look back to find if we have familyName in scope
      let hasFamilyNameInScope = false;
      let hasFamilyDbInScope = false;
      
      for (let j = Math.max(0, i - 50); j < i; j++) {
        if (updatedLines[j].includes('const familyName =') || updatedLines[j].includes('familyName =')) {
          hasFamilyNameInScope = true;
        }
        if (updatedLines[j].includes('const familyDb =') || updatedLines[j].includes('familyDb =')) {
          hasFamilyDbInScope = true;
        }
      }
      
      if (hasFamilyDbInScope) {
        // Just replace db. with familyDb.
        line = line.replace(/\bdb\./g, 'familyDb.');
        changeCount++;
      }
    }
  }
  
  updatedLines.push(line);
}

content = updatedLines.join('\n');

// Write the updated content
fs.writeFileSync(serverPath, content, 'utf8');

console.log(`\nCompleted! Made ${changeCount} changes to server.js`);
console.log('\nNote: Manual review is recommended for:');
console.log('  1. Cleanup routes that operate across all families');
console.log('  2. Parameter arrays that may need familyId removed');
console.log('  3. Endpoints that need getFamilyDb() wrapper added');
