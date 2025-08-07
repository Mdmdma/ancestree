// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const multerS3 = require('multer-s3');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3001;

// Configure AWS S3
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'ancestree-images';

// Configure multer for S3 uploads
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: S3_BUCKET_NAME,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const fileExtension = path.extname(file.originalname);
      const uniqueFileName = `${uuidv4()}${fileExtension}`;
      cb(null, `images/${uniqueFileName}`);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only image files
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

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
  
  // Create edge normally without partner validation
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

// ============= IMAGE ENDPOINTS =============

// Upload image
app.post('/api/images/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  const imageId = uuidv4();
  const imageData = {
    id: imageId,
    filename: req.file.key.split('/').pop(), // Extract filename from S3 key
    original_filename: req.file.originalname,
    s3_key: req.file.key,
    s3_url: req.file.location,
    description: req.body.description || '',
    file_size: req.file.size,
    mime_type: req.file.mimetype,
    uploaded_by: req.body.uploaded_by || 'anonymous'
  };

  db.run(`INSERT INTO images (
    id, filename, original_filename, s3_key, s3_url, description, 
    file_size, mime_type, uploaded_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    imageData.id,
    imageData.filename,
    imageData.original_filename,
    imageData.s3_key,
    imageData.s3_url,
    imageData.description,
    imageData.file_size,
    imageData.mime_type,
    imageData.uploaded_by
  ], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: err.message });
    }

    res.json({
      success: true,
      image: imageData
    });
  });
});

// Get all images
app.get('/api/images', (req, res) => {
  db.all(`SELECT i.*, 
    GROUP_CONCAT(
      json_object(
        'person_id', ip.person_id,
        'person_name', n.name,
        'person_surname', n.surname,
        'position_x', ip.position_x,
        'position_y', ip.position_y,
        'width', ip.width,
        'height', ip.height
      )
    ) as people
    FROM images i
    LEFT JOIN image_people ip ON i.id = ip.image_id
    LEFT JOIN nodes n ON ip.person_id = n.id
    GROUP BY i.id
    ORDER BY i.created_at DESC`, 
  (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const images = rows.map(row => ({
      id: row.id,
      filename: row.filename,
      originalFilename: row.original_filename,
      s3Key: row.s3_key,
      s3Url: row.s3_url,
      description: row.description,
      uploadDate: row.upload_date,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      uploadedBy: row.uploaded_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      people: row.people ? JSON.parse(`[${row.people}]`) : []
    }));

    res.json(images);
  });
});

// Get specific image with people
app.get('/api/images/:id', (req, res) => {
  const imageId = req.params.id;
  
  db.get(`SELECT * FROM images WHERE id = ?`, [imageId], (err, imageRow) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!imageRow) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Get associated people
    db.all(`SELECT ip.*, n.name, n.surname 
            FROM image_people ip 
            JOIN nodes n ON ip.person_id = n.id 
            WHERE ip.image_id = ?`, [imageId], (err, peopleRows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const image = {
        id: imageRow.id,
        filename: imageRow.filename,
        originalFilename: imageRow.original_filename,
        s3Key: imageRow.s3_key,
        s3Url: imageRow.s3_url,
        description: imageRow.description,
        uploadDate: imageRow.upload_date,
        fileSize: imageRow.file_size,
        mimeType: imageRow.mime_type,
        uploadedBy: imageRow.uploaded_by,
        createdAt: imageRow.created_at,
        updatedAt: imageRow.updated_at,
        people: peopleRows.map(row => ({
          id: row.id,
          personId: row.person_id,
          personName: row.name,
          personSurname: row.surname,
          positionX: row.position_x,
          positionY: row.position_y,
          width: row.width,
          height: row.height,
          createdAt: row.created_at
        }))
      };

      res.json(image);
    });
  });
});

// Add person to image (tag person in image)
app.post('/api/images/:imageId/people', (req, res) => {
  const { imageId } = req.params;
  const { personId, positionX, positionY, width, height } = req.body;

  if (!personId) {
    return res.status(400).json({ error: 'Person ID is required' });
  }

  db.run(`INSERT INTO image_people (image_id, person_id, position_x, position_y, width, height)
          VALUES (?, ?, ?, ?, ?, ?)`, 
  [imageId, personId, positionX, positionY, width, height], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Person is already tagged in this image' });
      }
      return res.status(500).json({ error: err.message });
    }

    res.json({
      success: true,
      id: this.lastID,
      imageId,
      personId,
      positionX,
      positionY,
      width,
      height
    });
  });
});

// Remove person from image
app.delete('/api/images/:imageId/people/:personId', (req, res) => {
  const { imageId, personId } = req.params;

  db.run(`DELETE FROM image_people WHERE image_id = ? AND person_id = ?`, 
  [imageId, personId], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Person tag not found in image' });
    }

    res.json({ success: true, message: 'Person removed from image' });
  });
});

// Update person position in image
app.put('/api/images/:imageId/people/:personId', (req, res) => {
  const { imageId, personId } = req.params;
  const { positionX, positionY, width, height } = req.body;

  db.run(`UPDATE image_people 
          SET position_x = ?, position_y = ?, width = ?, height = ?
          WHERE image_id = ? AND person_id = ?`, 
  [positionX, positionY, width, height, imageId, personId], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Person tag not found in image' });
    }

    res.json({
      success: true,
      imageId,
      personId,
      positionX,
      positionY,
      width,
      height
    });
  });
});

// Update image description
app.put('/api/images/:id', (req, res) => {
  const { id } = req.params;
  const { description } = req.body;

  db.run(`UPDATE images SET description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, 
  [description, id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.json({ success: true, message: 'Image description updated' });
  });
});

// Delete image (also removes from S3)
app.delete('/api/images/:id', (req, res) => {
  const { id } = req.params;

  // First get the image to get S3 key
  db.get(`SELECT s3_key FROM images WHERE id = ?`, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!row) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete from S3
    const deleteParams = {
      Bucket: S3_BUCKET_NAME,
      Key: row.s3_key
    };

    s3.deleteObject(deleteParams, (s3Err, data) => {
      if (s3Err) {
        console.error('S3 deletion error:', s3Err);
        // Continue with database deletion even if S3 deletion fails
      }

      // Delete from database (this will cascade delete image_people records)
      db.run(`DELETE FROM images WHERE id = ?`, [id], function(dbErr) {
        if (dbErr) {
          return res.status(500).json({ error: dbErr.message });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Image not found' });
        }

        res.json({ 
          success: true, 
          message: 'Image deleted successfully',
          s3Deleted: !s3Err
        });
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});