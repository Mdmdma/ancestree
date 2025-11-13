# Quick Reference: Completing Remaining Endpoints

## Copy-Paste Template for Each Endpoint

### For Image Endpoints

```javascript
// Example: GET /api/images
app.get('/api/images', authenticateToken, (req, res) => {
  const familyName = req.user.familyName;
  
  try {
    const familyDb = getFamilyDb(familyName);
    familyDb.all(`SELECT i.*, 
      (SELECT COUNT(*) FROM image_people ip WHERE ip.image_id = i.id) as person_count
      FROM images i
      ORDER BY i.created_at DESC`, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  } catch (error) {
    console.error('Error getting images:', error);
    res.status(500).json({ error: 'Failed to get images' });
  }
});
```

### For Chat Endpoints

```javascript
// Example: POST /api/images/:imageId/chat
app.post('/api/images/:imageId/chat', authenticateToken, (req, res) => {
  const { imageId } = req.params;
  const { userName, message } = req.body;
  const familyId = req.user.id;
  const familyName = req.user.familyName;
  
  try {
    const familyDb = getFamilyDb(familyName);
    
    // Verify image exists
    familyDb.get('SELECT id FROM images WHERE id = ?', [imageId], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Image not found' });
      
      const query = `INSERT INTO chat_messages (image_id, user_name, message) VALUES (?, ?, ?)`;
      
      familyDb.run(query, [imageId, userName.trim(), message.trim()], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        const newMessage = {
          id: this.lastID,
          imageId,
          userName: userName.trim(),
          message: message.trim(),
          createdAt: new Date().toISOString()
        };
        
        // Broadcast to room
        req.app.get('io').to(`family-${familyId}`).emit('chat:message', newMessage);
        
        res.status(201).json(newMessage);
      });
    });
  } catch (error) {
    console.error('Error posting chat message:', error);
    res.status(500).json({ error: 'Failed to post message' });
  }
});
```

### For Cleanup Endpoints

```javascript
// Example: POST /api/cleanup/duplicateEdges (Family-specific)
app.post('/api/cleanup/duplicateEdges', authenticateToken, (req, res) => {
  const familyName = req.user.familyName;
  
  try {
    const familyDb = getFamilyDb(familyName);
    
    const duplicateQuery = `
      SELECT source, target, type, source_handle, target_handle, COUNT(*) as count, MIN(id) as keep_id
      FROM edges
      GROUP BY source, target, type, source_handle, target_handle
      HAVING count > 1
    `;
    
    familyDb.all(duplicateQuery, (err, duplicateEdges) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (duplicateEdges.length === 0) {
        return res.json({ message: 'No duplicate edges found', deleted: 0 });
      }
      
      let totalDeleted = 0;
      let processed = 0;
      
      duplicateEdges.forEach(dup => {
        // Delete all except the one we're keeping
        familyDb.run(
          `DELETE FROM edges WHERE source = ? AND target = ? AND type = ? 
           AND (source_handle IS ? OR (source_handle IS NULL AND ? IS NULL))
           AND (target_handle IS ? OR (target_handle IS NULL AND ? IS NULL))
           AND id != ?`,
          [dup.source, dup.target, dup.type, dup.source_handle, dup.source_handle,
           dup.target_handle, dup.target_handle, dup.keep_id],
          function(err) {
            if (err) console.error('Error deleting duplicate:', err);
            else totalDeleted += this.changes;
            
            processed++;
            if (processed === duplicateEdges.length) {
              res.json({ 
                message: `Cleaned up ${totalDeleted} duplicate edges`,
                deleted: totalDeleted
              });
            }
          }
        );
      });
    });
  } catch (error) {
    console.error('Error cleaning duplicates:', error);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});
```

## Search and Replace Patterns

Use these in your editor for bulk updates:

