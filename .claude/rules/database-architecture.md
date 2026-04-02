---
paths:
  - "ancestree-backend/database.js"
  - "ancestree-backend/databases/**"
---

# Database Architecture

Per-family SQLite isolation. All DB files in `ancestree-backend/databases/`.

## Multi-Database Pattern

- `database_auth.db` — central authentication (shared across all families)
- `database_family_[familyName].db` — one per family, complete data isolation

**Connection management (`database.js`):**
- `familyDatabases` Map caches open SQLite connections
- `getFamilyDb(familyName)` — creates/caches connection, initializes schema on first access
- `getFamilyDbById(familyId, callback)` — looks up family_name from auth DB, then gets family DB
- `closeFamilyDatabase(familyName, callback)` — close + remove from cache
- `closeAllFamilyDatabases()` — close all cached connections

## Auth DB Schema (`database_auth.db`)

### `users` table
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| family_name | TEXT NOT NULL UNIQUE | Used as DB filename suffix |
| display_name | TEXT | UI display name |
| password_hash | TEXT NOT NULL | bcrypt hash |
| admin_password_hash | TEXT | Separate admin password |
| purpose | TEXT | Family tree purpose description |
| encryption_enabled | BOOLEAN DEFAULT 1 | |
| encryption_salt | TEXT | Per-family PBKDF2 salt |
| show_street_fields | BOOLEAN DEFAULT 1 | UI field visibility toggle |
| show_phone_field | BOOLEAN DEFAULT 1 | UI field visibility toggle |
| show_email_field | BOOLEAN DEFAULT 1 | UI field visibility toggle |
| node_creation_locked | BOOLEAN DEFAULT 0 | Lock node creation for non-admin |
| terms_accepted_at | DATETIME | |
| terms_version | TEXT | |
| last_accessed | DATETIME | |
| deleted_at | DATETIME | Soft delete timestamp |
| deletion_source | TEXT | 'user', 'server', or 'admin' |
| s3_images_migrated | BOOLEAN DEFAULT 0 | S3 migration flag |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP | |

### `terms` table
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| version | TEXT NOT NULL UNIQUE | e.g. 'beta-1.0' |
| release_date | DATETIME NOT NULL | |
| content | TEXT | |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | |

## Family DB Schema (`database_family_[name].db`)

### `nodes` table (people)
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| type | TEXT NOT NULL | 'person' or 'family' |
| position_x | REAL NOT NULL | ReactFlow X coordinate |
| position_y | REAL NOT NULL | ReactFlow Y coordinate |
| name | TEXT | Encrypted when enabled |
| surname | TEXT | Encrypted |
| maiden_name | TEXT | Encrypted |
| birth_date | TEXT | Encrypted |
| death_date | TEXT | Encrypted |
| street | TEXT | Encrypted |
| housenumber | TEXT | Encrypted |
| city | TEXT | Encrypted |
| zip | TEXT | Encrypted |
| country | TEXT | Encrypted |
| phone | TEXT | Encrypted |
| email | TEXT | Encrypted |
| bloodline | BOOLEAN DEFAULT 1 | True=bloodline member, False=partner node |
| latitude | REAL | Encrypted (stored as string when encrypted) |
| longitude | REAL | Encrypted (stored as string when encrypted) |
| address_hash | TEXT | Encrypted |
| last_geocoded | DATETIME | Encrypted |
| has_tagged_image | BOOLEAN DEFAULT 0 | Denormalized from image_people |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP | |

### `edges` table (relationships)
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| source | TEXT NOT NULL | FK → nodes(id) ON DELETE CASCADE |
| target | TEXT NOT NULL | FK → nodes(id) ON DELETE CASCADE |
| source_handle | TEXT | Encrypted. Handle ID on source node |
| target_handle | TEXT | Encrypted. Handle ID on target node |
| type | TEXT NOT NULL | Encrypted. 'partner', 'expartner', 'bloodline', 'bloodlinehidden', 'bloodlinefake' |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | |

