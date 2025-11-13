# Database Architecture Migration Summary

## What Has Been Completed

### 1. New Database Architecture (✅ Complete)
**File: `database.js`**
- Created separation between auth database and family-specific databases
- Auth database (`database_auth.db`): Contains only the `users` table
- Family databases (`database_family_<family-name>.db`): One database per family containing:
  - nodes
  - edges  
  - images
  - image_people
  - chat_messages
- Implemented helper functions:
  - `authDb`: Connection to auth database
  - `getFamilyDb(familyName)`: Get/create family database connection
  - `getFamilyDbById(familyId, callback)`: Get family DB by ID
  - `closeAllFamilyDatabases()`: Cleanup function
  - `initializeAuthDb()`: Initialize auth DB schema
  - `initializeFamilyDb(familyDb)`: Initialize family DB schema

### 2. Data Migration (✅ Complete)
**File: `migrate-database.js`**
- Successfully migrated all existing data from monolithic `ancestree.db`
- Created `database_auth.db` with 7 users
- Created 7 family-specific databases:
  - database_family_Inntertal.db (82 nodes, 87 edges)
  - database_family_TestFamily.db (1 node, 0 edges)
  - database_family_AnotherFamily.db (1 node, 0 edges)
  - database_family_EncryptedFamily.db (5 nodes, 4 edges)
  - database_family_Walther.db (9 nodes, 10 edges)
  - database_family_Innertal.db (25 nodes, 30 edges)
  - database_family_test123.db (29 nodes, 30 edges, 7 images, 9 image_people, 9 chat messages)
- All images, image_people associations, and chat messages migrated correctly

### 3. Server.js Partial Updates (⚠️ Partially Complete)
**Updated Endpoints:**
- ✅ Database import: Changed from `db` to `authDb, getFamilyDb, getFamilyDbById`
- ✅ POST `/api/auth/login`: Uses `authDb`
- ✅ POST `/api/auth/register`: Uses `authDb`
- ✅ GET `/api/auth/status`: Uses `authDb`
- ✅ GET `/api/nodes`: Uses `getFamilyDb(familyName)`, removed family_id filtering
- ✅ GET `/api/edges`: Uses `getFamilyDb(familyName)`, removed family_id filtering
- ✅ POST `/api/nodes`: Uses `getFamilyDb(familyName)`, removed family_id from INSERT
- ✅ PUT `/api/nodes/:id`: Uses `getFamilyDb(familyName)`, removed family_id from WHERE
- ⚠️ Automated script removed 12 instances of `AND family_id = ?` from WHERE clauses

### 4. Documentation and Tools (✅ Complete)
- **MIGRATION_GUIDE.js**: Comprehensive guide with examples for each endpoint type
- **auto-update-server.js**: Automated script that made initial bulk updates
- **update-server-db.js**: Helper script for pattern-based updates

## What Remains To Be Done

### Endpoints Requiring Manual Updates

Based on the automated analysis, these 14 endpoints still need updates:

1. **DELETE `/api/nodes/:id`** - Delete node endpoint
2. **POST `/api/edges`** - Create edge endpoint  
3. **DELETE `/api/edges/:id`** - Delete edge endpoint
4. **PUT `/api/edges/:id`** - Update edge endpoint
5. **DELETE `/api/clear-all`** - Clear all data endpoint
6. **POST `/api/cleanup/*`** - Various cleanup routes (8 endpoints):
   - `/api/cleanup/nullNodes`
   - `/api/cleanup/nullEdges`
   - `/api/cleanup/invalidEdges`
   - `/api/cleanup/selfLoopEdges`
   - `/api/cleanup/duplicateEdges`
   - `/api/cleanup/orphanedImagePeople`
   - `/api/cleanup/orphanedImagePersons`
   - `/api/cleanup/orphanedPreferredImages`
7. **Image Endpoints** - Several image-related endpoints:
   - POST `/api/images/upload`
   - GET `/api/images`
   - GET `/api/images/:id`
   - POST `/api/images/:imageId/people`
   - DELETE `/api/images/:imageId/people/:personId`
   - PUT `/api/images/:imageId/people/:personId`
   - PUT `/api/images/:imageId/description`
   - DELETE `/api/images/:id`
   - GET `/api/persons/:personId/images`
   - GET `/api/images/:imageId/chat`
8. **Chat Endpoints**:
   - POST `/api/images/:imageId/chat`
   - DELETE `/api/images/:imageId/chat/:messageId`

