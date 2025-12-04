# Database Files Directory

This directory contains all SQLite database files for the Ancestree application.

## Database Files

### Authentication Database
- **database_auth.db** - Contains the `users` table for authentication
  - Stores user credentials (username, password hash)
  - Links users to their family name

### Family Databases
- **database_family_<family-name>.db** - One database per family
  - Each family has its own isolated database
  - Contains: `nodes`, `edges`, `images`, `image_people`, `chat_messages` tables
  - No `family_id` column needed (inherent separation by file)

### Backup/Legacy Databases
- **ancestree.db** - Original monolithic database (for rollback)
- **ancestreebackup.db** - Backup of the original database

## Database Schema

### database_auth.db
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  family_name TEXT NOT NULL,
  password TEXT NOT NULL
);
```

### database_family_<name>.db
```sql
-- Person/Entity nodes
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  position_x REAL DEFAULT 0,
  position_y REAL DEFAULT 0,
  name TEXT,
  surname TEXT,
  birth_date TEXT,
  birth_location TEXT,
  death_date TEXT,
  death_location TEXT,
  notes TEXT
);

-- Relationships between nodes
CREATE TABLE edges (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  source_handle TEXT,
  target_handle TEXT,
  type TEXT NOT NULL
);

-- Image storage references (S3)
CREATE TABLE images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  s3_url TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Many-to-many relationship: images to people
CREATE TABLE image_people (
  image_id INTEGER NOT NULL,
  person_id TEXT NOT NULL,
  PRIMARY KEY (image_id, person_id),
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES nodes(id) ON DELETE CASCADE
);

-- Chat messages on images
CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
);
```

## Access Patterns

### Authentication
- Use `authDb` from `database.js` module
- Direct access to authentication database

### Family Data
- Use `getFamilyDb(familyName)` function
- Automatically creates database if it doesn't exist
- Connections are cached for performance

## Backup Strategy

1. **Regular Backups**: Back up this entire directory regularly
2. **Per-Family Backups**: Individual family databases can be backed up separately
3. **Migration Safety**: Keep `ancestreebackup.db` for rollback capability

## File Permissions

Ensure appropriate file permissions:
```bash
chmod 644 *.db  # Read/write for owner, read for group/others
```

## Database Maintenance

- Automatic cleanup runs every 5 minutes via `cleanupNullKeys()` function
- Manual cleanup available via `POST /api/cleanup` endpoint
- Cleanup operations:
  - Remove null key entries
  - Remove self-loop edges
  - Remove duplicate edges
  - Remove orphaned image references

## Migration History

- **Initial**: Single `ancestree.db` with all data
- **November 2025**: Split into auth + per-family databases
- **Location**: Moved all databases to `databases/` subdirectory for organization
