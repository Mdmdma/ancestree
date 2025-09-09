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
const { db, insertDefaultNodeForFamily, ensureFamilyHasNodes } = require('./database');
const axios = require('axios'); // Add axios for API calls
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto'); // For address hashing
const bcrypt = require('bcrypt'); // For password hashing
const jwt = require('jsonwebtoken'); // For JWT tokens

const app = express();
const server = http.createServer(app);

// JWT secret for token signing
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Optional authentication middleware (allows both authenticated and unauthenticated access)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err) {
        req.user = user;
      }
    });
  }
  next();
};

// Helper function to generate address hash for geocoding optimization
const generateAddressHash = (city, zip, country) => {
  const addressString = [city, zip, country]
    .filter(Boolean)
    .map(part => part.toString().trim().toLowerCase())
    .join('|');
  return crypto.createHash('md5').update(addressString).digest('hex');
};

// Helper function to perform smart geocoding (only when address changes)
const performSmartGeocoding = async (nodeData, currentNode = null) => {
  const { city, zip, country } = nodeData;
  
  // Generate new address hash
  const newAddressHash = generateAddressHash(city, zip, country);
  
  // If we have a current node and the address hash hasn't changed, keep existing coordinates
  if (currentNode && currentNode.address_hash === newAddressHash && 
      currentNode.latitude !== null && currentNode.longitude !== null) {
    return {
      latitude: currentNode.latitude,
      longitude: currentNode.longitude,
      address_hash: newAddressHash
    };
  }
  
  // If no valid address components, return null coordinates
  if (!city && !zip && !country) {
    return {
      latitude: null,
      longitude: null,
      address_hash: null
    };
  }
  
  // Perform geocoding for new/changed address
  try {
    const address = [city, zip, country].filter(Boolean).join(', ');
    const geocodeResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: address,
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });
    
    if (geocodeResponse.data.status === 'OK' && geocodeResponse.data.results.length > 0) {
      const location = geocodeResponse.data.results[0].geometry.location;
      console.log(`Geocoded address "${address}" to: ${location.lat}, ${location.lng}`);
      
      return {
        latitude: location.lat,
        longitude: location.lng,
        address_hash: newAddressHash
      };
    } else {
      console.log(`Geocoding failed for address "${address}": ${geocodeResponse.data.status}`);
      return {
        latitude: null,
        longitude: null,
        address_hash: newAddressHash
      };
    }
  } catch (error) {
    console.error('Error during geocoding:', error.message);
    return {
      latitude: null,
      longitude: null,
      address_hash: newAddressHash
    };
  }
};

// Configure CORS origins based on environment
const getCorsOrigins = () => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  if (isDevelopment) {
    return [
      "http://localhost:5173", 
      "http://localhost:5174",
      "http://192.168.1.43:5173", // Network access
      /^http:\/\/192\.168\.1\.\d+:5173$/, // Allow any device on 192.168.1.x network
      /^http:\/\/10\.\d+\.\d+\.\d+:5173$/, // Allow 10.x.x.x networks
      /^http:\/\/172\.16\.\d+\.\d+:5173$/ // Allow 172.16.x.x networks
    ];
  }
  
  // Production origins - add your domain(s) here
  return [
    process.env.FRONTEND_URL || "https://yourfamilytree.com",
    "https://ancestree.ch",
    "https://www.ancestree.ch",
    /^https:\/\/.*\.yourfamilytree\.com$/, // Allow subdomains
    // Add your Lightsail static IP if needed
    // "http://YOUR_LIGHTSAIL_IP"
  ];
};

