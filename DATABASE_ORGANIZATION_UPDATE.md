# Database Organization Update

## Changes Made

All database files have been moved from the root of `ancestree-backend/` to a dedicated `ancestree-backend/databases/` folder for better organization.

## Files Moved

### Database Files
- `database_auth.db` → `databases/database_auth.db`
- `database_family_*.db` → `databases/database_family_*.db` (8 family databases)
- `ancestree.db` → `databases/ancestree.db` (legacy/backup)
- `ancestreebackup.db` → `databases/ancestreebackup.db` (backup)

## Code Updates

### 1. database.js
Updated paths to use the `databases/` subdirectory:
```javascript
// Before:
const authDbPath = path.join(__dirname, 'database_auth.db');
const familyDbPath = path.join(__dirname, `database_family_${familyName}.db`);

// After:
const authDbPath = path.join(__dirname, 'databases', 'database_auth.db');
const familyDbPath = path.join(__dirname, 'databases', `database_family_${familyName}.db`);
```

### 2. server.js
Updated cleanup function to read from `databases/` folder:
```javascript
// Before:
const familyDbFiles = fs.readdirSync(__dirname)

// After:
const databasesPath = path.join(__dirname, 'databases');
const familyDbFiles = fs.readdirSync(databasesPath)
```

### 3. migrate-database.js
Updated paths for future reference:
```javascript
// Before:
const oldDbPath = path.join(__dirname, 'ancestree.db');
const authDbPath = path.join(__dirname, 'database_auth.db');

// After:
const oldDbPath = path.join(__dirname, 'databases', 'ancestree.db');
const authDbPath = path.join(__dirname, 'databases', 'database_auth.db');
```

## Benefits

1. **Better Organization**: All database files are now in one dedicated folder
2. **Cleaner Root Directory**: Backend root directory is less cluttered
3. **Easier Backups**: Single folder to backup all databases
4. **Clearer Structure**: Obvious where database files are located
5. **Standard Practice**: Follows common Node.js project organization patterns

## Directory Structure

```
ancestree-backend/
├── databases/              # NEW: All database files
│   ├── README.md          # Database documentation
│   ├── database_auth.db
│   ├── database_family_*.db (multiple files)
│   ├── ancestree.db       (legacy)
│   └── ancestreebackup.db (backup)
├── logs/
├── node_modules/
├── database.js
├── server.js
└── ...other files
```

## Testing

After making these changes:
1. ✅ No compilation errors in database.js or server.js
2. ✅ All paths updated to use `databases/` subdirectory
3. ✅ Database files successfully moved
4. ✅ Documentation updated

## Next Steps

1. Start the server: `node server.js`
2. Verify authentication works
3. Test CRUD operations for nodes/edges
4. Verify cleanup functions work correctly
5. Check that all family databases are accessible

## Rollback (if needed)

If issues arise, move databases back to root:
```bash
cd ancestree-backend
mv databases/*.db .
```

Then revert the code changes in database.js, server.js, and migrate-database.js.

## Notes

- The `fs` module import was added to server.js to support reading directory contents
- All database access patterns remain the same (via `getFamilyDb()` function)
- No changes required to API endpoints or frontend code
- Database connections are still cached in memory for performance
