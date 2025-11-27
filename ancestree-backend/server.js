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
const fs = require('fs');
const { authDb, getFamilyDb, getFamilyDbById, insertDefaultNodeForFamily, ensureFamilyHasNodes, closeFamilyDatabase } = require('./database');
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

// Validate AWS credentials are configured
const AWS_CREDENTIALS_CONFIGURED = !!(
  process.env.AWS_ACCESS_KEY_ID && 
  process.env.AWS_SECRET_ACCESS_KEY && 
  process.env.AWS_REGION && 
  process.env.S3_BUCKET_NAME
);

if (!AWS_CREDENTIALS_CONFIGURED) {
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.warn('⚠️  WARNING: AWS S3 credentials are not configured!');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.warn('Image uploads will NOT work until you configure:');
  console.warn('  - AWS_ACCESS_KEY_ID');
  console.warn('  - AWS_SECRET_ACCESS_KEY');
  console.warn('  - AWS_REGION');
  console.warn('  - S3_BUCKET_NAME');
  console.warn('');
  console.warn('Please create a .env file with these values.');
  console.warn('See .env.example for a template.');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

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
// This runs across ALL family databases
function cleanupNullKeys() {
  console.log('Running cleanup routine for null keys and duplicate edges across all families...');
  
  // Get all family database names from the databases folder
  const databasesPath = path.join(__dirname, 'databases');
  const familyDbFiles = fs.readdirSync(databasesPath)
    .filter(file => file.startsWith('database_family_') && file.endsWith('.db'));
  
  familyDbFiles.forEach(dbFile => {
    const familyName = dbFile.replace('database_family_', '').replace('.db', '');
    const familyDb = getFamilyDb(familyName);
    
    console.log(`Cleaning up family database: ${familyName}`);
    
    // Remove nodes with null id
    familyDb.run("DELETE FROM nodes WHERE id IS NULL", function(err) {
      if (err) {
        console.error(`Error cleaning up nodes with null keys in ${familyName}:`, err.message);
      } else if (this.changes > 0) {
        console.log(`Cleaned up ${this.changes} nodes with null keys in ${familyName}`);
      }
    });
    
    // Remove edges with null id
    familyDb.run("DELETE FROM edges WHERE id IS NULL", function(err) {
      if (err) {
        console.error(`Error cleaning up edges with null keys in ${familyName}:`, err.message);
      } else if (this.changes > 0) {
        console.log(`Cleaned up ${this.changes} edges with null keys in ${familyName}`);
      }
    });
    
    // Also clean up edges with null source or target references
    familyDb.run("DELETE FROM edges WHERE source IS NULL OR target IS NULL", function(err) {
      if (err) {
        console.error(`Error cleaning up edges with null references in ${familyName}:`, err.message);
      } else if (this.changes > 0) {
        console.log(`Cleaned up ${this.changes} edges with null references in ${familyName}`);
      }
    });

    // Clean up self-loop edges (edges that connect a node with itself)
    familyDb.run("DELETE FROM edges WHERE source = target", function(err) {
      if (err) {
        console.error(`Error cleaning up self-loop edges in ${familyName}:`, err.message);
      } else if (this.changes > 0) {
        console.log(`Cleaned up ${this.changes} self-loop edges in ${familyName}`);
      }
    });

    // Clean up orphaned image references
    cleanupOrphanedImageReferences(familyDb, familyName);

    // Clean up duplicate edges with same endpoints, keeping only highest rank edge
    // Only edges of the same type are considered duplicates - different relationship types can coexist
    cleanupDuplicateEdges(familyDb, familyName);
  });
}

function cleanupDuplicateEdges(familyDb, familyName) {
  console.log(`Cleaning up duplicate edges with same endpoints and type in ${familyName}...`);
  
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
  
  familyDb.all(query, (err, duplicateEdges) => {
    if (err) {
      console.error(`Error finding duplicate edges in ${familyName}:`, err.message);
      return;
    }
    
    if (duplicateEdges.length === 0) {
      console.log(`No duplicate edges found in ${familyName}`);
      return;
    }
    
    console.log(`Found ${duplicateEdges.length} duplicate edges to remove in ${familyName}`);
    
    // Delete the lower priority duplicate edges
    const idsToDelete = duplicateEdges.map(edge => edge.id_to_delete);
    const placeholders = idsToDelete.map(() => '?').join(',');
    
    familyDb.run(`DELETE FROM edges WHERE id IN (${placeholders})`, idsToDelete, function(err) {
      if (err) {
        console.error(`Error deleting duplicate edges in ${familyName}:`, err.message);
      } else {
        console.log(`Successfully removed ${this.changes} duplicate edges in ${familyName}`);
      }
    });
  });
}

function cleanupOrphanedImageReferences(familyDb, familyName) {
  console.log(`Cleaning up orphaned image references in ${familyName}...`);
  
  // Clean up image_people entries that reference non-existent images
  familyDb.run(`DELETE FROM image_people 
          WHERE image_id NOT IN (SELECT id FROM images)`, function(err) {
    if (err) {
      console.error(`Error cleaning up orphaned image_people entries in ${familyName}:`, err.message);
    } else if (this.changes > 0) {
      console.log(`Cleaned up ${this.changes} orphaned image_people entries in ${familyName}`);
    }
  });
  
  // Clean up image_people entries that reference non-existent people/nodes
  familyDb.run(`DELETE FROM image_people 
          WHERE person_id NOT IN (SELECT id FROM nodes)`, function(err) {
    if (err) {
      console.error(`Error cleaning up orphaned image_people person references in ${familyName}:`, err.message);
    } else if (this.changes > 0) {
      console.log(`Cleaned up ${this.changes} orphaned image_people person references in ${familyName}`);
    }
  });
  
  // Clean up preferred_image_id references in nodes that point to non-existent images
  familyDb.run(`UPDATE nodes 
          SET preferred_image_id = NULL 
          WHERE preferred_image_id IS NOT NULL 
          AND preferred_image_id NOT IN (SELECT id FROM images)`, function(err) {
    if (err) {
      console.error(`Error cleaning up orphaned preferred image references in ${familyName}:`, err.message);
    } else if (this.changes > 0) {
      console.log(`Cleaned up ${this.changes} orphaned preferred image references in ${familyName}`);
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
  // In production, dist folder is in the same directory as server.js
  const distPath = path.join(__dirname, 'dist');
  console.log(`Serving static files from: ${distPath}`);
  app.use(express.static(distPath));
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
    authDb.get('SELECT * FROM users WHERE family_name = ?', [familyName], async (err, user) => {
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
          familyName: user.family_name,
          displayName: user.display_name || user.family_name
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
  const { familyName, password, displayName, adminPassword, adminEmail, betaAccessPassword } = req.body;

  if (!familyName || !password) {
    return res.status(400).json({ error: 'Family name and password are required' });
  }

  // Check beta access password
  const requiredBetaPassword = process.env.BETA_ACCESS_PASSWORD;
  if (requiredBetaPassword && betaAccessPassword !== requiredBetaPassword) {
    return res.status(403).json({ error: 'Invalid beta access password' });
  }

  if (!adminPassword) {
    return res.status(400).json({ error: 'Admin password is required' });
  }

  if (!adminEmail) {
    return res.status(400).json({ error: 'Admin email is required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(adminEmail)) {
    return res.status(400).json({ error: 'Please provide a valid email address' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  if (adminPassword.length < 6) {
    return res.status(400).json({ error: 'Admin password must be at least 6 characters long' });
  }

  try {
    // Check if family name already exists
    authDb.get('SELECT id FROM users WHERE family_name = ?', [familyName], async (err, existingUser) => {
      if (err) {
        console.error('Database error during registration:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (existingUser) {
        return res.status(400).json({ error: 'Family name already exists. Please choose a different name.' });
      }

      try {
        // Hash passwords
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const adminPasswordHash = await bcrypt.hash(adminPassword, saltRounds);

        // Use displayName if provided, otherwise use familyName
        const finalDisplayName = displayName || familyName;

        // Generate encryption salt for default encryption
        const encryptionSalt = crypto.randomBytes(16).toString('hex');

        // Create user with encryption enabled by default
        authDb.run('INSERT INTO users (family_name, password_hash, admin_password_hash, display_name, encryption_enabled, encryption_salt) VALUES (?, ?, ?, ?, ?, ?)', 
          [familyName, passwordHash, adminPasswordHash, finalDisplayName, 1, encryptionSalt], 
          function(err) {
            if (err) {
              console.error('Database error during user creation:', err);
              return res.status(500).json({ error: 'Internal server error' });
            }

            const familyId = this.lastID;

            // Create a default node for the new family
            insertDefaultNodeForFamily(familyId);

            // Store display_name and admin_email in the family's admin table
            // Use encryption helpers to encrypt these values
            getFamilyDbById(familyId, (dbErr, familyDb, famName) => {
              if (dbErr) {
                console.error('Error accessing family database for admin settings:', dbErr);
                // Continue anyway, admin settings can be set later
              } else {
                const { encryptField } = require('./encryption');
                
                // Encrypt display_name
                const encryptedDisplayName = encryptField(finalDisplayName, password, encryptionSalt);
                
                // Encrypt admin_email
                const encryptedAdminEmail = encryptField(adminEmail, password, encryptionSalt);
                
                // Insert display_name
                familyDb.run(
                  'INSERT INTO admin (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP',
                  ['display_name', encryptedDisplayName, encryptedDisplayName],
                  (insertErr) => {
                    if (insertErr) {
                      console.error('Error storing display_name in admin table:', insertErr);
                    }
                  }
                );
                
                // Insert admin_email
                familyDb.run(
                  'INSERT INTO admin (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP',
                  ['admin_email', encryptedAdminEmail, encryptedAdminEmail],
                  (insertErr) => {
                    if (insertErr) {
                      console.error('Error storing admin_email in admin table:', insertErr);
                    }
                  }
                );
              }
            });

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
                familyName,
                displayName: finalDisplayName
              },
              encryptionEnabled: true,
              encryptionSalt: encryptionSalt
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
  authDb.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
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
  // Include display name if available
  authDb.get('SELECT display_name FROM users WHERE id = ?', [req.user.id], (err, row) => {
    if (err) {
      console.error('Error fetching display name during token verify:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json({
      success: true,
      user: {
        id: req.user.id,
        familyName: req.user.familyName,
        displayName: row ? row.display_name : undefined
      }
    });
  });
});

// Admin authentication endpoint
app.post('/api/auth/admin-login', authenticateToken, async (req, res) => {
  const { adminPassword } = req.body;

  if (!adminPassword) {
    return res.status(400).json({ error: 'Admin password is required' });
  }

  try {
    // Get user's admin password hash
    authDb.get('SELECT admin_password_hash FROM users WHERE id = ?', [req.user.id], async (err, user) => {
      if (err) {
        console.error('Database error during admin login:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // If no admin password is set, set default "adminn"
      if (!user.admin_password_hash) {
        const saltRounds = 10;
        const defaultAdminHash = await bcrypt.hash('adminn', saltRounds);
        
        authDb.run('UPDATE users SET admin_password_hash = ? WHERE id = ?', 
          [defaultAdminHash, req.user.id], 
          async (updateErr) => {
            if (updateErr) {
              console.error('Error setting default admin password:', updateErr);
              return res.status(500).json({ error: 'Internal server error' });
            }

            // Verify with default password
            const passwordMatch = await bcrypt.compare(adminPassword, defaultAdminHash);
            if (!passwordMatch) {
              return res.status(401).json({ error: 'Invalid admin password' });
            }

            res.json({ success: true, message: 'Admin authentication successful' });
          }
        );
      } else {
        // Verify admin password
        const passwordMatch = await bcrypt.compare(adminPassword, user.admin_password_hash);
        if (!passwordMatch) {
          return res.status(401).json({ error: 'Invalid admin password' });
        }

        res.json({ success: true, message: 'Admin authentication successful' });
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change family password endpoint (admin only)
app.post('/api/auth/change-family-password', authenticateToken, async (req, res) => {
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ error: 'New password is required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    authDb.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [passwordHash, req.user.id], 
      function(err) {
        if (err) {
          console.error('Database error during password change:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        res.json({ success: true, message: 'Family password updated successfully' });
      }
    );
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change admin password endpoint (admin only)
app.post('/api/auth/change-admin-password', authenticateToken, async (req, res) => {
  const { newAdminPassword } = req.body;

  if (!newAdminPassword) {
    return res.status(400).json({ error: 'New admin password is required' });
  }

  if (newAdminPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    const saltRounds = 10;
    const adminPasswordHash = await bcrypt.hash(newAdminPassword, saltRounds);

    authDb.run('UPDATE users SET admin_password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [adminPasswordHash, req.user.id], 
      function(err) {
        if (err) {
          console.error('Database error during admin password change:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        res.json({ success: true, message: 'Admin password updated successfully' });
      }
    );
  } catch (error) {
    console.error('Admin password change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete family database and auth entry (admin only)
app.delete('/api/auth/delete-family', authenticateToken, async (req, res) => {
  const { adminPassword } = req.body;

  if (!adminPassword) {
    return res.status(400).json({ error: 'Admin password is required to delete family' });
  }

  try {
    // First verify admin password
    authDb.get('SELECT family_name, admin_password_hash FROM users WHERE id = ?', [req.user.id], async (err, user) => {
      if (err) {
        console.error('Database error during family deletion:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify admin password
      const passwordMatch = await bcrypt.compare(adminPassword, user.admin_password_hash);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid admin password' });
      }

      const familyName = user.family_name;
      const familyDbPath = path.join(__dirname, 'databases', `database_family_${familyName}.db`);

      // Close the database connection if it's in the cache
      closeFamilyDatabase(familyName, (closeErr) => {
        if (closeErr) {
          console.error(`Error closing database for ${familyName}:`, closeErr);
          return res.status(500).json({ error: 'Failed to close database connection' });
        }

        // Delete the family database file
        try {
          if (fs.existsSync(familyDbPath)) {
            fs.unlinkSync(familyDbPath);
            console.log(`Deleted family database: ${familyDbPath}`);
          } else {
            console.log(`Family database file not found: ${familyDbPath}`);
          }
        } catch (fsError) {
          console.error('Error deleting family database file:', fsError);
          return res.status(500).json({ error: 'Failed to delete family database file' });
        }

        // Delete the user from auth database
        authDb.run('DELETE FROM users WHERE id = ?', [req.user.id], function(deleteErr) {
          if (deleteErr) {
            console.error('Database error during user deletion:', deleteErr);
            return res.status(500).json({ error: 'Internal server error' });
          }

          console.log(`Deleted family "${familyName}" from auth database`);
          res.json({ 
            success: true, 
            message: `Family "${familyName}" and all associated data have been permanently deleted` 
          });
        });
      });
    });
  } catch (error) {
    console.error('Family deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get family settings (encryption status, show_street_fields, show_phone_field, show_email_field)
app.get('/api/family/settings', authenticateToken, (req, res) => {
  authDb.get('SELECT encryption_enabled, encryption_salt, show_street_fields, show_phone_field, show_email_field, node_creation_locked FROM users WHERE id = ?', 
    [req.user.id], 
    (err, settings) => {
      if (err) {
        console.error('Database error fetching family settings:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!settings) {
        return res.status(404).json({ error: 'Family not found' });
      }

      res.json({
        encryptionEnabled: Boolean(settings.encryption_enabled),
        encryptionSalt: settings.encryption_salt,
        showStreetFields: Boolean(settings.show_street_fields),
        showPhoneField: Boolean(settings.show_phone_field),
        showEmailField: Boolean(settings.show_email_field),
        nodeCreationLocked: Boolean(settings.node_creation_locked)
      });
    }
  );
});

// Get all admin settings (key-value pairs from family database)
app.get('/api/admin/settings', authenticateToken, (req, res) => {
  getFamilyDbById(req.user.id, (err, familyDb, familyName) => {
    if (err) {
      console.error('Error getting family database:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    familyDb.all('SELECT key, value FROM admin', [], (err, rows) => {
      if (err) {
        console.error('Database error fetching admin settings:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      // Convert array of {key, value} to object
      const settings = {};
      if (rows) {
        rows.forEach(row => {
          settings[row.key] = row.value || '';
        });
      }

      res.json(settings);
    });
  });
});

// Get a specific admin setting by key
app.get('/api/admin/setting/:key', authenticateToken, (req, res) => {
  const { key } = req.params;

  getFamilyDbById(req.user.id, (err, familyDb, familyName) => {
    if (err) {
      console.error('Error getting family database:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    familyDb.get('SELECT value FROM admin WHERE key = ?', [key], (err, row) => {
      if (err) {
        console.error('Database error fetching admin setting:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      res.json({ value: row ? row.value || '' : '' });
    });
  });
});

// Set an admin setting (upsert)
app.post('/api/admin/setting', authenticateToken, (req, res) => {
  const { key, value } = req.body;

  if (!key) {
    return res.status(400).json({ error: 'Key is required' });
  }

  getFamilyDbById(req.user.id, (err, familyDb, familyName) => {
    if (err) {
      console.error('Error getting family database:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    // Use INSERT OR REPLACE to handle upsert
    familyDb.run(
      `INSERT INTO admin (key, value, updated_at) 
       VALUES (?, ?, CURRENT_TIMESTAMP) 
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`,
      [key, value || '', value || ''],
      function(err) {
        if (err) {
          console.error('Database error updating admin setting:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        res.json({ success: true, message: 'Admin setting updated successfully' });
      }
    );
  });
});

// Update show_street_fields setting
app.post('/api/family/street-fields-visibility', authenticateToken, (req, res) => {
  const { showStreetFields } = req.body;

  authDb.run('UPDATE users SET show_street_fields = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
    [showStreetFields ? 1 : 0, req.user.id], 
    function(err) {
      if (err) {
        console.error('Database error updating show_street_fields:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      res.json({ success: true, message: 'Street fields visibility updated successfully' });
    }
  );
});

// Update show_phone_field setting
app.post('/api/family/phone-field-visibility', authenticateToken, (req, res) => {
  const { showPhoneField } = req.body;

  authDb.run('UPDATE users SET show_phone_field = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
    [showPhoneField ? 1 : 0, req.user.id], 
    function(err) {
      if (err) {
        console.error('Database error updating show_phone_field:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      res.json({ success: true, message: 'Phone field visibility updated successfully' });
    }
  );
});

// Update show_email_field setting
app.post('/api/family/email-field-visibility', authenticateToken, (req, res) => {
  const { showEmailField } = req.body;

  authDb.run('UPDATE users SET show_email_field = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
    [showEmailField ? 1 : 0, req.user.id], 
    function(err) {
      if (err) {
        console.error('Database error updating show_email_field:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      res.json({ success: true, message: 'Email field visibility updated successfully' });
    }
  );
});

// Update node_creation_locked setting
app.post('/api/family/node-creation-lock', authenticateToken, (req, res) => {
  const { nodeCreationLocked } = req.body;

  authDb.run('UPDATE users SET node_creation_locked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
    [nodeCreationLocked ? 1 : 0, req.user.id], 
    function(err) {
      if (err) {
        console.error('Database error updating node_creation_locked:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      res.json({ success: true, message: 'Node creation lock updated successfully' });
    }
  );
});

// Set encryption status
app.post('/api/family/encryption', authenticateToken, (req, res) => {
  const { enabled, salt } = req.body;

  if (enabled && !salt) {
    return res.status(400).json({ error: 'Encryption salt is required when enabling encryption' });
  }

  const updateData = enabled 
    ? [1, salt, req.user.id]
    : [0, null, req.user.id];

  authDb.run('UPDATE users SET encryption_enabled = ?, encryption_salt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
    updateData, 
    function(err) {
      if (err) {
        console.error('Database error updating encryption status:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      res.json({ 
        success: true, 
        message: enabled ? 'Encryption enabled successfully' : 'Encryption disabled successfully' 
      });
    }
  );
});

// Get completion settings
app.get('/api/completion/settings', authenticateToken, (req, res) => {
  getFamilyDbById(req.user.id, (err, familyDb, familyName) => {
    if (err) {
      console.error('Error getting family database:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    familyDb.get('SELECT * FROM completion_settings ORDER BY id DESC LIMIT 1', [], (err, settings) => {
      if (err) {
        console.error('Database error fetching completion settings:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!settings) {
        // Return default settings if none exist
        return res.json({
          showMissingRequired: false,
          requireName: true,
          requireSurname: true,
          requireMaidenName: true,
          requireBirthDate: true,
          requireStreetFields: true,
          requireCityZip: true,
          requireCountry: true,
          requirePhone: true,
          requireEmail: true
        });
      }

      res.json({
        showMissingRequired: Boolean(settings.show_missing_required),
        requireName: Boolean(settings.require_name),
        requireSurname: Boolean(settings.require_surname),
        requireMaidenName: Boolean(settings.require_maiden_name),
        requireBirthDate: Boolean(settings.require_birth_date),
        requireStreetFields: Boolean(settings.require_street_fields),
        requireCityZip: Boolean(settings.require_city_zip),
        requireCountry: Boolean(settings.require_country),
        requirePhone: Boolean(settings.require_phone),
        requireEmail: Boolean(settings.require_email)
      });
    });
  });
});

// Update completion settings
app.post('/api/completion/settings', authenticateToken, (req, res) => {
  const {
    showMissingRequired,
    requireName,
    requireSurname,
    requireMaidenName,
    requireBirthDate,
    requireStreetFields,
    requireCityZip,
    requireCountry,
    requirePhone,
    requireEmail
  } = req.body;

  getFamilyDbById(req.user.id, (err, familyDb, familyName) => {
    if (err) {
      console.error('Error getting family database:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    // Check if settings exist
    familyDb.get('SELECT id FROM completion_settings LIMIT 1', [], (err, existingSettings) => {
      if (err) {
        console.error('Database error checking completion settings:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      const query = existingSettings
        ? `UPDATE completion_settings SET 
             show_missing_required = ?,
             require_name = ?,
             require_surname = ?,
             require_maiden_name = ?,
             require_birth_date = ?,
             require_street_fields = ?,
             require_city_zip = ?,
             require_country = ?,
             require_phone = ?,
             require_email = ?,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        : `INSERT INTO completion_settings (
             show_missing_required, require_name, require_surname, require_maiden_name,
             require_birth_date, require_street_fields, require_city_zip, require_country,
             require_phone, require_email
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const params = [
        showMissingRequired ? 1 : 0,
        requireName ? 1 : 0,
        requireSurname ? 1 : 0,
        requireMaidenName ? 1 : 0,
        requireBirthDate ? 1 : 0,
        requireStreetFields ? 1 : 0,
        requireCityZip ? 1 : 0,
        requireCountry ? 1 : 0,
        requirePhone ? 1 : 0,
        requireEmail ? 1 : 0
      ];

      if (existingSettings) {
        params.push(existingSettings.id);
      }

      familyDb.run(query, params, function(err) {
        if (err) {
          console.error('Database error updating completion settings:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        res.json({ 
          success: true, 
          message: 'Completion settings updated successfully' 
        });
      });
    });
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
      
      // Join the family-specific room using family name (not family ID)
      const roomName = familyName;
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
  const familyName = req.user.familyName;
  
  try {
    const familyDb = getFamilyDb(familyName);
    familyDb.all("SELECT * FROM nodes", [], (err, rows) => {
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
          street: row.street,
          housenumber: row.housenumber,
          city: row.city,
          zip: row.zip,
          country: row.country,
          phone: row.phone,
          email: row.email,
          latitude: row.latitude,
          longitude: row.longitude,
          addressHash: row.address_hash,  // Convert to camelCase
          lastGeocoded: row.last_geocoded,  // Add missing field
          bloodline: Boolean(row.bloodline),
          preferredImageId: row.preferred_image_id
          // isSelected removed - this is client-only UI state
      }
    }));
    
    res.json(nodes);
    });
  } catch (error) {
    console.error('Error getting family database:', error);
    res.status(500).json({ error: 'Failed to get nodes' });
  }
});

// Get all edges
app.get('/api/edges', authenticateToken, (req, res) => {
  const familyId = req.user.id;
  const familyName = req.user.familyName;
  
  try {
    const familyDb = getFamilyDb(familyName);
    familyDb.all("SELECT * FROM edges", [], (err, rows) => {
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
  } catch (error) {
    console.error('Error getting family database:', error);
    res.status(500).json({ error: 'Failed to get edges' });
  }
});

// Create new node
app.post('/api/nodes', authenticateToken, async (req, res) => {
  const { id, type, position, data } = req.body;
  const familyId = req.user.id;
  const familyName = req.user.familyName;
  const socketId = req.headers['x-socket-id']; // Get socket ID from request header
  
  try {
    // Check if node creation is locked
    const lockStatus = await new Promise((resolve, reject) => {
      authDb.get('SELECT node_creation_locked FROM users WHERE id = ?', [familyId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (lockStatus && lockStatus.node_creation_locked) {
      return res.status(403).json({ 
        error: 'Node creation is currently locked by the administrator. Please contact the admin to unlock node creation.',
        locked: true 
      });
    }
    
    const familyDb = getFamilyDb(familyName);
    
    // Note: Geocoding is now handled client-side
    // Accept latitude, longitude, addressHash, and lastGeocoded from client
    familyDb.run(`INSERT INTO nodes (
      id, type, position_x, position_y, name, surname, maiden_name, birth_date, death_date,
      street, housenumber, city, zip, country, phone, email, latitude, longitude, address_hash, last_geocoded,
      bloodline, preferred_image_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, type, position.x, position.y, data.name, data.surname, data.maidenName,
      data.birthDate, data.deathDate, data.street, data.housenumber, data.city, data.zip, data.country, data.phone,
      data.email, data.latitude, data.longitude, data.addressHash, data.lastGeocoded,
      data.bloodline ? 1 : 0, data.preferredImageId || null
    ], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Create the full node object for broadcasting
      const newNode = {
        id, type, position, 
        data: data,
        deletable: true,
        selectable: true
      };
    
      // Broadcast to ALL users in the family room (including the sender)
      // The client-side duplicate check will prevent duplicates
      const ioInstance = req.app.get('io');
      console.log(`[CREATE NODE] Broadcasting node:created to ${familyName}, Node ID: ${id}`);
      ioInstance.to(familyName).emit('node:created', newNode);
      
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
  const familyName = req.user.familyName;
  const socketId = req.headers['x-socket-id']; // Get socket ID from request header
  
  try {
    const familyDb = getFamilyDb(familyName);
    
    // Check if node exists
    const getCurrentNode = () => {
      return new Promise((resolve, reject) => {
        familyDb.get('SELECT * FROM nodes WHERE id = ?', [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    };
    
    const currentNode = await getCurrentNode();
    
    if (!currentNode) {
      return res.status(404).json({ error: 'Node not found or access denied' });
    }
    
    // Handle partial updates (e.g., geocoding updates latitude/longitude/addressHash/lastGeocoded)
    // vs full updates (data object with all fields)
    let updateQuery;
    let updateParams;
    
    if (data) {
      // Full update with data object
      updateQuery = `UPDATE nodes SET 
        position_x = ?, position_y = ?, name = ?, surname = ?, maiden_name = ?, birth_date = ?,
        death_date = ?, street = ?, housenumber = ?, city = ?, zip = ?, country = ?, phone = ?, email = ?,
        latitude = ?, longitude = ?, address_hash = ?, last_geocoded = ?,
        bloodline = ?, preferred_image_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`;
      updateParams = [
        position?.x, position?.y, data.name, data.surname, data.maidenName, data.birthDate,
        data.deathDate, data.street, data.housenumber, data.city, data.zip, data.country, data.phone, data.email,
        data.latitude, data.longitude, data.addressHash, data.lastGeocoded,
        data.bloodline ? 1 : 0, data.preferredImageId || null, id
      ];
    } else {
      // Partial update - build dynamic query based on provided fields
      const updates = [];
      const params = [];
      
      if (position !== undefined) {
        if (position.x !== undefined) {
          updates.push('position_x = ?');
          params.push(position.x);
        }
        if (position.y !== undefined) {
          updates.push('position_y = ?');
          params.push(position.y);
        }
      }
      
      // Handle root-level geocoding fields (from geocodingService)
      if (req.body.latitude !== undefined) {
        updates.push('latitude = ?');
        params.push(req.body.latitude);
      }
      if (req.body.longitude !== undefined) {
        updates.push('longitude = ?');
        params.push(req.body.longitude);
      }
      if (req.body.addressHash !== undefined) {
        updates.push('address_hash = ?');
        params.push(req.body.addressHash);
      }
      if (req.body.lastGeocoded !== undefined) {
        updates.push('last_geocoded = ?');
        params.push(req.body.lastGeocoded);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      updates.push('updated_at = CURRENT_TIMESTAMP');
      updateQuery = `UPDATE nodes SET ${updates.join(', ')} WHERE id = ?`;
      params.push(id);
      updateParams = params;
    }
    
    // Note: Geocoding is now handled client-side
    // Accept latitude, longitude, addressHash, and lastGeocoded from client
    familyDb.run(updateQuery, updateParams, function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // After update, fetch the complete node from database to broadcast
      // This ensures all fields including geocoding data are included
      familyDb.get('SELECT * FROM nodes WHERE id = ?', [id], (fetchErr, updatedRow) => {
        if (fetchErr) {
          console.error('Error fetching updated node for broadcast:', fetchErr);
          // Still send response even if broadcast fails
          res.json({ success: true, changes: this.changes });
          return;
        }
        
        // Build complete updated node object from DB row
        const updatedNode = {
          id: updatedRow.id,
          type: updatedRow.type,
          position: { x: updatedRow.position_x, y: updatedRow.position_y },
          data: {
            name: updatedRow.name,
            surname: updatedRow.surname,
            maidenName: updatedRow.maiden_name,
            birthDate: updatedRow.birth_date,
            deathDate: updatedRow.death_date,
            city: updatedRow.city,
            zip: updatedRow.zip,
            country: updatedRow.country,
            phone: updatedRow.phone,
            email: updatedRow.email,
            latitude: updatedRow.latitude,
            longitude: updatedRow.longitude,
            addressHash: updatedRow.address_hash,
            lastGeocoded: updatedRow.last_geocoded,
            bloodline: Boolean(updatedRow.bloodline),
            preferredImageId: updatedRow.preferred_image_id
            // isSelected removed - this is client-only UI state
          }
        };
        
        // Broadcast the complete updated node to other users in the family room
        const ioInstance = req.app.get('io');
        if (socketId) {
          // Exclude the sender from receiving this event
          console.log(`[UPDATE NODE] Broadcasting node:updated to ${familyName}, Node ID: ${id}, excluding socket: ${socketId}`);
          ioInstance.to(familyName).except(socketId).emit('node:updated', updatedNode);
        } else {
          // Fallback: broadcast to all (for backwards compatibility)
          console.log(`[UPDATE NODE] Broadcasting node:updated to ${familyName}, Node ID: ${id} (no socket ID)`);
          ioInstance.to(familyName).emit('node:updated', updatedNode);
        }
        
        res.json({ success: true, changes: this.changes });
      });
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
  const familyName = req.user.familyName;
  
  try {
    const familyDb = getFamilyDb(familyName);
    familyDb.run(`UPDATE nodes SET preferred_image_id = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?`, 
    [imageId || null, personId], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Person not found' });
      }
      
      res.json({ success: true, personId, imageId: imageId || null });
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update preferred image' });
  }
});

// Delete node
app.delete('/api/nodes/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const familyId = req.user.id;
  const familyName = req.user.familyName;
  
  try {
    const familyDb = getFamilyDb(familyName);
    
    // First check if this family will have any nodes left after deletion
    familyDb.get("SELECT COUNT(*) as count FROM nodes", [], (err, result) => {
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
      
      // First delete all edges connected to this node
      familyDb.run("DELETE FROM edges WHERE (source = ? OR target = ?)", [id, id], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        // Then delete the node
        familyDb.run("DELETE FROM nodes WHERE id = ?", [id], function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          
          if (this.changes === 0) {
            res.status(404).json({ error: 'Node not found or access denied' });
            return;
          }
          
          // Broadcast the deletion to other users in the family room
          req.app.get('io').to(familyName).emit('node:deleted', { id });
          
          res.json({ success: true, changes: this.changes });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete node' });
  }
});

// Create new edge
app.post('/api/edges', authenticateToken, (req, res) => {
  const { id, source, target, sourceHandle, targetHandle, type } = req.body;
  const familyId = req.user.id;
  const familyName = req.user.familyName;
  const socketId = req.headers['x-socket-id']; // Get socket ID from request header
  
  // Basic validation
  if (!id || !source || !target || !type) {
    res.status(400).json({ error: 'Missing required fields: id, source, target, type' });
    return;
  }
  
  try {
    const familyDb = getFamilyDb(familyName);
    
    // Create edge normally without partner validation
    familyDb.run(`INSERT INTO edges (id, source, target, source_handle, target_handle, type)
      VALUES (?, ?, ?, ?, ?, ?)`, [id, source, target, sourceHandle, targetHandle, type], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Create the full edge object for broadcasting
      const newEdge = {
        id, source, target, sourceHandle, targetHandle, type,
        data: req.body.data || {}
      };
      
      // Broadcast to other users in the family room (exclude the sender)
      const ioInstance = req.app.get('io');
      if (socketId) {
        // Exclude the sender from receiving this event
        ioInstance.to(familyName).except(socketId).emit('edge:created', newEdge);
      } else {
        // Fallback: broadcast to all (for backwards compatibility)
        ioInstance.to(familyName).emit('edge:created', newEdge);
      }
      
      res.json({ success: true, edgeId: id });
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create edge' });
  }
});

// Delete edge
app.delete('/api/edges/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const familyId = req.user.id;
  const familyName = req.user.familyName;
  
  try {
    const familyDb = getFamilyDb(familyName);
    familyDb.run("DELETE FROM edges WHERE id = ?", [id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Broadcast the deletion to other users in the family room
      req.app.get('io').to(familyName).emit('edge:deleted', { id });
      
      res.json({ success: true, changes: this.changes });
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete edge' });
  }
});

// Update edge
app.put('/api/edges/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const familyId = req.user.id;
  const familyName = req.user.familyName;
  const socketId = req.headers['x-socket-id'];
  const { type, source, target, sourceHandle, targetHandle } = req.body;
  
  // Build dynamic update query based on provided fields
  const updates = [];
  const values = [];
  
  if (type !== undefined) {
    updates.push('type = ?');
    values.push(type);
  }
  if (source !== undefined) {
    updates.push('source = ?');
    values.push(source);
  }
  if (target !== undefined) {
    updates.push('target = ?');
    values.push(target);
  }
  if (sourceHandle !== undefined) {
    updates.push('source_handle = ?');
    values.push(sourceHandle);
  }
  if (targetHandle !== undefined) {
    updates.push('target_handle = ?');
    values.push(targetHandle);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  try {
    const familyDb = getFamilyDb(familyName);
    
    // Add WHERE clause values
    values.push(id);
    
    const sql = `UPDATE edges SET ${updates.join(', ')} WHERE id = ?`;
    
    familyDb.run(sql, values, function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Edge not found' });
      }
      
      // Fetch the updated edge to broadcast
      familyDb.get('SELECT * FROM edges WHERE id = ?', [id], (err, edge) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        // Create the full edge object for broadcasting
        const updatedEdge = {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.source_handle,
          targetHandle: edge.target_handle,
          type: edge.type,
          data: req.body.data || {}
        };
        
        // Broadcast to other users in the family room (exclude the sender)
        const ioInstance = req.app.get('io');
        if (socketId) {
          ioInstance.to(familyName).except(socketId).emit('edge:updated', updatedEdge);
      } else {
        ioInstance.to(familyName).emit('edge:updated', updatedEdge);
      }
      
      res.json({ success: true, edge: updatedEdge });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update edge' });
  }
});

// Reset database (clear all data for the authenticated user's family)
app.post('/api/reset', authenticateToken, (req, res) => {
  const familyName = req.user.familyName;
  const familyDb = getFamilyDb(familyName);

  try {
    familyDb.serialize(() => {
      // Clear all existing data in this family's database
      familyDb.run("DELETE FROM edges", (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
      });
      
      familyDb.run("DELETE FROM nodes", (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        res.json({ success: true, message: "Database reset successfully" });
      });
    });
  } catch (error) {
    console.error('Error resetting database:', error);
    res.status(500).json({ error: 'Failed to reset database' });
  }
});

// Manual cleanup endpoint
app.post('/api/cleanup', authenticateToken, (req, res) => {
  const familyName = req.user.familyName;
  const familyDb = getFamilyDb(familyName);

  try {
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
    familyDb.run("DELETE FROM nodes WHERE id IS NULL", function(err) {
      if (err) {
        res.status(500).json({ error: 'Error cleaning nodes: ' + err.message });
        return;
      }
      totalNullCleaned += this.changes;
      checkComplete();
    });
    
    // Remove edges with null id
    familyDb.run("DELETE FROM edges WHERE id IS NULL", function(err) {
      if (err) {
        res.status(500).json({ error: 'Error cleaning edges: ' + err.message });
        return;
      }
      totalNullCleaned += this.changes;
      checkComplete();
    });
    
    // Remove edges with null source or target references
    familyDb.run("DELETE FROM edges WHERE source IS NULL OR target IS NULL", function(err) {
      if (err) {
        res.status(500).json({ error: 'Error cleaning edge references: ' + err.message });
        return;
      }
      totalNullCleaned += this.changes;
      checkComplete();
    });

    // Remove self-loop edges (edges that connect a node with itself)
    familyDb.run("DELETE FROM edges WHERE source = target", function(err) {
      if (err) {
        res.status(500).json({ error: 'Error cleaning self-loop edges: ' + err.message });
        return;
      }
      totalSelfLoopsCleaned = this.changes;
      checkComplete();
    });

    // Clean up orphaned image_people entries
    familyDb.run(`DELETE FROM image_people WHERE image_id NOT IN (SELECT id FROM images)`, function(err) {
      if (err) {
        res.status(500).json({ error: 'Error cleaning orphaned image_people: ' + err.message });
        return;
      }
      totalOrphanedImagesCleaned += this.changes;
      checkComplete();
    });

    // Clean up image_people entries that reference non-existent people/nodes
    familyDb.run(`DELETE FROM image_people WHERE person_id NOT IN (SELECT id FROM nodes)`, function(err) {
      if (err) {
        res.status(500).json({ error: 'Error cleaning orphaned image_people person references: ' + err.message });
        return;
      }
      totalOrphanedImagesCleaned += this.changes;
      checkComplete();
    });

    // Clean up orphaned preferred image references
    familyDb.run(`UPDATE nodes SET preferred_image_id = NULL 
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
    
    familyDb.all(duplicateQuery, (err, duplicateEdges) => {
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
      
      familyDb.run(`DELETE FROM edges WHERE id IN (${placeholders})`, idsToDelete, function(err) {
        if (err) {
          res.status(500).json({ error: 'Error deleting duplicate edges: ' + err.message });
          return;
        }
        totalDuplicatesCleaned = this.changes;
        checkComplete();
      });
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    res.status(500).json({ error: 'Failed to complete cleanup' });
  }
});

// Test endpoint to create self-loop edges for testing cleanup (development only)
app.post('/api/test/create-self-loops', authenticateToken, (req, res) => {
  const familyName = req.user.familyName;
  const familyDb = getFamilyDb(familyName);

  try {
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
      familyDb.run(
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
  } catch (error) {
    console.error('Error creating test edges:', error);
    res.status(500).json({ error: 'Failed to create test edges' });
  }
});

// ============= IMAGE ENDPOINTS =============

// Upload image
app.post('/api/images/upload', authenticateToken, (req, res) => {
  const familyId = req.user.id;
  const familyName = req.user.familyName;
  
  // Check if AWS credentials are configured before attempting upload
  if (!AWS_CREDENTIALS_CONFIGURED) {
    console.error('Image upload attempted but AWS credentials are not configured');
    return res.status(500).json({ 
      error: 'Server configuration error: AWS S3 credentials not configured. Please contact the administrator.',
      code: 'AWS_NOT_CONFIGURED',
      adminMessage: 'Configure AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and S3_BUCKET_NAME in the .env file'
    });
  }
  
  // Use multer upload middleware with error handling
  upload.single('image')(req, res, function(err) {
    // Handle multer errors
    if (err) {
      console.error('Multer error:', err);
      
      if (err instanceof multer.MulterError) {
        // Multer-specific errors
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ 
            error: 'File too large. Maximum file size is 10MB.',
            code: 'FILE_TOO_LARGE'
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ 
            error: 'Unexpected file field.',
            code: 'INVALID_FIELD'
          });
        }
        return res.status(400).json({ 
          error: `Upload error: ${err.message}`,
          code: 'UPLOAD_ERROR'
        });
      }
      
      // File filter errors
      if (err.message.includes('Only image files')) {
        return res.status(400).json({ 
          error: 'Only image files are allowed (JPEG, PNG, GIF, WebP).',
          code: 'INVALID_FILE_TYPE'
        });
      }
      
      // S3 or other errors - provide more helpful messages
      let errorMessage = err.message;
      let errorCode = 'UPLOAD_FAILED';
      
      // Check for common AWS S3 errors
      if (err.message.includes('Access Denied') || err.code === 'AccessDenied') {
        errorMessage = 'AWS S3 Access Denied. Please check that AWS credentials are correctly configured.';
        errorCode = 'S3_ACCESS_DENIED';
        console.error('S3 Access Denied - Possible causes:');
        console.error('  1. AWS credentials are missing or incorrect in .env file');
        console.error('  2. IAM user does not have S3 permissions');
        console.error('  3. S3 bucket does not exist or is in a different region');
      } else if (err.message.includes('Network') || err.code === 'NetworkingError') {
        errorMessage = 'Network error connecting to AWS S3. Please check your internet connection.';
        errorCode = 'S3_NETWORK_ERROR';
      } else if (err.message.includes('NoSuchBucket')) {
        errorMessage = 'S3 bucket does not exist. Please check S3_BUCKET_NAME in configuration.';
        errorCode = 'S3_BUCKET_NOT_FOUND';
      }
      
      return res.status(500).json({ 
        error: errorMessage,
        code: errorCode,
        originalError: err.message
      });
    }
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No image file provided.',
        code: 'NO_FILE'
      });
    }

    try {
      const familyDb = getFamilyDb(familyName);
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

      familyDb.run(`INSERT INTO images (
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
          return res.status(500).json({ 
            error: `Database error: ${err.message}`,
            code: 'DATABASE_ERROR'
          });
        }

        res.json({
          success: true,
          image: imageData
        });
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      res.status(500).json({ error: 'Failed to upload image' });
    }
  });
});

// Get all images
app.get('/api/images', authenticateToken, (req, res) => {
  const familyName = req.user.familyName;
  
  try {
    const familyDb = getFamilyDb(familyName);
    familyDb.all(`SELECT i.*, 
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
      LEFT JOIN image_people ip ON i.id = ip.image_id
      LEFT JOIN nodes n ON ip.person_id = n.id
      GROUP BY i.id
      ORDER BY i.created_at DESC`, 
    [], (err, rows) => {
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
          has_open_questions: row.has_open_questions || false,
          people: people
        };
      });

      res.json(images);
    });
  } catch (error) {
    console.error('Error getting images:', error);
    res.status(500).json({ error: 'Failed to get images' });
  }
});

// Get specific image with people
app.get('/api/images/:id', authenticateToken, (req, res) => {
  const imageId = req.params.id;
  const familyName = req.user.familyName;
  
  try {
    const familyDb = getFamilyDb(familyName);
    familyDb.get(`SELECT * FROM images WHERE id = ?`, [imageId], (err, imageRow) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!imageRow) {
        return res.status(404).json({ error: 'Image not found' });
      }

      // Get associated people
      familyDb.all(`SELECT ip.*, n.name, n.surname 
              FROM image_people ip 
              JOIN nodes n ON ip.person_id = n.id 
              WHERE ip.image_id = ?`, 
      [imageId], (err, peopleRows) => {
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
          has_open_questions: imageRow.has_open_questions || false,
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
  } catch (error) {
    console.error('Error getting image:', error);
    res.status(500).json({ error: 'Failed to get image' });
  }
});

// Add person to image (tag person in image)
app.post('/api/images/:imageId/people', authenticateToken, (req, res) => {
  const { imageId } = req.params;
  const { personId, positionX, positionY, width, height } = req.body;
  const familyName = req.user.familyName;

  if (!personId) {
    return res.status(400).json({ error: 'Person ID is required' });
  }

  try {
    const familyDb = getFamilyDb(familyName);
    familyDb.run(`INSERT INTO image_people (image_id, person_id, position_x, position_y, width, height)
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
  } catch (error) {
    console.error('Error adding person to image:', error);
    res.status(500).json({ error: 'Failed to add person to image' });
  }
});

// Remove person from image
app.delete('/api/images/:imageId/people/:personId', authenticateToken, (req, res) => {
  const { imageId, personId } = req.params;
  const familyName = req.user.familyName;

  try {
    const familyDb = getFamilyDb(familyName);
    familyDb.run(`DELETE FROM image_people WHERE image_id = ? AND person_id = ?`, 
    [imageId, personId], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Person tag not found in image' });
      }

      res.json({ success: true, message: 'Person removed from image' });
    });
  } catch (error) {
    console.error('Error removing person from image:', error);
    res.status(500).json({ error: 'Failed to remove person from image' });
  }
});

// Update person position in image
app.put('/api/images/:imageId/people/:personId', authenticateToken, (req, res) => {
  const { imageId, personId } = req.params;
  const { positionX, positionY, width, height } = req.body;
  const familyName = req.user.familyName;

  try {
    const familyDb = getFamilyDb(familyName);
    familyDb.run(`UPDATE image_people 
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
  } catch (error) {
    console.error('Error updating person position:', error);
    res.status(500).json({ error: 'Failed to update person position' });
  }
});

// Update image (supports all fields for encryption batch operations)
app.put('/api/images/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const familyName = req.user.familyName;
  
  // Accept any of these fields for update
  const {
    description,
    filename,
    originalFilename,
    s3Key,
    s3Url,
    uploadedBy,
    fileSize,
    mimeType,
    uploadDate
  } = req.body;

  try {
    const familyDb = getFamilyDb(familyName);
    
    // Build dynamic UPDATE query based on provided fields
    const updates = [];
    const values = [];
    
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (filename !== undefined) {
      updates.push('filename = ?');
      values.push(filename);
    }
    if (originalFilename !== undefined) {
      updates.push('original_filename = ?');
      values.push(originalFilename);
    }
    if (s3Key !== undefined) {
      updates.push('s3_key = ?');
      values.push(s3Key);
    }
    if (s3Url !== undefined) {
      updates.push('s3_url = ?');
      values.push(s3Url);
    }
    if (uploadedBy !== undefined) {
      updates.push('uploaded_by = ?');
      values.push(uploadedBy);
    }
    if (fileSize !== undefined) {
      updates.push('file_size = ?');
      values.push(fileSize);
    }
    if (mimeType !== undefined) {
      updates.push('mime_type = ?');
      values.push(mimeType);
    }
    if (uploadDate !== undefined) {
      updates.push('upload_date = ?');
      values.push(uploadDate);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }
    
    // Always update the updated_at timestamp
    updates.push('updated_at = CURRENT_TIMESTAMP');
    
    // Add the id at the end for the WHERE clause
    values.push(id);
    
    const query = `UPDATE images SET ${updates.join(', ')} WHERE id = ?`;
    
    familyDb.run(query, values, function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Image not found' });
      }

      res.json({ success: true, message: 'Image updated successfully' });
    });
  } catch (error) {
    console.error('Error updating image:', error);
    res.status(500).json({ error: 'Failed to update image' });
  }
});

// Toggle has_open_questions field for an image
app.put('/api/images/:id/question', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { hasOpenQuestions } = req.body;
  const familyName = req.user.familyName;

  if (typeof hasOpenQuestions !== 'boolean') {
    return res.status(400).json({ error: 'hasOpenQuestions must be a boolean value' });
  }

  try {
    const familyDb = getFamilyDb(familyName);
    
    familyDb.run(
      'UPDATE images SET has_open_questions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hasOpenQuestions ? 1 : 0, id],
      function(err) {
        if (err) {
          console.error('Error updating image question status:', err);
          return res.status(500).json({ error: err.message });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Image not found' });
        }

        // Emit Socket.IO event for real-time updates
        console.log(`[Socket.IO] Emitting imageQuestionToggled to room: ${familyName}, imageId: ${id}, hasOpenQuestions: ${hasOpenQuestions}`);
        io.to(familyName).emit('imageQuestionToggled', {
          imageId: id,
          hasOpenQuestions
        });

        res.json({ success: true, hasOpenQuestions });
      }
    );
  } catch (error) {
    console.error('Error toggling image question:', error);
    res.status(500).json({ error: 'Failed to toggle image question' });
  }
});

// Image proxy endpoint for downloading images from S3 (solves CORS issues)
app.post('/api/images/proxy', authenticateToken, async (req, res) => {
  const { s3Url } = req.body;
  
  if (!s3Url) {
    return res.status(400).json({ error: 'S3 URL is required' });
  }
  
  try {
    // Extract S3 key from URL
    // URL format: https://bucket-name.s3.region.amazonaws.com/images/filename.jpg
    const urlParts = new URL(s3Url);
    const s3Key = urlParts.pathname.substring(1); // Remove leading slash
    
    console.log(`[Image Proxy] Fetching image from S3: ${s3Key}`);
    
    // Fetch from S3
    const params = {
      Bucket: S3_BUCKET_NAME,
      Key: s3Key
    };
    
    const data = await s3.getObject(params).promise();
    
    // Set appropriate headers
    res.set('Content-Type', data.ContentType || 'image/jpeg');
    res.set('Content-Length', data.ContentLength);
    res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.set('Access-Control-Allow-Origin', '*'); // Allow CORS
    
    // Send image data as binary
    res.send(data.Body);
    
  } catch (error) {
    console.error('[Image Proxy] Error fetching image:', error);
    
    if (error.code === 'NoSuchKey') {
      return res.status(404).json({ error: 'Image not found in S3' });
    }
    
    res.status(500).json({ error: 'Failed to fetch image from S3' });
  }
});

// Delete image (also removes from S3)
app.delete('/api/images/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const familyName = req.user.familyName;

  try {
    const familyDb = getFamilyDb(familyName);
    
    // Delete from database only (this will cascade delete image_people records)
    // Note: S3 files are NOT deleted to allow encrypted s3_key/s3_url in database
    familyDb.run(`DELETE FROM images WHERE id = ?`, [id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Image not found' });
      }

      res.json({ 
        success: true, 
        message: 'Image deleted successfully'
      });
    });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Fetch images for a specific person
app.get('/api/people/:personId/images', authenticateToken, (req, res) => {
  const { personId } = req.params;
  const familyName = req.user.familyName;
  const familyDb = getFamilyDb(familyName);

  try {
    const query = `
      SELECT i.id, i.s3_url, i.description, i.original_filename, i.created_at, i.has_open_questions
      FROM images i
      INNER JOIN image_people ip ON i.id = ip.image_id
      WHERE ip.person_id = ?
      ORDER BY i.created_at DESC
    `;

    familyDb.all(query, [personId], (err, rows) => {
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
        familyDb.all(`
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
              has_open_questions: row.has_open_questions || false,
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
  } catch (error) {
    console.error('Error fetching images for person:', error);
    res.status(500).json({ error: 'Failed to fetch images for person' });
  }
});

// === CHAT ENDPOINTS ===

// Get chat messages for a specific image
app.get('/api/images/:imageId/chat', authenticateToken, (req, res) => {
  const { imageId } = req.params;
  const familyName = req.user.familyName;
  const familyDb = getFamilyDb(familyName);

  try {
    const query = `
      SELECT id, user_name, message, created_at
      FROM chat_messages 
      WHERE image_id = ?
      ORDER BY created_at ASC
    `;

    familyDb.all(query, [imageId], (err, rows) => {
      if (err) {
        console.error('Database error in /api/images/:imageId/chat:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }

      const messages = rows.map(row => {
        let createdAt;
        
        // If createdAt is encrypted, return as-is (client will decrypt)
        if (row.created_at && typeof row.created_at === 'string' && row.created_at.startsWith('enc:')) {
          createdAt = row.created_at;
        } else {
          // Parse unencrypted dates
          try {
            // Handle SQLite datetime format (YYYY-MM-DD HH:MM:SS)
            if (row.created_at) {
              // If it doesn't already have 'Z' and doesn't include 'T', treat as UTC SQLite format
              if (!row.created_at.includes('T') && !row.created_at.endsWith('Z')) {
                createdAt = new Date(row.created_at + 'Z').toISOString();
              } else {
                createdAt = new Date(row.created_at).toISOString();
              }
            } else {
              createdAt = new Date().toISOString();
            }
          } catch (e) {
            console.error('Error parsing date:', row.created_at, e);
            createdAt = new Date().toISOString();
          }
        }
        
        return {
          id: row.id,
          userName: row.user_name,
          message: row.message,
          createdAt: createdAt
        };
      });

      res.json(messages);
    });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
});

// Post a new chat message for an image
app.post('/api/images/:imageId/chat', authenticateToken, (req, res) => {
  const { imageId } = req.params;
  const { userName, message } = req.body;
  const familyName = req.user.familyName;
  const familyId = req.user.id;
  const familyDb = getFamilyDb(familyName);

  try {
    if (!userName || !message) {
      return res.status(400).json({ error: 'User name and message are required' });
    }

    if (message.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (userName.trim().length === 0) {
      return res.status(400).json({ error: 'User name cannot be empty' });
    }

    // Verify the image exists
    familyDb.get('SELECT id FROM images WHERE id = ?', [imageId], (err, row) => {
      if (err) {
        console.error('Database error checking image:', err.message);
        return res.status(500).json({ error: err.message });
      }

      if (!row) {
        return res.status(404).json({ error: 'Image not found' });
      }

      // Insert the new chat message
      const query = `
        INSERT INTO chat_messages (image_id, user_name, message, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `;

      familyDb.run(query, [imageId, userName.trim(), message.trim()], function(err) {
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
        req.app.get('io').to(familyName).emit('chat:message', {
          imageId: imageId,
          message: newMessage
        });

        res.json({
          success: true,
          message: newMessage
        });
      });
    });
  } catch (error) {
    console.error('Error posting chat message:', error);
    res.status(500).json({ error: 'Failed to post chat message' });
  }
});

// Delete a chat message (optional - allows users to delete their own messages)
app.delete('/api/images/:imageId/chat/:messageId', authenticateToken, (req, res) => {
  const { imageId, messageId } = req.params;
  const familyName = req.user.familyName;
  const familyId = req.user.id;
  const familyDb = getFamilyDb(familyName);

  try {
    // Verify the message exists and delete it
    const query = `
      DELETE FROM chat_messages 
      WHERE id = ? AND image_id = ?
    `;

    familyDb.run(query, [messageId, imageId], function(err) {
      if (err) {
        console.error('Database error in /api/images/:imageId/chat/:messageId DELETE:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Message not found' });
      }

      // Emit the message deletion to all clients in this family room
      req.app.get('io').to(familyName).emit('chat:messageDeleted', {
        imageId: imageId,
        messageId: messageId
      });

      res.json({ success: true, message: 'Chat message deleted successfully' });
    });
  } catch (error) {
    console.error('Error deleting chat message:', error);
    res.status(500).json({ error: 'Failed to delete chat message' });
  }
});

// Get ALL chat messages (for batch encryption operations)
app.get('/api/chat-messages', authenticateToken, (req, res) => {
  const familyName = req.user.familyName;
  const familyDb = getFamilyDb(familyName);

  try {
    const query = `
      SELECT id, image_id, user_name, message, created_at
      FROM chat_messages 
      ORDER BY created_at ASC
    `;

    familyDb.all(query, [], (err, rows) => {
      if (err) {
        console.error('Database error in /api/chat-messages:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }

      const messages = rows.map(row => {
        let createdAt;
        
        // If createdAt is encrypted, return as-is (client will decrypt)
        if (row.created_at && typeof row.created_at === 'string' && row.created_at.startsWith('enc:')) {
          createdAt = row.created_at;
        } else {
          // Parse unencrypted dates
          try {
            // Handle SQLite datetime format (YYYY-MM-DD HH:MM:SS)
            if (row.created_at) {
              // If it doesn't already have 'Z' and doesn't include 'T', treat as UTC SQLite format
              if (!row.created_at.includes('T') && !row.created_at.endsWith('Z')) {
                createdAt = new Date(row.created_at + 'Z').toISOString();
              } else {
                createdAt = new Date(row.created_at).toISOString();
              }
            } else {
              createdAt = new Date().toISOString();
            }
          } catch (e) {
            console.error('Error parsing date:', row.created_at, e);
            createdAt = new Date().toISOString();
          }
        }
        
        return {
          id: row.id,
          imageId: row.image_id,
          userName: row.user_name,
          message: row.message,
          createdAt: createdAt
        };
      });

      res.json(messages);
    });
  } catch (error) {
    console.error('Error fetching all chat messages:', error);
    res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
});

// Update chat message (for batch encryption operations)
app.put('/api/chat-messages/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const familyName = req.user.familyName;
  const { userName, message, createdAt } = req.body;

  try {
    const familyDb = getFamilyDb(familyName);
    
    // Build dynamic UPDATE query based on provided fields
    const updates = [];
    const values = [];
    
    if (userName !== undefined) {
      updates.push('user_name = ?');
      values.push(userName);
    }
    if (message !== undefined) {
      updates.push('message = ?');
      values.push(message);
    }
    if (createdAt !== undefined) {
      updates.push('created_at = ?');
      values.push(createdAt);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }
    
    // Add the id at the end for the WHERE clause
    values.push(id);
    
    const query = `UPDATE chat_messages SET ${updates.join(', ')} WHERE id = ?`;
    
    familyDb.run(query, values, function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Chat message not found' });
      }

      res.json({ success: true, message: 'Chat message updated successfully' });
    });
  } catch (error) {
    console.error('Error updating chat message:', error);
    res.status(500).json({ error: 'Failed to update chat message' });
  }
});

// Catch-all handler: send back React's index.html file for production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'dist/index.html');
    res.sendFile(indexPath);
  });
}

// Migration: Move purpose and display_name from auth DB to family DB admin table
function migrateAdminSettingsToFamilyDb() {
  console.log('[Migration] Starting admin settings migration...');
  
  authDb.all('SELECT id, family_name, display_name, purpose FROM users', [], (err, families) => {
    if (err) {
      console.error('[Migration] Error fetching families for migration:', err);
      return;
    }
    
    if (!families || families.length === 0) {
      console.log('[Migration] No families to migrate');
      return;
    }
    
    let migratedCount = 0;
    
    families.forEach((family) => {
      try {
        const familyDb = getFamilyDb(family.family_name);
        
        // Check if admin table exists and has data
        familyDb.all('SELECT key FROM admin', [], (err, rows) => {
          if (err) {
            console.error(`[Migration] Error checking admin table for family ${family.family_name}:`, err);
            return;
          }
          
          const existingKeys = rows ? rows.map(r => r.key) : [];
          
          // Migrate display_name if it exists and is not already migrated
          if (family.display_name && !existingKeys.includes('display_name')) {
            familyDb.run(
              'INSERT INTO admin (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
              ['display_name', family.display_name],
              (err) => {
                if (err) {
                  console.error(`[Migration] Error migrating display_name for family ${family.family_name}:`, err);
                } else {
                  console.log(`[Migration] Migrated display_name for family ${family.family_name}`);
                }
              }
            );
          }
          
          // Migrate purpose if it exists and is not already migrated
          if (family.purpose && !existingKeys.includes('purpose')) {
            familyDb.run(
              'INSERT INTO admin (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
              ['purpose', family.purpose],
              (err) => {
                if (err) {
                  console.error(`[Migration] Error migrating purpose for family ${family.family_name}:`, err);
                } else {
                  console.log(`[Migration] Migrated purpose for family ${family.family_name}`);
                }
              }
            );
          }
          
          migratedCount++;
          if (migratedCount === families.length) {
            console.log(`[Migration] Admin settings migration completed for ${families.length} families`);
          }
        });
      } catch (error) {
        console.error(`[Migration] Error migrating family ${family.family_name}:`, error);
      }
    });
  });
}

// Run migration on startup
migrateAdminSettingsToFamilyDb();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Server also available on local network at http://[your-ip]:${PORT}`);
  console.log(`Socket.IO enabled for real-time collaboration`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});