const io = new Server(server, {
  cors: {
    origin: getCorsOrigins(),
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;

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

// Cleanup routine to remove items with null keys and duplicate edges
function cleanupNullKeys() {
  console.log('Running cleanup routine for null keys and duplicate edges...');
  
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

  // Clean up self-loop edges (edges that connect a node with itself)
  db.run("DELETE FROM edges WHERE source = target", function(err) {
    if (err) {
      console.error('Error cleaning up self-loop edges:', err.message);
    } else if (this.changes > 0) {
      console.log(`Cleaned up ${this.changes} self-loop edges`);
    }
  });

  // Clean up orphaned image references
  cleanupOrphanedImageReferences();

  // Clean up duplicate edges with same endpoints, keeping only highest rank edge
  // Only edges of the same type are considered duplicates - different relationship types can coexist
  cleanupDuplicateEdges();
}

function cleanupDuplicateEdges() {
  console.log('Cleaning up duplicate edges with same endpoints and type...');
  
  // Find duplicate edges (same source, target, AND type - different relationship types are allowed)
  const query = `
    WITH EdgePairs AS (
      SELECT 
        e1.id as id1,
        e2.id as id2,
        e1.source as source1,
        e1.target as target1,
        e2.source as source2,
        e2.target as target2,
        e1.type as type1,
        e2.type as type2,
        CASE e1.type 
          WHEN 'bloodline' THEN 1
          WHEN 'bloodlinehidden' THEN 2  
          WHEN 'bloodlinefake' THEN 3
          WHEN 'partner' THEN 4
          ELSE 5
        END as priority1,
        CASE e2.type 
          WHEN 'bloodline' THEN 1
          WHEN 'bloodlinehidden' THEN 2
          WHEN 'bloodlinefake' THEN 3  
          WHEN 'partner' THEN 4
          ELSE 5
        END as priority2
      FROM edges e1
      JOIN edges e2 ON e1.id < e2.id
      WHERE (
        -- Only consider edges duplicates if they have same endpoints AND same type
        (e1.source = e2.source AND e1.target = e2.target AND e1.type = e2.type) OR
        (e1.source = e2.target AND e1.target = e2.source AND e1.type = e2.type)
      )
    )
    SELECT 
      CASE 
        WHEN priority1 <= priority2 THEN id2
        ELSE id1 
      END as id_to_delete
    FROM EdgePairs
  `;
  
  db.all(query, (err, duplicateEdges) => {
    if (err) {
      console.error('Error finding duplicate edges:', err.message);
      return;
    }
    
    if (duplicateEdges.length === 0) {
      console.log('No duplicate edges found');
      return;
    }
    
    console.log(`Found ${duplicateEdges.length} duplicate edges to remove`);
    
    // Delete the lower priority duplicate edges
    const idsToDelete = duplicateEdges.map(edge => edge.id_to_delete);
    const placeholders = idsToDelete.map(() => '?').join(',');
    
    db.run(`DELETE FROM edges WHERE id IN (${placeholders})`, idsToDelete, function(err) {
      if (err) {
        console.error('Error deleting duplicate edges:', err.message);
      } else {
        console.log(`Successfully removed ${this.changes} duplicate edges`);
      }
    });
  });
}

function cleanupOrphanedImageReferences() {
  console.log('Cleaning up orphaned image references...');
  
  // Clean up image_people entries that reference non-existent images
  db.run(`DELETE FROM image_people 
          WHERE image_id NOT IN (SELECT id FROM images)`, function(err) {
    if (err) {
      console.error('Error cleaning up orphaned image_people entries:', err.message);
    } else if (this.changes > 0) {
      console.log(`Cleaned up ${this.changes} orphaned image_people entries`);
    }
  });
  
  // Clean up image_people entries that reference non-existent people/nodes
  db.run(`DELETE FROM image_people 
          WHERE person_id NOT IN (SELECT id FROM nodes)`, function(err) {
    if (err) {
      console.error('Error cleaning up orphaned image_people person references:', err.message);
    } else if (this.changes > 0) {
      console.log(`Cleaned up ${this.changes} orphaned image_people person references`);
    }
  });
  
  // Clean up preferred_image_id references in nodes that point to non-existent images
  db.run(`UPDATE nodes 
          SET preferred_image_id = NULL 
          WHERE preferred_image_id IS NOT NULL 
          AND preferred_image_id NOT IN (SELECT id FROM images)`, function(err) {
    if (err) {
      console.error('Error cleaning up orphaned preferred image references:', err.message);
    } else if (this.changes > 0) {
      console.log(`Cleaned up ${this.changes} orphaned preferred image references`);
    }
  });
}
// Run cleanup every 5 minutes (300000 ms)
const CLEANUP_INTERVAL = 60 * 1000 * 5; // 5 minutes
setInterval(cleanupNullKeys, CLEANUP_INTERVAL);

// Run initial cleanup on server start
setTimeout(cleanupNullKeys, 5000); // Wait 5 seconds after server start

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from the React app build directory (for production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../ancestree-app/dist')));
}

// Make io instance available to routes
app.set('io', io);

// ============= AUTHENTICATION ENDPOINTS =============

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  const { familyName, password } = req.body;

  if (!familyName || !password) {
    return res.status(400).json({ error: 'Family name and password are required' });
  }

  try {
    // Check if user exists
    db.get('SELECT * FROM users WHERE family_name = ?', [familyName], async (err, user) => {
      if (err) {
        console.error('Database error during login:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid family name or password' });
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid family name or password' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user.id, 
          familyName: user.family_name 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          familyName: user.family_name
        }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register endpoint (for family registration)
app.post('/api/auth/register', async (req, res) => {
  const { familyName, password } = req.body;

  if (!familyName || !password) {
    return res.status(400).json({ error: 'Family name and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    // Check if family name already exists
    db.get('SELECT id FROM users WHERE family_name = ?', [familyName], async (err, existingUser) => {
      if (err) {
        console.error('Database error during registration:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (existingUser) {
        return res.status(400).json({ error: 'Family name already exists. Please choose a different name.' });
      }

      try {
        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        db.run('INSERT INTO users (family_name, password_hash) VALUES (?, ?)', 
          [familyName, passwordHash], 
          function(err) {
            if (err) {
              console.error('Database error during user creation:', err);
              return res.status(500).json({ error: 'Internal server error' });
            }

            const familyId = this.lastID;

            // Create a default node for the new family
            insertDefaultNodeForFamily(familyId);

            // Generate JWT token
            const token = jwt.sign(
              { 
                id: familyId, 
                familyName 
              },
              JWT_SECRET,
              { expiresIn: '24h' }
            );

            res.status(201).json({
              success: true,
              token,
              user: {
                id: familyId,
                familyName
              }
            });
          }
        );
      } catch (hashError) {
        console.error('Password hashing error:', hashError);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if family is already registered
app.get('/api/auth/status', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
    if (err) {
      console.error('Database error during status check:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json({
      registered: result.count > 0,
      requiresSetup: result.count === 0
    });
  });
});

// Verify token endpoint
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      familyName: req.user.familyName
    }
  });
});

// ============= PROTECTED API ENDPOINTS =============

// Socket.IO connection handling for real-time collaboration
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // Handle authentication for socket connection
  socket.on('authenticate', (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const familyId = decoded.id;
      const familyName = decoded.familyName;
      
      // Join the family-specific room
      const roomName = `family-${familyId}`;
      socket.join(roomName);
      
      // Track user info
      connectedUsers.set(socket.id, {
        id: socket.id,
        familyId: familyId,
        familyName: familyName,
        room: roomName,
        connectedAt: new Date()
      });
      
      // Notify others about user count in this family
      const userCount = Array.from(connectedUsers.values())
        .filter(user => user.room === roomName).length;
      
      io.to(roomName).emit('user:count', userCount);
      
      console.log(`User ${socket.id} authenticated and joined family room ${roomName}. Total users: ${userCount}`);
      
      // Send authentication success
      socket.emit('authenticated', { familyId, familyName, room: roomName });
      
    } catch (error) {
      console.log(`Authentication failed for socket ${socket.id}:`, error.message);
      socket.emit('authentication_error', { message: 'Invalid token' });
      socket.disconnect();
    }
  });
  
  // Handle position updates (throttled on client side)
  socket.on('node:position', (data) => {
    const user = connectedUsers.get(socket.id);
    if (user && user.room) {
      socket.to(user.room).emit('node:position', {
        ...data,
        updatedBy: socket.id
      });
    }
  });
  
  // Handle cursor position updates (optional)
  socket.on('user:cursor', (data) => {
    const user = connectedUsers.get(socket.id);
    if (user && user.room) {
      socket.to(user.room).emit('user:cursor', {
        ...data,
        userId: socket.id
      });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    const user = connectedUsers.get(socket.id);
    connectedUsers.delete(socket.id);
    
    if (user && user.room) {
      const userCount = Array.from(connectedUsers.values())
        .filter(u => u.room === user.room).length;
      
      io.to(user.room).emit('user:count', userCount);
      console.log(`User ${socket.id} left family room ${user.room}. Total users: ${userCount}`);
    }
  });
});

// Get all nodes
app.get('/api/nodes', authenticateToken, (req, res) => {
  const familyId = req.user.id;
  db.all("SELECT * FROM nodes WHERE family_id = ?", [familyId], (err, rows) => {
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
        maidenName: row.maiden_name,
        birthDate: row.birth_date,
        deathDate: row.death_date,
        city: row.city,
        zip: row.zip,
        country: row.country,
        phone: row.phone,
        email: row.email,
        latitude: row.latitude,
        longitude: row.longitude,
        address_hash: row.address_hash,
        bloodline: Boolean(row.bloodline),
        preferredImageId: row.preferred_image_id,
        isSelected: false
      }
    }));
    
    res.json(nodes);
  });
});

