const fs = require('fs');
const path = require('path');

/**
 * Comprehensive server.js updater for new database architecture
 * This script systematically updates all database calls
 */

const serverPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

console.log('Starting comprehensive server.js update...\n');

let totalChanges = 0;

// Step 1: Update remaining db.run/get/all calls within endpoints that have familyDb in scope
console.log('Step 1: Replacing db. with familyDb. where familyDb is in scope...');
const lines = content.split('\n');
const updatedLines = [];
let inEndpointWithFamilyDb = false;
let step1Changes = 0;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  
  // Check if we have const familyDb = in recent lines
  if (line.includes('const familyDb = getFamilyDb(')) {
    inEndpointWithFamilyDb = true;
  }
  
  // Reset at next endpoint
  if (line.match(/^app\.(get|post|put|delete)\(/)) {
    if (!line.includes('familyDb')) {
      inEndpointWithFamilyDb = false;
    }
  }
  
  // Replace db. with familyDb. if in endpoint with familyDb
  if (inEndpointWithFamilyDb && line.match(/\bdb\.(run|get|all)\(/)) {
    line = line.replace(/\bdb\./g, 'familyDb.');
    step1Changes++;
  }
  
  updatedLines.push(line);
}

content = updatedLines.join('\n');
totalChanges += step1Changes;
console.log(`  Made ${step1Changes} replacements\n`);

// Step 2: Remove family_id from WHERE clauses
console.log('Step 2: Removing family_id from WHERE clauses...');
const step2Patterns = [
  {
    name: 'WHERE family_id = ? alone',
    pattern: /\s+WHERE family_id = \?(?!\s+AND)/g,
    replacement: ''
  },
  {
    name: 'AND family_id = ? at end',
    pattern: /\s+AND family_id = \?(?=[\s\n]*["'`])/g,
    replacement: ''
  },
  {
    name: 'WHERE id = ? AND family_id = ?',
    pattern: /WHERE id = \? AND family_id = \?/g,
    replacement: 'WHERE id = ?'
  },
  {
    name: 'WHERE column = ? AND family_id = ?',
    pattern: /WHERE (\w+) = \? AND family_id = \?/g,
    replacement: 'WHERE $1 = ?'
  },
  {
    name: '(source = ? OR target = ?) AND family_id = ?',
    pattern: /\(source = \? OR target = \?\) AND family_id = \?/g,
    replacement: '(source = ? OR target = ?)'
  }
];

step2Patterns.forEach(({ name, pattern, replacement }) => {
  const matches = content.match(pattern);
  if (matches) {
    content = content.replace(pattern, replacement);
    console.log(`  ${name}: ${matches.length} replacements`);
    totalChanges += matches.length;
  }
});
console.log();

// Step 3: Remove family_id from INSERT statements
console.log('Step 3: Removing family_id from INSERT statements...');
let step3Changes = 0;

// Pattern: INSERT INTO table (..., family_id) VALUES (..., ?)
const insertPattern = /INSERT INTO (\w+) \(((?:[^)]*,\s*)?family_id(?:,\s*[^)]*)?)\) VALUES \(((?:[^)]*,\s*)?(\?|:[a-zA-Z_]+)(?:,\s*[^)]*)?)\)/g;

content = content.replace(insertPattern, (match, table, columns, values) => {
  // Remove family_id from columns
  const newColumns = columns.replace(/,?\s*family_id\s*,?/, '').replace(/,\s*,/, ',').trim();
  
  // Count commas to figure out which ? to remove
  const columnCount = (newColumns.match(/,/g) || []).length + 1;
  const valuesArray = values.split(',').map(v => v.trim());
  
  // Remove last parameter (usually familyId)
  if (valuesArray.length > columnCount) {
    valuesArray.pop();
  }
  
  const newValues = valuesArray.join(', ');
  step3Changes++;
  return `INSERT INTO ${table} (${newColumns}) VALUES (${newValues})`;
});

totalChanges += step3Changes;
console.log(`  Made ${step3Changes} replacements\n`);

// Step 4: Update parameter arrays to remove familyId
console.log('Step 4: Documenting parameter arrays that may need manual review...');
console.log('  (This step requires manual review of each endpoint)\n');

// Step 5: Add familyName extraction where missing
console.log('Step 5: Adding familyName extraction where needed...');
let step5Changes = 0;

const endpointPattern = /app\.(get|post|put|delete)\('\/api\/(?!auth)[^']+',\s*authenticateToken,\s*(?:async\s*)?\([^)]*req[^)]*\)\s*=>\s*\{/g;
let match;
const endpointMatches = [];

while ((match = endpointPattern.exec(content)) !== null) {
  endpointMatches.push({ index: match.index, match: match[0] });
}

// For each endpoint, check if it has familyName
for (const { index, match } of endpointMatches) {
  const endpointStart = index;
  const nextEndpointStart = content.indexOf('\napp.', endpointStart + 1);
  const endpointContent = content.substring(endpointStart, nextEndpointStart > 0 ? nextEndpointStart : content.length);
  
  // Check if this endpoint needs familyDb but doesn't have familyName
  if (!endpointContent.includes('familyName') && !endpointContent.includes('authDb') && endpointContent.includes('db.')) {
    console.log(`  Found endpoint at position ${index} that may need familyName`);
  }
}

console.log();

// Write updated content
fs.writeFileSync(serverPath, content, 'utf8');

console.log('='.repeat(60));
console.log(`Total automated changes: ${totalChanges}`);
console.log('='.repeat(60));
console.log('\nIMPORTANT: Manual review required for:');
console.log('  1. Endpoints that don\'t have familyDb wrapper yet');
console.log('  2. Parameter arrays - remove familyId from end of arrays');
console.log('  3. Cleanup routes - may need special handling');
console.log('  4. Socket.IO events that reference familyId');
console.log('\nSee MIGRATION_GUIDE.js for detailed examples');