### Pattern 1: Add familyName and familyDb
**Find:** `(app\.(get|post|put|delete)\('/api/(?!auth)[^']+', authenticateToken, (?:async )?\([^)]*req[^)]*\) => \{\n(?:.*\n){0,3}?)  const familyId = req\.user\.id;`

**Replace:** `$1  const familyId = req.user.id;\n  const familyName = req.user.familyName;\n  \n  try {\n    const familyDb = getFamilyDb(familyName);`

### Pattern 2: Replace db. with familyDb.
**Find:** `\bdb\.(run|get|all)\(`

**Replace (within non-auth endpoints):** `familyDb.$1(`

### Pattern 3: Remove "AND family_id = ?" from WHERE clauses
**Find:** ` AND family_id = \?`

**Replace:** `` (empty)

### Pattern 4: Remove familyId from arrays at end
**Find:** `, familyId\]`

**Replace:** `]`

## Specific Endpoint Locations (Approximate Line Numbers)

Based on typical server.js structure:

- **Images:**
  - Upload: ~line 1300-1400
  - Get all: ~line 1400-1450
  - Get one: ~line 1450-1500
  - People associations: ~line 1500-1600
  - Description update: ~line 1600-1650
  - Delete: ~line 1650-1700

- **Chat:**
  - Get messages: ~line 1700-1750
  - Post message: ~line 1750-1850
  - Delete message: ~line 1850-1900

- **Cleanup:**
  - Various: ~line 200-400 and/or ~line 1050-1250

## Testing Each Updated Endpoint

```bash
# 1. Start server
cd ancestree-backend
npm start

# 2. Login to get token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"familyName":"TestFamily","password":"yourpassword"}'

# Save the token from response
TOKEN="your-token-here"

# 3. Test GET endpoints
curl http://localhost:3001/api/images \
  -H "Authorization: Bearer $TOKEN"

# 4. Test POST endpoints
curl -X POST http://localhost:3001/api/images/:imageId/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userName":"Test","message":"Hello"}'

# 5. Test PUT endpoints
curl -X PUT http://localhost:3001/api/images/:id/description \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description":"New description"}'

# 6. Test DELETE endpoints
curl -X DELETE http://localhost:3001/api/images/:id \
  -H "Authorization: Bearer $TOKEN"
```

## Common Issues and Solutions

### Issue 1: "familyDb is not defined"
**Cause:** Forgot to add `const familyDb = getFamilyDb(familyName)`
**Fix:** Add at start of endpoint handler

### Issue 2: "Missing catch block"
**Cause:** Added `try {` but forgot closing `} catch (error) { ... }`
**Fix:** Close try-catch properly around all DB operations

### Issue 3: SQL error about family_id
**Cause:** Didn't remove family_id from SQL query
**Fix:** Remove all `family_id` references from WHERE clauses and INSERT statements

### Issue 4: Wrong number of parameters
**Cause:** Removed family_id from SQL but not from parameter array
**Fix:** Count ? in SQL and match array length

### Issue 5: "Family not found" error
**Cause:** familyName is undefined
**Fix:** Ensure JWT token includes familyName (check auth endpoints)

## Verification Checklist Per Endpoint

- [ ] Added `const familyName = req.user.familyName`
- [ ] Added `try { const familyDb = getFamilyDb(familyName); }`
- [ ] Replaced all `db.` with `familyDb.`
- [ ] Removed `family_id` from all SQL queries
- [ ] Removed `familyId` from parameter arrays
- [ ] Added `} catch (error) { ... }` block
- [ ] Tested with curl or browser
- [ ] Verified no errors in server logs
- [ ] Verified data in correct family database

## Time Estimates

- Simple GET endpoint: 2-3 minutes
- Simple POST endpoint: 3-5 minutes
- Complex endpoint with sub-queries: 5-10 minutes
- Cleanup endpoint: 10-15 minutes

**Total remaining: 22 endpoints × 5 min average = ~2 hours**

Good luck! 🚀