// Get all edges
app.get('/api/edges', authenticateToken, (req, res) => {
  const familyId = req.user.id;
  db.all("SELECT * FROM edges WHERE family_id = ?", [familyId], (err, rows) => {
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
app.post('/api/nodes', authenticateToken, async (req, res) => {
  const { id, type, position, data } = req.body;
  const familyId = req.user.id;
  
  try {
    // Perform smart geocoding for address
    const geocodingResult = await performSmartGeocoding(data);
    
    db.run(`INSERT INTO nodes (
      id, type, position_x, position_y, name, surname, maiden_name, birth_date, death_date,
      city, zip, country, phone, email, latitude, longitude, address_hash,
      bloodline, preferred_image_id, family_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, type, position.x, position.y, data.name, data.surname, data.maidenName,
      data.birthDate, data.deathDate, data.city, data.zip, data.country, data.phone,
      data.email, geocodingResult.latitude, geocodingResult.longitude, geocodingResult.address_hash,
      data.bloodline ? 1 : 0, data.preferredImageId || null, familyId
    ], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Create the full node object for broadcasting
      const newNode = {
        id, type, position, 
        data: {
          ...data,
          latitude: geocodingResult.latitude,
          longitude: geocodingResult.longitude,
          address_hash: geocodingResult.address_hash
        },
        deletable: true,
        selectable: true
      };
    
      // Broadcast to other users in the family room
      req.app.get('io').to(`family-${familyId}`).emit('node:created', newNode);
      
      res.json({ success: true, id: this.lastID });
    });
  } catch (error) {
    console.error('Error creating node:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update node
app.put('/api/nodes/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { position, data } = req.body;
  const familyId = req.user.id;
  
  try {
    // First, get the current node to check if geocoding is needed
    const getCurrentNode = () => {
      return new Promise((resolve, reject) => {
        db.get('SELECT * FROM nodes WHERE id = ? AND family_id = ?', [id, familyId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    };
    
    const currentNode = await getCurrentNode();
    
    if (!currentNode) {
      return res.status(404).json({ error: 'Node not found or access denied' });
    }
    
    // Perform smart geocoding (only if address changed)
    const geocodingResult = await performSmartGeocoding(data, currentNode);
    
    db.run(`UPDATE nodes SET 
      position_x = ?, position_y = ?, name = ?, surname = ?, maiden_name = ?, birth_date = ?,
      death_date = ?, city = ?, zip = ?, country = ?, phone = ?, email = ?,
      latitude = ?, longitude = ?, address_hash = ?,
      bloodline = ?, preferred_image_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND family_id = ?`, [
      position?.x, position?.y, data.name, data.surname, data.maidenName, data.birthDate,
      data.deathDate, data.city, data.zip, data.country, data.phone, data.email,
      geocodingResult.latitude, geocodingResult.longitude, geocodingResult.address_hash,
      data.bloodline ? 1 : 0, data.preferredImageId || null, id, familyId
    ], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Broadcast the update to other users in the family room
      const updatedNode = {
        id,
        position,
        data: {
          ...data,
          latitude: geocodingResult.latitude,
          longitude: geocodingResult.longitude,
          address_hash: geocodingResult.address_hash
        },
        type: req.body.type // Include if provided
      };
    
      req.app.get('io').to(`family-${familyId}`).emit('node:updated', updatedNode);
      
      res.json({ success: true, changes: this.changes });
    });
  } catch (error) {
    console.error('Error updating node:', error);
    res.status(500).json({ error: error.message });
  }
});

// Set preferred image for a person
app.put('/api/nodes/:personId/preferred-image', authenticateToken, (req, res) => {
  const { personId } = req.params;
  const { imageId } = req.body;
  const familyId = req.user.id;
  
  db.run(`UPDATE nodes SET preferred_image_id = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ? AND family_id = ?`, 
  [imageId || null, personId, familyId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }
    
    res.json({ success: true, personId, imageId: imageId || null });
  });
});

// Delete node
app.delete('/api/nodes/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const familyId = req.user.id;
  
  // First check if this family will have any nodes left after deletion
  db.get("SELECT COUNT(*) as count FROM nodes WHERE family_id = ?", [familyId], (err, result) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (result.count <= 1) {
      res.status(400).json({ 
        error: 'Cannot delete the last node in a family tree. At least one person must remain.' 
      });
      return;
    }
    
    // First delete all edges connected to this node (within the same family)
    db.run("DELETE FROM edges WHERE (source = ? OR target = ?) AND family_id = ?", [id, id, familyId], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Then delete the node (ensure it belongs to this family)
      db.run("DELETE FROM nodes WHERE id = ? AND family_id = ?", [id, familyId], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        if (this.changes === 0) {
          res.status(404).json({ error: 'Node not found or access denied' });
          return;
        }
        
        // Broadcast the deletion to other users in the family room
        req.app.get('io').to(`family-${familyId}`).emit('node:deleted', { id });
        
        res.json({ success: true, changes: this.changes });
      });
    });
  });
});

// Create new edge
app.post('/api/edges', authenticateToken, (req, res) => {
  const { id, source, target, sourceHandle, targetHandle, type } = req.body;
  const familyId = req.user.id;
  
  // Basic validation
  if (!id || !source || !target || !type) {
    res.status(400).json({ error: 'Missing required fields: id, source, target, type' });
    return;
  }
  
  // Create edge normally without partner validation
  db.run(`INSERT INTO edges (id, source, target, source_handle, target_handle, type, family_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, source, target, sourceHandle, targetHandle, type, familyId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Create the full edge object for broadcasting
    const newEdge = {
      id, source, target, sourceHandle, targetHandle, type,
      data: req.body.data || {}
    };
    
    // Broadcast to other users in the family room
    req.app.get('io').to(`family-${familyId}`).emit('edge:created', newEdge);
    
    res.json({ success: true, edgeId: id });
  });
});

// Delete edge
app.delete('/api/edges/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const familyId = req.user.id;
  
  db.run("DELETE FROM edges WHERE id = ? AND family_id = ?", [id, familyId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Broadcast the deletion to other users in the family room
    req.app.get('io').to(`family-${familyId}`).emit('edge:deleted', { id });
    
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
  let totalNullCleaned = 0;
  let totalSelfLoopsCleaned = 0;
  let totalDuplicatesCleaned = 0;
  let totalOrphanedImagesCleaned = 0;
  let operations = 0;
  const maxOperations = 7; // Increased to include orphaned image cleanup
  
  function checkComplete() {
    operations++;
    if (operations === maxOperations) {
      res.json({ 
        success: true, 
        message: `Cleanup completed. Removed ${totalNullCleaned} items with null keys, ${totalSelfLoopsCleaned} self-loop edges, ${totalDuplicatesCleaned} duplicate edges, and ${totalOrphanedImagesCleaned} orphaned image references.`,
        nullItemsRemoved: totalNullCleaned,
        selfLoopEdgesRemoved: totalSelfLoopsCleaned,
        duplicateEdgesRemoved: totalDuplicatesCleaned,
        orphanedImageReferencesRemoved: totalOrphanedImagesCleaned
      });
    }
  }
  
  // Remove nodes with null id
  db.run("DELETE FROM nodes WHERE id IS NULL", function(err) {
    if (err) {
      res.status(500).json({ error: 'Error cleaning nodes: ' + err.message });
      return;
    }
    totalNullCleaned += this.changes;
    checkComplete();
  });
  
  // Remove edges with null id
  db.run("DELETE FROM edges WHERE id IS NULL", function(err) {
    if (err) {
      res.status(500).json({ error: 'Error cleaning edges: ' + err.message });
      return;
    }
    totalNullCleaned += this.changes;
    checkComplete();
  });
  
  // Remove edges with null source or target references
  db.run("DELETE FROM edges WHERE source IS NULL OR target IS NULL", function(err) {
    if (err) {
      res.status(500).json({ error: 'Error cleaning edge references: ' + err.message });
      return;
    }
    totalNullCleaned += this.changes;
    checkComplete();
  });

  // Remove self-loop edges (edges that connect a node with itself)
  db.run("DELETE FROM edges WHERE source = target", function(err) {
    if (err) {
      res.status(500).json({ error: 'Error cleaning self-loop edges: ' + err.message });
      return;
    }
    totalSelfLoopsCleaned = this.changes;
    checkComplete();
  });

  // Clean up orphaned image_people entries
  db.run(`DELETE FROM image_people WHERE image_id NOT IN (SELECT id FROM images)`, function(err) {
    if (err) {
      res.status(500).json({ error: 'Error cleaning orphaned image_people: ' + err.message });
      return;
    }
    totalOrphanedImagesCleaned += this.changes;
    checkComplete();
  });

  // Clean up image_people entries that reference non-existent people/nodes
  db.run(`DELETE FROM image_people WHERE person_id NOT IN (SELECT id FROM nodes)`, function(err) {
    if (err) {
      res.status(500).json({ error: 'Error cleaning orphaned image_people person references: ' + err.message });
      return;
    }
    totalOrphanedImagesCleaned += this.changes;
    checkComplete();
  });

  // Clean up orphaned preferred image references
  db.run(`UPDATE nodes SET preferred_image_id = NULL 
          WHERE preferred_image_id IS NOT NULL 
          AND preferred_image_id NOT IN (SELECT id FROM images)`, function(err) {
    if (err) {
      res.status(500).json({ error: 'Error cleaning orphaned preferred images: ' + err.message });
      return;
    }
    totalOrphanedImagesCleaned += this.changes;
    checkComplete();
  });

  // Clean up duplicate edges
  const duplicateQuery = `
    WITH EdgePairs AS (
      SELECT 
        e1.id as id1,
        e2.id as id2,
        e1.source as source1,
        e1.target as target1,
        e2.source as source2,
        e2.target as target2,
        e1.type as type1,
        e2.type as type2,
        CASE e1.type 
          WHEN 'bloodline' THEN 1
          WHEN 'bloodlinehidden' THEN 2  
          WHEN 'bloodlinefake' THEN 3
          WHEN 'partner' THEN 4
          ELSE 5
        END as priority1,
        CASE e2.type 
          WHEN 'bloodline' THEN 1
          WHEN 'bloodlinehidden' THEN 2
          WHEN 'bloodlinefake' THEN 3  
          WHEN 'partner' THEN 4
          ELSE 5
        END as priority2
      FROM edges e1
      JOIN edges e2 ON e1.id < e2.id
      WHERE (
        -- Only consider edges duplicates if they have same endpoints AND same type
        (e1.source = e2.source AND e1.target = e2.target AND e1.type = e2.type) OR
        (e1.source = e2.target AND e1.target = e2.source AND e1.type = e2.type)
      )
    )
    SELECT 
      CASE 
        WHEN priority1 <= priority2 THEN id2
        ELSE id1 
      END as id_to_delete
    FROM EdgePairs
  `;
  
  db.all(duplicateQuery, (err, duplicateEdges) => {
    if (err) {
      res.status(500).json({ error: 'Error finding duplicate edges: ' + err.message });
      return;
    }
    
    if (duplicateEdges.length === 0) {
      checkComplete();
      return;
    }
    
    // Delete the lower priority duplicate edges
    const idsToDelete = duplicateEdges.map(edge => edge.id_to_delete);
    const placeholders = idsToDelete.map(() => '?').join(',');
    
    db.run(`DELETE FROM edges WHERE id IN (${placeholders})`, idsToDelete, function(err) {
      if (err) {
        res.status(500).json({ error: 'Error deleting duplicate edges: ' + err.message });
        return;
      }
      totalDuplicatesCleaned = this.changes;
      checkComplete();
    });
  });
});

// Test endpoint to create self-loop edges for testing cleanup (development only)
app.post('/api/test/create-self-loops', (req, res) => {
  // This endpoint is for testing the self-loop cleanup functionality
  const testEdges = [
    { id: 'self-loop-1', source: 'node1', target: 'node1', type: 'bloodline' },
    { id: 'self-loop-2', source: 'node2', target: 'node2', type: 'partner' },
    { id: 'self-loop-3', source: 'node3', target: 'node3', type: 'bloodlinehidden' },
    { id: 'normal-edge', source: 'node1', target: 'node2', type: 'bloodline' }, // Normal edge should remain
  ];
  
  let insertCount = 0;
  const totalInserts = testEdges.length;
  
  testEdges.forEach(edge => {
    db.run(
      "INSERT OR REPLACE INTO edges (id, source, target, type) VALUES (?, ?, ?, ?)",
      [edge.id, edge.source, edge.target, edge.type],
      function(err) {
        if (err) {
          console.error('Error inserting test edge:', err.message);
        } else {
          insertCount++;
          if (insertCount === totalInserts) {
            res.json({ 
              success: true, 
              message: `Created ${totalInserts} test edges including self-loops`,
              testEdges: testEdges
            });
          }
        }
      }
    );
  });
});

// ============= GEOCODING ENDPOINTS =============

// Geocode address using Google Maps API
app.post('/api/geocode', async (req, res) => {
  const { address } = req.body;
  
  if (!address || address.trim() === '') {
    return res.status(400).json({ error: 'Address is required' });
  }
  
  try {
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleMapsApiKey) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }
    
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: address.trim(),
        key: googleMapsApiKey
      }
    });
    
    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const result = response.data.results[0];
      const location = result.geometry.location;
      
      res.json({
        lat: location.lat,
        lng: location.lng,
        formatted_address: result.formatted_address,
        place_id: result.place_id
      });
    } else if (response.data.status === 'ZERO_RESULTS') {
      res.status(404).json({ error: 'Address not found' });
    } else if (response.data.status === 'OVER_QUERY_LIMIT') {
      res.status(429).json({ error: 'Google Maps API quota exceeded' });
    } else {
      console.error('Google Maps API error:', response.data);
      res.status(500).json({ error: 'Failed to geocode address: ' + response.data.status });
    }
  } catch (error) {
    console.error('Geocoding error:', error.message);
    res.status(500).json({ error: 'Failed to geocode address' });
  }
});

