const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');

const app = express();
const PORT = 3001;

// Cleanup routine to remove items with null keys
function cleanupNullKeys() {
  console.log('Running cleanup routine for null keys...');
  
  // Remove nodes with null id
  db.run("DELETE FROM nodes WHERE id IS NULL", function(err) {
    if (err) {
      console.error('Error cleaning up nodes with null keys:', err.message);
    } else if (this.changes > 0) {
      console.log(`Cleaned up ${this.changes} nodes with null keys`);
    }
  });
  
  // Remove edges with null id
  db.run("DELETE FROM edges WHERE id IS NULL", function(err) {
    if (err) {
      console.error('Error cleaning up edges with null keys:', err.message);
    } else if (this.changes > 0) {
      console.log(`Cleaned up ${this.changes} edges with null keys`);
    }
  });
  
  // Also clean up edges with null source or target references
  db.run("DELETE FROM edges WHERE source IS NULL OR target IS NULL", function(err) {
    if (err) {
      console.error('Error cleaning up edges with null references:', err.message);
    } else if (this.changes > 0) {
      console.log(`Cleaned up ${this.changes} edges with null references`);
    }
  });
}

// Run cleanup every 5 minutes (300000 ms)
const CLEANUP_INTERVAL = 60 * 1000 * 5; // 5 minutes
setInterval(cleanupNullKeys, CLEANUP_INTERVAL);

// Run initial cleanup on server start
setTimeout(cleanupNullKeys, 5000); // Wait 5 seconds after server start

app.use(cors());
app.use(bodyParser.json());

// Get all nodes
app.get('/api/nodes', (req, res) => {
  db.all("SELECT * FROM nodes", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const nodes = rows.map(row => ({
      id: row.id,
      type: row.type,
      position: { x: row.position_x, y: row.position_y },
      data: {
        name: row.name,
        surname: row.surname,
        birthDate: row.birth_date,
        deathDate: row.death_date,
        street: row.street,
        city: row.city,
        zip: row.zip,
        country: row.country,
        phone: row.phone,
        gender: row.gender,
        bloodline: Boolean(row.bloodline),
        isSelected: false
      }
    }));
    
    res.json(nodes);
  });
});

// Get all edges
app.get('/api/edges', (req, res) => {
  db.all("SELECT * FROM edges", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const edges = rows.map(row => ({
      id: row.id,
      source: row.source,
      target: row.target,
      sourceHandle: row.source_handle,
      targetHandle: row.target_handle,
      type: row.type
    }));
    
    res.json(edges);
  });
});

// Create new node
app.post('/api/nodes', (req, res) => {
  const { id, type, position, data } = req.body;
  
  db.run(`INSERT INTO nodes (
    id, type, position_x, position_y, name, surname, birth_date, death_date,
    street, city, zip, country, phone, gender, bloodline
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, type, position.x, position.y, data.name, data.surname, data.birthDate,
    data.deathDate, data.street, data.city, data.zip, data.country, data.phone, data.gender,
    data.bloodline ? 1 : 0
  ], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, id: this.lastID });
  });
});

// Update node
app.put('/api/nodes/:id', (req, res) => {
  const { id } = req.params;
  const { position, data } = req.body;
  
  db.run(`UPDATE nodes SET 
    position_x = ?, position_y = ?, name = ?, surname = ?, birth_date = ?,
    death_date = ?, street = ?, city = ?, zip = ?, country = ?, phone = ?, gender = ?,
    bloodline = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`, [
    position?.x, position?.y, data.name, data.surname, data.birthDate,
    data.deathDate, data.street, data.city, data.zip, data.country, data.phone, data.gender,
    data.bloodline ? 1 : 0, id
  ], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, changes: this.changes });
  });
});

// Delete node
app.delete('/api/nodes/:id', (req, res) => {
  const { id } = req.params;
  
  // First delete all edges connected to this node
  db.run("DELETE FROM edges WHERE source = ? OR target = ?", [id, id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Then delete the node
    db.run("DELETE FROM nodes WHERE id = ?", [id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true, changes: this.changes });
    });
  });
});

// Create new edge
app.post('/api/edges', (req, res) => {
  const { id, source, target, sourceHandle, targetHandle, type } = req.body;
  
  db.run(`INSERT INTO edges (id, source, target, source_handle, target_handle, type)
    VALUES (?, ?, ?, ?, ?, ?)`, [id, source, target, sourceHandle, targetHandle, type], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, id: this.lastID });
  });
});

// Delete edge
app.delete('/api/edges/:id', (req, res) => {
  const { id } = req.params;
  
  db.run("DELETE FROM edges WHERE id = ?", [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, changes: this.changes });
  });
});

// Reset database (clear all data)
app.post('/api/reset', (req, res) => {
  db.serialize(() => {
    // Clear all existing data
    db.run("DELETE FROM edges", (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
    });
    
    db.run("DELETE FROM nodes", (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({ success: true, message: "Database reset successfully" });
    });
  });
});

// Manual cleanup endpoint
app.post('/api/cleanup', (req, res) => {
  let totalCleaned = 0;
  let operations = 0;
  const maxOperations = 3;
  
  function checkComplete() {
    operations++;
    if (operations === maxOperations) {
      res.json({ 
        success: true, 
        message: `Cleanup completed. Removed ${totalCleaned} items with null keys.`,
        itemsRemoved: totalCleaned
      });
    }
  }
  
  // Remove nodes with null id
  db.run("DELETE FROM nodes WHERE id IS NULL", function(err) {
    if (err) {
      res.status(500).json({ error: 'Error cleaning nodes: ' + err.message });
      return;
    }
    totalCleaned += this.changes;
    checkComplete();
  });
  
  // Remove edges with null id
  db.run("DELETE FROM edges WHERE id IS NULL", function(err) {
    if (err) {
      res.status(500).json({ error: 'Error cleaning edges: ' + err.message });
      return;
    }
    totalCleaned += this.changes;
    checkComplete();
  });
  
  // Remove edges with null source or target references
  db.run("DELETE FROM edges WHERE source IS NULL OR target IS NULL", function(err) {
    if (err) {
      res.status(500).json({ error: 'Error cleaning edge references: ' + err.message });
      return;
    }
    totalCleaned += this.changes;
    checkComplete();
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});