### `images` table
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| filename | TEXT NOT NULL | Encrypted. Sanitized filename |
| original_filename | TEXT NOT NULL | Encrypted. Original upload name |
| s3_key | TEXT NOT NULL | Encrypted. S3 object key |
| s3_url | TEXT NOT NULL | Encrypted. S3 URL (gets stale) |
| description | TEXT | Encrypted. Max 1000 chars |
| upload_date | DATETIME DEFAULT CURRENT_TIMESTAMP | Encrypted |
| file_size | INTEGER | Encrypted |
| mime_type | TEXT | Encrypted |
| uploaded_by | TEXT | Encrypted |
| has_open_questions | BOOLEAN DEFAULT 0 | |
| thumbnail_s3_key | TEXT | Encrypted |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP | |

### `image_people` table (many-to-many, person tags on images)
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| image_id | TEXT NOT NULL | FK → images(id) ON DELETE CASCADE |
| person_id | TEXT NOT NULL | FK → nodes(id) ON DELETE CASCADE |
| position_x | REAL | Encrypted. Tag position on image |
| position_y | REAL | Encrypted |
| width | REAL | Encrypted. Tag box size |
| height | REAL | Encrypted |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | |
| | | UNIQUE(image_id, person_id) |

### `chat_messages` table
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| image_id | TEXT NOT NULL | FK → images(id) ON DELETE CASCADE |
| user_name | TEXT NOT NULL | Encrypted |
| message | TEXT NOT NULL | Encrypted. Max 300 chars |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | Encrypted |

### `admin` table (KV store for UI settings)
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| key | TEXT NOT NULL UNIQUE | e.g. 'display_name', 'purpose' |
| value | TEXT | Encrypted when encryption enabled |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP | |

### `completion_settings` table (single-row config)
| Column | Type | Default |
|--------|------|---------|
| id | INTEGER PK AUTOINCREMENT | |
| show_missing_required | BOOLEAN | 0 |
| require_name | BOOLEAN | 1 |
| require_surname | BOOLEAN | 1 |
| require_maiden_name | BOOLEAN | 1 |
| require_birth_date | BOOLEAN | 1 |
| require_street_fields | BOOLEAN | 1 |
| require_city_zip | BOOLEAN | 1 |
| require_country | BOOLEAN | 1 |
| require_phone | BOOLEAN | 1 |
| require_email | BOOLEAN | 1 |
| require_tagged_image | BOOLEAN | 1 |

## Migration Pattern

No migration framework. Uses inline checks at startup:
```javascript
familyDb.all("PRAGMA table_info(tableName)", (err, columns) => {
  const columnNames = columns.map(col => col.name);
  if (!columnNames.includes('new_column')) {
    familyDb.run("ALTER TABLE tableName ADD COLUMN new_column TYPE DEFAULT value");
  }
});
```

When adding new columns:
1. Add to CREATE TABLE statement (for new DBs)
2. Add PRAGMA check + ALTER TABLE (for existing DBs)
3. Always provide DEFAULT values
4. If column is for encrypted data, also update `encryptionFieldDefinitions.js`

## Soft Delete

Users table has `deleted_at` and `deletion_source`:
- User-initiated: 10-day grace period before permanent deletion
- Server-initiated: 1-day grace period
- Permanent deletion removes: family DB file, all S3 images, user row from auth DB

## Cleanup Routines (in `server.js`)

- `cleanupNullKeys()` — removes rows with null id/source/target and self-referencing edges across all family DBs
- `cleanupDuplicateEdges(familyDb, familyName)` — CTE to find same-endpoint-same-type duplicates, keeps highest priority (bloodline > bloodlinehidden > bloodlinefake > partner)
- `cleanupOrphanedImageReferences()` — removes image_people entries referencing nonexistent images or nodes
- Available manually via `POST /api/cleanup`

## Startup Routines

- `initializeAuthDb()` — creates tables + runs all migrations
- `initializeFamilyDb(familyDb)` — creates tables + runs all migrations for a family
- `ensureFamilyHasNodes(familyId)` — inserts default node if family has zero nodes
- All families checked on server start