// ============= IMAGE ENDPOINTS =============

// Upload image
app.post('/api/images/upload', authenticateToken, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  const imageId = uuidv4();
  const familyId = req.user.id;
  const imageData = {
    id: imageId,
    filename: req.file.key.split('/').pop(), // Extract filename from S3 key
    original_filename: req.file.originalname,
    s3_key: req.file.key,
    s3_url: req.file.location,
    description: req.body.description || '',
    file_size: req.file.size,
    mime_type: req.file.mimetype,
    uploaded_by: req.body.uploaded_by || 'anonymous',
    family_id: familyId
  };

  db.run(`INSERT INTO images (
    id, filename, original_filename, s3_key, s3_url, description, 
    file_size, mime_type, uploaded_by, family_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    imageData.id,
    imageData.filename,
    imageData.original_filename,
    imageData.s3_key,
    imageData.s3_url,
    imageData.description,
    imageData.file_size,
    imageData.mime_type,
    imageData.uploaded_by,
    imageData.family_id
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
app.get('/api/images', authenticateToken, (req, res) => {
  const familyId = req.user.id;
  db.all(`SELECT i.*, 
    json_group_array(
      CASE 
        WHEN ip.person_id IS NOT NULL THEN 
          json_object(
            'person_id', ip.person_id,
            'person_name', COALESCE(n.name, ''),
            'person_surname', COALESCE(n.surname, ''),
            'position_x', ip.position_x,
            'position_y', ip.position_y,
            'width', ip.width,
            'height', ip.height
          )
        ELSE NULL
      END
    ) as people
    FROM images i
    LEFT JOIN image_people ip ON i.id = ip.image_id AND ip.family_id = ?
    LEFT JOIN nodes n ON ip.person_id = n.id AND n.family_id = ?
    WHERE i.family_id = ?
    GROUP BY i.id
    ORDER BY i.created_at DESC`, 
  [familyId, familyId, familyId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const images = rows.map(row => {
      let people = [];
      if (row.people) {
        try {
          // Parse the JSON array
          const parsedPeople = JSON.parse(row.people);
          // Filter out null values and convert to camelCase
          people = parsedPeople.filter(p => p !== null).map(p => ({
            personId: p.person_id,
            personName: p.person_name,
            personSurname: p.person_surname,
            positionX: p.position_x,
            positionY: p.position_y,
            width: p.width,
            height: p.height
          }));
        } catch (e) {
          console.error('Error parsing people JSON:', e);
          people = [];
        }
      }

      return {
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
        people: people
      };
    });

    res.json(images);
  });
});

// Get specific image with people
app.get('/api/images/:id', authenticateToken, (req, res) => {
  const imageId = req.params.id;
  const familyId = req.user.id;
  
  db.get(`SELECT * FROM images WHERE id = ? AND family_id = ?`, [imageId, familyId], (err, imageRow) => {
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
            WHERE ip.image_id = ? AND ip.family_id = ? AND n.family_id = ?`, 
    [imageId, familyId, familyId], (err, peopleRows) => {
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
app.post('/api/images/:imageId/people', authenticateToken, (req, res) => {
  const { imageId } = req.params;
  const { personId, positionX, positionY, width, height } = req.body;
  const familyId = req.user.id;

  if (!personId) {
    return res.status(400).json({ error: 'Person ID is required' });
  }

  db.run(`INSERT INTO image_people (image_id, person_id, position_x, position_y, width, height, family_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)`, 
  [imageId, personId, positionX, positionY, width, height, familyId], function(err) {
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
app.delete('/api/images/:imageId/people/:personId', authenticateToken, (req, res) => {
  const { imageId, personId } = req.params;
  const familyId = req.user.id;

  db.run(`DELETE FROM image_people WHERE image_id = ? AND person_id = ? AND family_id = ?`, 
  [imageId, personId, familyId], function(err) {
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

// Fetch images for a specific person
app.get('/api/people/:personId/images', authenticateToken, (req, res) => {
  const { personId } = req.params;
  const familyId = req.user.id;

  const query = `
    SELECT i.id, i.s3_url, i.description, i.original_filename, i.created_at
    FROM images i
    INNER JOIN image_people ip ON i.id = ip.image_id
    WHERE ip.person_id = ? AND i.family_id = ? AND ip.family_id = ?
    ORDER BY i.created_at DESC
  `;

  db.all(query, [personId, familyId, familyId], (err, rows) => {
    if (err) {
      console.error('Database error in /api/people/:personId/images:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }

    // For each image, get all tagged people
    const images = [];
    let processedImages = 0;
    
    if (rows.length === 0) {
      return res.json([]);
    }

    rows.forEach(row => {
      const imageId = row.id;
      
      // Get all people tagged in this image
      db.all(`
        SELECT ip.person_id as personId, n.name as personName, n.surname as personSurname
        FROM image_people ip
        JOIN nodes n ON ip.person_id = n.id
        WHERE ip.image_id = ?
      `, [imageId], (err, peopleRows) => {
        if (err) {
          console.error('Error fetching people for image:', err.message);
          processedImages++;
        } else {
          images.push({
            id: row.id,
            s3Url: row.s3_url,
            description: row.description,
            originalFilename: row.original_filename,
            createdAt: row.created_at,
            people: peopleRows
          });
          processedImages++;
        }
        
        // When all images are processed, send response
        if (processedImages === rows.length) {
          // Sort by creation date (most recent first)
          images.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          res.json(images);
        }
      });
    });
  });
});

// === CHAT ENDPOINTS ===

// Get chat messages for a specific image
app.get('/api/images/:imageId/chat', authenticateToken, (req, res) => {
  const { imageId } = req.params;
  const familyId = req.user.id;

  const query = `
    SELECT id, user_name, message, created_at
    FROM chat_messages 
    WHERE image_id = ? AND family_id = ?
    ORDER BY created_at ASC
  `;

  db.all(query, [imageId, familyId], (err, rows) => {
    if (err) {
      console.error('Database error in /api/images/:imageId/chat:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }

    const messages = rows.map(row => ({
      id: row.id,
      userName: row.user_name,
      message: row.message,
      createdAt: row.created_at
    }));

    res.json(messages);
  });
});

// Post a new chat message for an image
app.post('/api/images/:imageId/chat', authenticateToken, (req, res) => {
  const { imageId } = req.params;
  const { userName, message } = req.body;
  const familyId = req.user.id;

  if (!userName || !message) {
    return res.status(400).json({ error: 'User name and message are required' });
  }

  if (message.trim().length === 0) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  if (userName.trim().length === 0) {
    return res.status(400).json({ error: 'User name cannot be empty' });
  }

  // Verify the image exists and belongs to this family
  db.get('SELECT id FROM images WHERE id = ? AND family_id = ?', [imageId, familyId], (err, row) => {
    if (err) {
      console.error('Database error checking image:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (!row) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Insert the new chat message
    const query = `
      INSERT INTO chat_messages (image_id, family_id, user_name, message, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `;

    db.run(query, [imageId, familyId, userName.trim(), message.trim()], function(err) {
      if (err) {
        console.error('Database error in /api/images/:imageId/chat POST:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }

      const newMessage = {
        id: this.lastID,
        userName: userName.trim(),
        message: message.trim(),
        createdAt: new Date().toISOString()
      };

      // Emit the new message to all clients in this family room for real-time updates
      req.app.get('io').to(`family-${familyId}`).emit('chat:message', {
        imageId: imageId,
        message: newMessage
      });

      res.json({
        success: true,
        message: newMessage
      });
    });
  });
});

// Delete a chat message (optional - allows users to delete their own messages)
app.delete('/api/images/:imageId/chat/:messageId', authenticateToken, (req, res) => {
  const { imageId, messageId } = req.params;
  const familyId = req.user.id;

  // Verify the message exists and belongs to this family and image
  const query = `
    DELETE FROM chat_messages 
    WHERE id = ? AND image_id = ? AND family_id = ?
  `;

  db.run(query, [messageId, imageId, familyId], function(err) {
    if (err) {
      console.error('Database error in /api/images/:imageId/chat/:messageId DELETE:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Emit the message deletion to all clients in this family room
    req.app.get('io').to(`family-${familyId}`).emit('chat:messageDeleted', {
      imageId: imageId,
      messageId: messageId
    });

    res.json({ success: true, message: 'Chat message deleted successfully' });
  });
});

// Catch-all handler: send back React's index.html file for production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../ancestree-app/dist/index.html'));
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Server also available on local network at http://[your-ip]:${PORT}`);
  console.log(`Socket.IO enabled for real-time collaboration`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});