/**
 * Database Architecture Migration Guide
 * =====================================
 * 
 * This guide explains how to update endpoints in server.js to use the new
 * multi-database architecture.
 * 
 * OLD ARCHITECTURE:
 * - Single database (ancestree.db)
 * - All tables include family_id column
 * - Queries filter by family_id: WHERE family_id = ?
 * 
 * NEW ARCHITECTURE:
 * - Auth database (database_auth.db) - contains users table only
 * - Family databases (database_family_<name>.db) - one per family
 * - No family_id column needed (each family has separate DB)
 * - Queries don't need family_id filtering
 * 
 * STEP-BY-STEP MIGRATION FOR EACH ENDPOINT:
 * ==========================================
 * 
 * 1. AUTH ENDPOINTS (login, register, status, verify)
 *    - Use: authDb
 *    - No changes to SQL needed
 *    - Example:
 *      OLD: db.get('SELECT * FROM users WHERE family_name = ?', ...)
 *      NEW: authDb.get('SELECT * FROM users WHERE family_name = ?', ...)
 * 
 * 2. FAMILY DATA ENDPOINTS (nodes, edges, images, etc.)
 *    - Use: getFamilyDb(familyName)
 *    - Remove family_id from:
 *      a) Column lists in INSERT
 *      b) WHERE clauses
 *      c) Parameter arrays
 *    
 *    EXAMPLE 1 - GET endpoint:
 *    OLD:
 *      app.get('/api/nodes', authenticateToken, (req, res) => {
 *        const familyId = req.user.id;
 *        db.all("SELECT * FROM nodes WHERE family_id = ?", [familyId], (err, rows) => {
 *          // ...
 *        });
 *      });
 *    
 *    NEW:
 *      app.get('/api/nodes', authenticateToken, (req, res) => {
 *        const familyName = req.user.familyName;
 *        try {
 *          const familyDb = getFamilyDb(familyName);
 *          familyDb.all("SELECT * FROM nodes", [], (err, rows) => {
 *            // ...
 *          });
 *        } catch (error) {
 *          res.status(500).json({ error: 'Failed to get nodes' });
 *        }
 *      });
 *    
 *    EXAMPLE 2 - POST endpoint:
 *    OLD:
 *      app.post('/api/nodes', authenticateToken, (req, res) => {
 *        const familyId = req.user.id;
 *        db.run(`INSERT INTO nodes (..., family_id) VALUES (..., ?)`,
 *          [...values, familyId], (err) => { ... });
 *      });
 *    
 *    NEW:
 *      app.post('/api/nodes', authenticateToken, (req, res) => {
 *        const familyName = req.user.familyName;
 *        try {
 *          const familyDb = getFamilyDb(familyName);
 *          familyDb.run(`INSERT INTO nodes (...) VALUES (...)`,
 *            [...values], (err) => { ... });
 *        } catch (error) {
 *          res.status(500).json({ error: 'Failed to create node' });
 *        }
 *      });
 *    
 *    EXAMPLE 3 - UPDATE endpoint:
 *    OLD:
 *      app.put('/api/nodes/:id', authenticateToken, (req, res) => {
 *        const { id } = req.params;
 *        const familyId = req.user.id;
 *        db.run(`UPDATE nodes SET ... WHERE id = ? AND family_id = ?`,
 *          [...values, id, familyId], (err) => { ... });
 *      });
 *    
 *    NEW:
 *      app.put('/api/nodes/:id', authenticateToken, (req, res) => {
 *        const { id } = req.params;
 *        const familyName = req.user.familyName;
 *        try {
 *          const familyDb = getFamilyDb(familyName);
 *          familyDb.run(`UPDATE nodes SET ... WHERE id = ?`,
 *            [...values, id], (err) => { ... });
 *        } catch (error) {
 *          res.status(500).json({ error: 'Failed to update node' });
 *        }
 *      });
 *    
 *    EXAMPLE 4 - DELETE endpoint:
 *    OLD:
 *      app.delete('/api/nodes/:id', authenticateToken, (req, res) => {
 *        const { id } = req.params;
 *        const familyId = req.user.id;
 *        db.run("DELETE FROM nodes WHERE id = ? AND family_id = ?",
 *          [id, familyId], (err) => { ... });
 *      });
 *    
 *    NEW:
 *      app.delete('/api/nodes/:id', authenticateToken, (req, res) => {
 *        const { id } = req.params;
 *        const familyName = req.user.familyName;
 *        try {
 *          const familyDb = getFamilyDb(familyName);
 *          familyDb.run("DELETE FROM nodes WHERE id = ?",
 *            [id], (err) => { ... });
 *        } catch (error) {
 *          res.status(500).json({ error: 'Failed to delete node' });
 *        }
 *      });
 * 
 * 3. CLEANUP/MAINTENANCE ROUTES
 *    - These need special handling if they operate across all families
 *    - Option A: Run on all family databases using getFamilyDbById
 *    - Option B: Make family-specific (add authenticateToken)
 *    
 *    EXAMPLE - Family-specific cleanup:
 *    OLD:
 *      app.post('/api/cleanup/duplicateEdges', (req, res) => {
 *        db.run(`DELETE FROM edges WHERE...`, (err) => { ... });
 *      });
 *    
 *    NEW:
 *      app.post('/api/cleanup/duplicateEdges', authenticateToken, (req, res) => {
 *        const familyName = req.user.familyName;
 *        try {
 *          const familyDb = getFamilyDb(familyName);
 *          familyDb.run(`DELETE FROM edges WHERE...`, (err) => { ... });
 *        } catch (error) {
 *          res.status(500).json({ error: 'Cleanup failed' });
 *        }
 *      });
 * 
 * COMMON PATTERNS TO REPLACE:
 * ===========================
 * 
 * 1. Remove "AND family_id = ?" from WHERE clauses
 *    OLD: WHERE id = ? AND family_id = ?
 *    NEW: WHERE id = ?
 * 
 * 2. Remove "family_id" from INSERT column lists and VALUES
 *    OLD: INSERT INTO nodes (id, name, family_id) VALUES (?, ?, ?)
 *    NEW: INSERT INTO nodes (id, name) VALUES (?, ?)
 * 
 * 3. Remove familyId from parameter arrays
 *    OLD: [id, name, familyId]
 *    NEW: [id, name]
 * 
 * 4. Get familyName instead of familyId
 *    OLD: const familyId = req.user.id;
 *    NEW: const familyName = req.user.familyName;
 * 
 * 5. Wrap database operations in try-catch
 *    try {
 *      const familyDb = getFamilyDb(familyName);
 *      // database operations
 *    } catch (error) {
 *      res.status(500).json({ error: 'Operation failed' });
 *    }
 * 
 * TESTING CHECKLIST:
 * ==================
 * [ ] Run migration script: node migrate-database.js
 * [ ] Test login with existing user
 * [ ] Test registration of new user
 * [ ] Test GET /api/nodes
 * [ ] Test GET /api/edges
 * [ ] Test POST /api/nodes (create)
 * [ ] Test PUT /api/nodes/:id (update)
 * [ ] Test DELETE /api/nodes/:id
 * [ ] Test image upload
 * [ ] Test image operations
 * [ ] Test chat messages
 * [ ] Verify family isolation (can't see other family's data)
 * [ ] Test Socket.IO real-time updates
 * [ ] Test cleanup routes
 */

// Helper function template for wrapping endpoints:
function wrapWithFamilyDb(handler) {
  return (req, res) => {
    const familyName = req.user.familyName;
    try {
      const familyDb = getFamilyDb(familyName);
      handler(req, res, familyDb);
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ error: 'Database operation failed' });
    }
  };
}

// Example usage:
// app.get('/api/nodes', authenticateToken, wrapWithFamilyDb((req, res, familyDb) => {
//   familyDb.all("SELECT * FROM nodes", [], (err, rows) => {
//     if (err) return res.status(500).json({ error: err.message });
//     res.json(rows);
//   });
// }));

module.exports = { wrapWithFamilyDb };