### Required Changes for Each Endpoint

For each of the above endpoints, you need to:

1. **Add family database access:**
   ```javascript
   const familyName = req.user.familyName;
   try {
     const familyDb = getFamilyDb(familyName);
     // ... database operations
   } catch (error) {
     res.status(500).json({ error: 'Operation failed' });
   }
   ```

2. **Replace `db.` with `familyDb.`:**
   ```javascript
   // OLD: db.run(...)
   // NEW: familyDb.run(...)
   ```

3. **Remove `family_id` from SQL queries:**
   - Remove from INSERT column lists and VALUES
   - Remove `AND family_id = ?` from WHERE clauses
   - Remove `familyId` from parameter arrays

4. **Example transformation:**
   ```javascript
   // OLD:
   app.delete('/api/nodes/:id', authenticateToken, (req, res) => {
     const { id } = req.params;
     const familyId = req.user.id;
     db.run("DELETE FROM nodes WHERE id = ? AND family_id = ?", [id, familyId], ...);
   });
   
   // NEW:
   app.delete('/api/nodes/:id', authenticateToken, (req, res) => {
     const { id } = req.params;
     const familyName = req.user.familyName;
     try {
       const familyDb = getFamilyDb(familyName);
       familyDb.run("DELETE FROM nodes WHERE id = ?", [id], ...);
     } catch (error) {
       res.status(500).json({ error: 'Failed to delete node' });
     }
   });
   ```

### Special Cases

#### Cleanup Routes
These routes may need special consideration:
- **Option A**: Make them family-specific by adding `authenticateToken` middleware
- **Option B**: Iterate over all family databases (use `authDb` to get all families, then operate on each family DB)

#### Socket.IO Events
Check all Socket.IO event emissions that reference `familyId`:
- Verify they use `familyId` for room names (this is OK)
- Ensure they don't try to query cross-family data

## Testing Plan

Once all endpoints are updated:

1. **Start the server**: `npm start` or `node server.js`
2. **Test authentication**:
   - Login with existing user
   - Register new user
   - Verify token generation
3. **Test family data isolation**:
   - Login as Family A, verify you only see Family A's data
   - Login as Family B, verify you only see Family B's data
   - Try to access Family A's data while authenticated as Family B (should fail)
4. **Test CRUD operations**:
   - Create, read, update, delete nodes
   - Create, read, update, delete edges
   - Upload and manage images
   - Add people to images
   - Send chat messages
5. **Test Socket.IO**:
   - Open two browser windows with same family
   - Verify real-time updates work
   - Ensure updates don't leak to other families
6. **Test cleanup routes**:
   - Run each cleanup endpoint
   - Verify data integrity after cleanup

## Benefits of New Architecture

✅ **Better Isolation**: Each family's data is completely separated
✅ **Improved Security**: No risk of cross-family data leaks
✅ **Better Performance**: Smaller databases, faster queries
✅ **Easier Backup**: Can backup individual family databases
✅ **Scalability**: Easy to move individual families to different servers
✅ **Simpler Queries**: No need to filter by family_id everywhere

## Rollback Plan

If issues arise:
1. Stop the new server
2. Rename `ancestree.db.backup` back to `ancestree.db` (if you backed it up)
3. Or keep the old database.js and server.js versions
4. The new databases are separate files, so no data is lost

## Files Modified

- ✅ `ancestree-backend/database.js` - Completely rewritten
- ⚠️ `ancestree-backend/server.js` - Partially updated (needs completion)

## New Files Created

- ✅ `ancestree-backend/migrate-database.js` - Migration script
- ✅ `ancestree-backend/MIGRATION_GUIDE.js` - Detailed migration guide
- ✅ `ancestree-backend/auto-update-server.js` - Automated update script  
- ✅ `ancestree-backend/update-server-db.js` - Pattern-based update helper

## Next Steps

1. **Complete server.js updates** for the remaining 14+ endpoints using MIGRATION_GUIDE.js as reference
2. **Test thoroughly** following the testing plan above
3. **Backup old database** before fully switching to new architecture
4. **Monitor logs** for any database errors after deployment

## Database Schema Changes

### Removed from all tables:
- `family_id` column (no longer needed with per-family databases)
- Foreign key references to `users(id)` 

### Unchanged:
- All other columns remain the same
- All relationships between tables within a family database remain intact
