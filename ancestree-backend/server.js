// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
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

// Presigned URL configuration
const PRESIGNED_URL_EXPIRY_UPLOAD = 300; // 5 minutes for uploads
const PRESIGNED_URL_EXPIRY_VIEW = 3600; // 1 hour for viewing

// Helper function to generate presigned upload URL
function generatePresignedUploadUrl(s3Key, contentType) {
  const params = {
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
    ContentType: contentType,
    Expires: PRESIGNED_URL_EXPIRY_UPLOAD
  };
  return s3.getSignedUrl('putObject', params);
}

// Helper function to generate presigned view URL
function generatePresignedViewUrl(s3Key) {
  const params = {
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
    Expires: PRESIGNED_URL_EXPIRY_VIEW
  };
  return s3.getSignedUrl('getObject', params);
}

// Grace periods for soft delete (in days)
const GRACE_PERIOD_USER_DELETION = 10; // 10 days for user-initiated deletion
const GRACE_PERIOD_SERVER_DELETION = 1; // 1 day for server-initiated deletion

/**
 * Delete all S3 objects under a family prefix
 * @param {string} familyName - The family name (used as prefix)
 * @returns {Promise<{deleted: number, errors: number}>}
 */
async function deleteAllFamilyImages(familyName) {
  if (!AWS_CREDENTIALS_CONFIGURED) {
    console.log(`[S3 Cleanup] AWS not configured, skipping S3 deletion for family: ${familyName}`);
    return { deleted: 0, errors: 0, skipped: true };
  }
  
  const prefix = `images/${familyName}/`;
  let totalDeleted = 0;
  let totalErrors = 0;
  let continuationToken = null;
  
  console.log(`[S3 Cleanup] Starting deletion of all objects with prefix: ${prefix}`);
  
  try {
    do {
      // List objects with the family prefix
      const listParams = {
        Bucket: S3_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken
      };
      
      const listedObjects = await s3.listObjectsV2(listParams).promise();
      
      if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
        console.log(`[S3 Cleanup] No objects found with prefix: ${prefix}`);
        break;
      }
      
      console.log(`[S3 Cleanup] Found ${listedObjects.Contents.length} objects to delete`);
      
      // Delete objects in batch
      const deleteParams = {
        Bucket: S3_BUCKET_NAME,
        Delete: {
          Objects: listedObjects.Contents.map(({ Key }) => ({ Key })),
          Quiet: false
        }
      };
      
      const deleteResult = await s3.deleteObjects(deleteParams).promise();
      
      if (deleteResult.Deleted) {
        totalDeleted += deleteResult.Deleted.length;
      }
      if (deleteResult.Errors) {
        totalErrors += deleteResult.Errors.length;
        deleteResult.Errors.forEach(err => {
          console.error(`[S3 Cleanup] Error deleting ${err.Key}: ${err.Message}`);
        });
      }
      
      continuationToken = listedObjects.IsTruncated ? listedObjects.NextContinuationToken : null;
      
    } while (continuationToken);
    
    console.log(`[S3 Cleanup] Completed deletion for ${familyName}: ${totalDeleted} deleted, ${totalErrors} errors`);
    return { deleted: totalDeleted, errors: totalErrors };
    
  } catch (error) {
    console.error(`[S3 Cleanup] Error deleting family images for ${familyName}:`, error);
    return { deleted: totalDeleted, errors: totalErrors + 1, error: error.message };
  }
}

/**
 * Migrate images from flat structure to family prefix structure
 * @param {string} familyName - The family name
 * @returns {Promise<{migrated: number, errors: number, skipped: number}>}
 */
async function migrateImagesToFamilyPrefix(familyName) {
  if (!AWS_CREDENTIALS_CONFIGURED) {
    console.log(`[S3 Migration] AWS not configured, skipping migration for family: ${familyName}`);
    return { migrated: 0, errors: 0, skipped: 0, awsNotConfigured: true };
  }
  
  const familyDb = getFamilyDb(familyName);
  
  return new Promise((resolve, reject) => {
    // Get all images for this family
    familyDb.all('SELECT id, s3_key, s3_url FROM images', async (err, images) => {
      if (err) {
        console.error(`[S3 Migration] Error fetching images for ${familyName}:`, err);
        return reject(err);
      }
      
      if (!images || images.length === 0) {
        console.log(`[S3 Migration] No images found for family: ${familyName}`);
        return resolve({ migrated: 0, errors: 0, skipped: 0 });
      }
      
      let migrated = 0;
      let errors = 0;
      let skipped = 0;
      
      console.log(`[S3 Migration] Processing ${images.length} images for family: ${familyName}`);
      
      for (const image of images) {
        try {
          const currentKey = image.s3_key;
          
          // Skip encrypted keys (can't migrate these)
          if (!currentKey || currentKey.startsWith('enc:')) {
            console.log(`[S3 Migration] Skipping encrypted/null key for image ${image.id}`);
            skipped++;
            continue;
          }
          
          // Check if already migrated (key already has family prefix)
          if (currentKey.startsWith(`images/${familyName}/`)) {
            console.log(`[S3 Migration] Image ${image.id} already migrated, skipping`);
            skipped++;
            continue;
          }
          
          // Parse the current key to get the filename
          // Old format: images/uuid.ext
          const keyParts = currentKey.split('/');
          const filename = keyParts[keyParts.length - 1];
          const newKey = `images/${familyName}/${filename}`;
          
          console.log(`[S3 Migration] Migrating image ${image.id}: ${currentKey} -> ${newKey}`);
          
          // Copy object to new location
          await s3.copyObject({
            Bucket: S3_BUCKET_NAME,
            CopySource: `${S3_BUCKET_NAME}/${currentKey}`,
            Key: newKey
          }).promise();
          
          // Update database with new key
          await new Promise((res, rej) => {
            familyDb.run(
              'UPDATE images SET s3_key = ?, s3_url = ? WHERE id = ?',
              [newKey, newKey, image.id], // s3_url now stores the key, not full URL
              function(updateErr) {
                if (updateErr) rej(updateErr);
                else res();
              }
            );
          });
          
          // Delete old object
          await s3.deleteObject({
            Bucket: S3_BUCKET_NAME,
            Key: currentKey
          }).promise();
          
          migrated++;
          console.log(`[S3 Migration] Successfully migrated image ${image.id}`);
          
        } catch (imageError) {
          console.error(`[S3 Migration] Error migrating image ${image.id}:`, imageError);
          errors++;
        }
      }
      
      // Update migration status in auth database
      authDb.run(
        'UPDATE users SET s3_images_migrated = 1 WHERE family_name = ?',
        [familyName],
        (updateErr) => {
          if (updateErr) {
            console.error(`[S3 Migration] Error updating migration flag for ${familyName}:`, updateErr);
          }
        }
      );
      
      console.log(`[S3 Migration] Completed for ${familyName}: ${migrated} migrated, ${errors} errors, ${skipped} skipped`);
      resolve({ migrated, errors, skipped });
    });
  });
}

/**
 * List all S3 prefixes (family folders) to find orphans
 * @returns {Promise<string[]>} Array of family names found in S3
 */
async function listS3FamilyPrefixes() {
  if (!AWS_CREDENTIALS_CONFIGURED) {
    return [];
  }
  
  const prefixes = new Set();
  let continuationToken = null;
  
  try {
    do {
      const params = {
        Bucket: S3_BUCKET_NAME,
        Prefix: 'images/',
        Delimiter: '/',
        ContinuationToken: continuationToken
      };
      
      const result = await s3.listObjectsV2(params).promise();
      
      if (result.CommonPrefixes) {
        result.CommonPrefixes.forEach(prefix => {
          // Extract family name from prefix (images/familyname/)
          const parts = prefix.Prefix.split('/');
          if (parts.length >= 2 && parts[1]) {
            prefixes.add(parts[1]);
          }
        });
      }
      
      continuationToken = result.IsTruncated ? result.NextContinuationToken : null;
    } while (continuationToken);
    
    return Array.from(prefixes);
  } catch (error) {
    console.error('[S3] Error listing family prefixes:', error);
    return [];
  }
}

/**
 * Clean up orphaned S3 prefixes (families that no longer exist in the database)
 * @returns {Promise<{deleted: string[], errors: string[]}>}
 */
async function cleanupOrphanedS3Prefixes() {
  if (!AWS_CREDENTIALS_CONFIGURED) {
    console.log('[S3 Cleanup] AWS not configured, skipping orphan cleanup');
    return { deleted: [], errors: [] };
  }
  
  console.log('[S3 Cleanup] Starting orphaned prefix cleanup...');
  
  const s3Prefixes = await listS3FamilyPrefixes();
  console.log(`[S3 Cleanup] Found ${s3Prefixes.length} family prefixes in S3`);
  
  // Get all active family names from the database
  const activeFamilies = await new Promise((resolve, reject) => {
    authDb.all('SELECT family_name FROM users WHERE deleted_at IS NULL', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows ? rows.map(r => r.family_name) : []);
    });
  });
  
  console.log(`[S3 Cleanup] Found ${activeFamilies.length} active families in database`);
  
  const deleted = [];
  const errors = [];
  
  for (const prefix of s3Prefixes) {
    if (!activeFamilies.includes(prefix)) {
      console.log(`[S3 Cleanup] Found orphaned prefix: ${prefix}`);
      try {
        const result = await deleteAllFamilyImages(prefix);
        if (result.deleted > 0) {
          deleted.push(prefix);
        }
      } catch (error) {
        console.error(`[S3 Cleanup] Error cleaning up orphaned prefix ${prefix}:`, error);
        errors.push(prefix);
      }
    }
  }
  
  console.log(`[S3 Cleanup] Orphan cleanup complete: ${deleted.length} prefixes deleted, ${errors.length} errors`);
  return { deleted, errors };
}

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
}
// Run cleanup every 5 minutes (300000 ms)
const CLEANUP_INTERVAL = 60 * 1000 * 5; // 5 minutes
setInterval(cleanupNullKeys, CLEANUP_INTERVAL);

// Run initial cleanup on server start
setTimeout(cleanupNullKeys, 5000); // Wait 5 seconds after server start

// ============= USER AND TERMS CLEANUP ROUTINE =============
// Cleanup users who haven't accepted new terms after 1 month
// Cleanup users who haven't accessed the app for 12 months
function cleanupInactiveAndNonCompliantUsers() {
  console.log('Running user cleanup routine...');
  
  // Step 1: Mark users for soft delete (if not already marked)
  markUsersForDeletion();
  
  // Step 2: Permanently delete users whose grace period has expired
  permanentlyDeleteExpiredUsers();
  
  // Step 3: Clean up orphaned S3 prefixes (async, don't await)
  cleanupOrphanedS3Prefixes().catch(err => {
    console.error('Error during orphaned S3 prefix cleanup:', err);
  });
}

/**
 * Mark inactive and non-compliant users for deletion (soft delete)
 */
function markUsersForDeletion() {
  // Get the latest terms version
  authDb.get('SELECT version, release_date FROM terms ORDER BY release_date DESC LIMIT 1', [], (err, latestTerms) => {
    if (err) {
      console.error('Error getting latest terms for cleanup:', err);
      return;
    }
    
    if (!latestTerms) {
      console.log('No terms found, skipping terms compliance cleanup');
    }
    
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const oneMonthAgoStr = oneMonthAgo.toISOString();
    
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoStr = oneYearAgo.toISOString();
    
    // Find users who haven't accepted the latest terms and it's been more than 1 month since terms release
    // OR users who haven't accessed the app in 12 months
    // Only consider users that are not already marked for deletion
    let termsGracePeriodPassed = false;
    
    if (latestTerms) {
      const termsReleaseDate = new Date(latestTerms.release_date);
      const termsGracePeriodEnd = new Date(termsReleaseDate);
      termsGracePeriodEnd.setMonth(termsGracePeriodEnd.getMonth() + 1);
      termsGracePeriodPassed = new Date() > termsGracePeriodEnd;
    }
    
    let query = `
      SELECT id, family_name, terms_version, terms_accepted_at, last_accessed, created_at
      FROM users
      WHERE deleted_at IS NULL
        AND (
          (last_accessed IS NOT NULL AND last_accessed < ?)
          OR (last_accessed IS NULL AND created_at < ?)
        )
    `;
    let params = [oneYearAgoStr, oneYearAgoStr];
    
    // Add terms non-compliance check if grace period has passed
    if (latestTerms && termsGracePeriodPassed) {
      query = `
        SELECT id, family_name, terms_version, terms_accepted_at, last_accessed, created_at
        FROM users
        WHERE deleted_at IS NULL
          AND (
            (last_accessed IS NOT NULL AND last_accessed < ?)
            OR (last_accessed IS NULL AND created_at < ?)
            OR (terms_version IS NULL OR terms_version != ?)
          )
      `;
      params = [oneYearAgoStr, oneYearAgoStr, latestTerms.version];
    }
    
    authDb.all(query, params, (err, users) => {
      if (err) {
        console.error('Error finding users for cleanup:', err);
        return;
      }
      
      if (!users || users.length === 0) {
        console.log('No users need to be marked for deletion');
        return;
      }
      
      const now = new Date().toISOString();
      
      users.forEach(user => {
        const isInactive = 
          (user.last_accessed && new Date(user.last_accessed) < new Date(oneYearAgoStr)) ||
          (!user.last_accessed && new Date(user.created_at) < new Date(oneYearAgoStr));
        
        const hasNotAcceptedTerms = latestTerms && termsGracePeriodPassed && 
          (!user.terms_version || user.terms_version !== latestTerms.version);
        
        let reason = '';
        if (isInactive) {
          reason = 'inactive for more than 12 months';
        } else if (hasNotAcceptedTerms) {
          reason = `has not accepted terms version ${latestTerms.version} (grace period ended)`;
        } else {
          // This user doesn't actually need deletion
          return;
        }
        
        console.log(`[Soft Delete] Marking user ${user.family_name} (ID: ${user.id}) for deletion: ${reason}`);
        
        // Soft delete: set deleted_at and deletion_source
        authDb.run(
          'UPDATE users SET deleted_at = ?, deletion_source = ? WHERE id = ?',
          [now, 'server', user.id],
          function(updateErr) {
            if (updateErr) {
              console.error(`Error marking user ${user.family_name} for deletion:`, updateErr);
            } else {
              console.log(`[Soft Delete] User ${user.family_name} marked for deletion (grace period: ${GRACE_PERIOD_SERVER_DELETION} days)`);
            }
          }
        );
      });
    });
  });
}

/**
 * Permanently delete users whose grace period has expired
 */
async function permanentlyDeleteExpiredUsers() {
  const now = new Date();
  
  // Calculate cutoff dates for each deletion source
  const userCutoff = new Date(now);
  userCutoff.setDate(userCutoff.getDate() - GRACE_PERIOD_USER_DELETION);
  
  const serverCutoff = new Date(now);
  serverCutoff.setDate(serverCutoff.getDate() - GRACE_PERIOD_SERVER_DELETION);
  
  const adminCutoff = new Date(now);
  adminCutoff.setDate(adminCutoff.getDate() - GRACE_PERIOD_SERVER_DELETION); // Admin uses same as server
  
  // Find users whose grace period has expired
  const query = `
    SELECT id, family_name, deleted_at, deletion_source
    FROM users
    WHERE deleted_at IS NOT NULL
      AND (
        (deletion_source = 'user' AND deleted_at < ?)
        OR (deletion_source = 'server' AND deleted_at < ?)
        OR (deletion_source = 'admin' AND deleted_at < ?)
      )
  `;
  
  authDb.all(query, [userCutoff.toISOString(), serverCutoff.toISOString(), adminCutoff.toISOString()], async (err, users) => {
    if (err) {
      console.error('Error finding expired users for permanent deletion:', err);
      return;
    }
    
    if (!users || users.length === 0) {
      console.log('No users have expired grace periods');
      return;
    }
    
    for (const user of users) {
      const gracePeriod = user.deletion_source === 'user' ? GRACE_PERIOD_USER_DELETION : GRACE_PERIOD_SERVER_DELETION;
      console.log(`[Permanent Delete] Processing user ${user.family_name} (deleted_at: ${user.deleted_at}, source: ${user.deletion_source}, grace: ${gracePeriod} days)`);
      
      try {
        // 1. Delete S3 images for this family
        console.log(`[Permanent Delete] Deleting S3 images for family: ${user.family_name}`);
        const s3Result = await deleteAllFamilyImages(user.family_name);
        console.log(`[Permanent Delete] S3 cleanup result: ${s3Result.deleted} deleted, ${s3Result.errors} errors`);
        
        // 2. Close and delete the family database file
        const familyDbPath = path.join(__dirname, 'databases', `database_family_${user.family_name}.db`);
        
        await new Promise((resolve, reject) => {
          closeFamilyDatabase(user.family_name, (closeErr) => {
            if (closeErr) {
              console.error(`Error closing database for ${user.family_name}:`, closeErr);
              // Continue anyway, file might still be deletable
            }
            
            if (fs.existsSync(familyDbPath)) {
              try {
                fs.unlinkSync(familyDbPath);
                console.log(`[Permanent Delete] Deleted family database for ${user.family_name}`);
              } catch (deleteErr) {
                console.error(`Error deleting family database for ${user.family_name}:`, deleteErr);
              }
            }
            resolve();
          });
        });
        
        // 3. Delete user from auth database
        await new Promise((resolve, reject) => {
          authDb.run('DELETE FROM users WHERE id = ?', [user.id], function(deleteErr) {
            if (deleteErr) {
              console.error(`Error deleting user ${user.family_name} from auth:`, deleteErr);
              reject(deleteErr);
            } else {
              console.log(`[Permanent Delete] User ${user.family_name} permanently deleted from auth database`);
              resolve();
            }
          });
        });
        
      } catch (error) {
        console.error(`[Permanent Delete] Error during permanent deletion of ${user.family_name}:`, error);
      }
    }
  });
}

// Run user cleanup once per day (86400000 ms)
const USER_CLEANUP_INTERVAL = 60 * 1000 * 60 * 24; // 24 hours
setInterval(cleanupInactiveAndNonCompliantUsers, USER_CLEANUP_INTERVAL);

// Run initial user cleanup 30 seconds after server start
setTimeout(cleanupInactiveAndNonCompliantUsers, 30000);

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

      // Update last_accessed timestamp
      authDb.run('UPDATE users SET last_accessed = CURRENT_TIMESTAMP WHERE id = ?', [user.id], (updateErr) => {
        if (updateErr) {
          console.error('Error updating last_accessed:', updateErr);
          // Don't fail login if this fails
        }
      });

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

// Get current terms version
// This should match the version in the frontend TermsAndConditions.jsx
const CURRENT_TERMS_VERSION = 'beta-1.0';

// Get current terms version from database
app.get('/api/terms/version', (req, res) => {
  authDb.get('SELECT version, release_date FROM terms ORDER BY release_date DESC LIMIT 1', [], (err, row) => {
    if (err) {
      console.error('Error getting current terms version:', err);
      return res.status(500).json({ error: 'Failed to get terms version' });
    }
    
    if (!row) {
      // Fallback to hardcoded version if no terms in database
      return res.json({
        version: CURRENT_TERMS_VERSION,
        lastUpdated: '2025-11-27'
      });
    }
    
    res.json({
      version: row.version,
      lastUpdated: row.release_date
    });
  });
});

// Get all terms versions (for admin purposes)
app.get('/api/terms/all', authenticateToken, (req, res) => {
  authDb.all('SELECT * FROM terms ORDER BY release_date DESC', [], (err, rows) => {
    if (err) {
      console.error('Error getting all terms versions:', err);
      return res.status(500).json({ error: 'Failed to get terms versions' });
    }
    res.json(rows);
  });
});

// Check if user has accepted the latest terms
app.get('/api/terms/status', authenticateToken, (req, res) => {
  const userId = req.user.id;
  
  // Get latest terms version
  authDb.get('SELECT version, release_date FROM terms ORDER BY release_date DESC LIMIT 1', [], (err, latestTerms) => {
    if (err) {
      console.error('Error getting latest terms:', err);
      return res.status(500).json({ error: 'Failed to check terms status' });
    }
    
    if (!latestTerms) {
      return res.json({ needsAcceptance: false, message: 'No terms found' });
    }
    
    // Get user's accepted terms version
    authDb.get('SELECT terms_version, terms_accepted_at FROM users WHERE id = ?', [userId], (err, user) => {
      if (err) {
        console.error('Error getting user terms status:', err);
        return res.status(500).json({ error: 'Failed to check user terms status' });
      }
      
      const needsAcceptance = !user.terms_version || user.terms_version !== latestTerms.version;
      
      res.json({
        needsAcceptance,
        currentVersion: latestTerms.version,
        currentReleaseDate: latestTerms.release_date,
        userAcceptedVersion: user.terms_version || null,
        userAcceptedAt: user.terms_accepted_at || null
      });
    });
  });
});

// Accept new terms (requires admin password)
app.post('/api/terms/accept', authenticateToken, async (req, res) => {
  const { adminPassword, termsVersion } = req.body;
  const userId = req.user.id;
  
  if (!adminPassword) {
    return res.status(400).json({ error: 'Admin password is required to accept new terms' });
  }
  
  if (!termsVersion) {
    return res.status(400).json({ error: 'Terms version is required' });
  }
  
  try {
    // Get user's admin password hash
    authDb.get('SELECT admin_password_hash FROM users WHERE id = ?', [userId], async (err, user) => {
      if (err) {
        console.error('Error getting user:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!user || !user.admin_password_hash) {
        return res.status(400).json({ error: 'Admin password not set for this account' });
      }
      
      // Verify admin password
      const passwordMatch = await bcrypt.compare(adminPassword, user.admin_password_hash);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid admin password' });
      }
      
      // Verify the terms version exists
      authDb.get('SELECT version FROM terms WHERE version = ?', [termsVersion], (err, terms) => {
        if (err) {
          console.error('Error checking terms version:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (!terms) {
          return res.status(400).json({ error: 'Invalid terms version' });
        }
        
        // Update user's terms acceptance
        authDb.run(
          'UPDATE users SET terms_version = ?, terms_accepted_at = CURRENT_TIMESTAMP WHERE id = ?',
          [termsVersion, userId],
          function(err) {
            if (err) {
              console.error('Error updating terms acceptance:', err);
              return res.status(500).json({ error: 'Failed to accept terms' });
            }
            
            res.json({
              success: true,
              message: 'Terms accepted successfully',
              termsVersion,
              acceptedAt: new Date().toISOString()
            });
          }
        );
      });
    });
  } catch (error) {
    console.error('Error accepting terms:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register endpoint (for family registration)
app.post('/api/auth/register', async (req, res) => {
  const { familyName, password, displayName, adminPassword, adminEmail, betaAccessPassword, termsAccepted, termsVersion } = req.body;

  if (!familyName || !password) {
    return res.status(400).json({ error: 'Family name and password are required' });
  }

  // Check terms acceptance
  if (!termsAccepted) {
    return res.status(400).json({ error: 'You must accept the terms and conditions to register' });
  }

  if (!termsVersion) {
    return res.status(400).json({ error: 'Terms version is required' });
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

        // Create user with encryption enabled by default and terms acceptance
        authDb.run('INSERT INTO users (family_name, password_hash, admin_password_hash, display_name, encryption_enabled, encryption_salt, terms_accepted_at, terms_version) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)', 
          [familyName, passwordHash, adminPasswordHash, finalDisplayName, 1, encryptionSalt, termsVersion], 
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

// Soft delete family (marks for deletion with grace period - admin only)
app.delete('/api/auth/delete-family', authenticateToken, async (req, res) => {
  const { adminPassword } = req.body;

  if (!adminPassword) {
    return res.status(400).json({ error: 'Admin password is required to delete family' });
  }

  try {
    // First verify admin password
    authDb.get('SELECT family_name, admin_password_hash, deleted_at FROM users WHERE id = ?', [req.user.id], async (err, user) => {
      if (err) {
        console.error('Database error during family deletion:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if already marked for deletion
      if (user.deleted_at) {
        return res.status(400).json({ 
          error: 'Family is already marked for deletion',
          deletedAt: user.deleted_at,
          gracePeriodDays: GRACE_PERIOD_USER_DELETION
        });
      }

      // Verify admin password
      const passwordMatch = await bcrypt.compare(adminPassword, user.admin_password_hash);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid admin password' });
      }

      const familyName = user.family_name;
      const deletionDate = new Date().toISOString();
      const permanentDeletionDate = new Date(Date.now() + GRACE_PERIOD_USER_DELETION * 24 * 60 * 60 * 1000).toISOString();

      // Mark user for soft deletion with 'user' source
      authDb.run(
        'UPDATE users SET deleted_at = ?, deletion_source = ? WHERE id = ?',
        [deletionDate, 'user', req.user.id],
        function(updateErr) {
          if (updateErr) {
            console.error('Database error during soft deletion:', updateErr);
            return res.status(500).json({ error: 'Internal server error' });
          }

          console.log(`Family "${familyName}" marked for deletion by user. Will be permanently deleted after ${permanentDeletionDate}`);
          res.json({ 
            success: true, 
            message: `Family "${familyName}" has been marked for deletion`,
            deletedAt: deletionDate,
            permanentDeletionDate: permanentDeletionDate,
            gracePeriodDays: GRACE_PERIOD_USER_DELETION,
            canCancel: true
          });
        }
      );
    });
  } catch (error) {
    console.error('Family deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel family deletion (within grace period)
app.post('/api/auth/cancel-deletion', authenticateToken, async (req, res) => {
  try {
    authDb.get('SELECT family_name, deleted_at, deletion_source FROM users WHERE id = ?', [req.user.id], (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!user.deleted_at) {
        return res.status(400).json({ error: 'Family is not marked for deletion' });
      }

      // Check if still within grace period
      const deletedAt = new Date(user.deleted_at);
      const gracePeriod = user.deletion_source === 'user' ? GRACE_PERIOD_USER_DELETION : GRACE_PERIOD_SERVER_DELETION;
      const expirationDate = new Date(deletedAt.getTime() + gracePeriod * 24 * 60 * 60 * 1000);

      if (new Date() > expirationDate) {
        return res.status(400).json({ error: 'Grace period has expired. Deletion cannot be cancelled.' });
      }

      // Clear deletion markers
      authDb.run(
        'UPDATE users SET deleted_at = NULL, deletion_source = NULL WHERE id = ?',
        [req.user.id],
        function(updateErr) {
          if (updateErr) {
            console.error('Database error cancelling deletion:', updateErr);
            return res.status(500).json({ error: 'Internal server error' });
          }

          console.log(`Family "${user.family_name}" deletion cancelled by user`);
          res.json({ 
            success: true, 
            message: `Deletion of family "${user.family_name}" has been cancelled`
          });
        }
      );
    });
  } catch (error) {
    console.error('Cancel deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get deletion status
app.get('/api/auth/deletion-status', authenticateToken, (req, res) => {
  authDb.get('SELECT family_name, deleted_at, deletion_source FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.deleted_at) {
      return res.json({ markedForDeletion: false });
    }

    const deletedAt = new Date(user.deleted_at);
    const gracePeriod = user.deletion_source === 'user' ? GRACE_PERIOD_USER_DELETION : GRACE_PERIOD_SERVER_DELETION;
    const expirationDate = new Date(deletedAt.getTime() + gracePeriod * 24 * 60 * 60 * 1000);
    const daysRemaining = Math.max(0, Math.ceil((expirationDate - new Date()) / (24 * 60 * 60 * 1000)));

    res.json({
      markedForDeletion: true,
      deletedAt: user.deleted_at,
      deletionSource: user.deletion_source,
      gracePeriodDays: gracePeriod,
      permanentDeletionDate: expirationDate.toISOString(),
      daysRemaining: daysRemaining,
      canCancel: new Date() < expirationDate
    });
  });
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

// Migrate images to family prefix structure (admin only)
app.post('/api/admin/migrate-images', authenticateToken, async (req, res) => {
  const { adminPassword } = req.body;

  if (!adminPassword) {
    return res.status(400).json({ error: 'Admin password is required for migration' });
  }

  try {
    // Verify admin password first
    authDb.get('SELECT family_name, admin_password_hash, s3_images_migrated FROM users WHERE id = ?', [req.user.id], async (err, user) => {
      if (err) {
        console.error('Database error:', err);
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

      if (user.s3_images_migrated) {
        return res.json({
          success: true,
          message: 'Images have already been migrated to family prefix structure',
          alreadyMigrated: true,
          migratedCount: 0
        });
      }

      const familyName = user.family_name;

      // Perform migration
      try {
        const migratedCount = await migrateImagesToFamilyPrefix(familyName);

        // Mark migration as complete
        authDb.run('UPDATE users SET s3_images_migrated = 1 WHERE id = ?', [req.user.id], (updateErr) => {
          if (updateErr) {
            console.error('Error updating migration status:', updateErr);
            // Migration succeeded but status update failed - log but don't fail
          }

          console.log(`Image migration completed for family "${familyName}": ${migratedCount} images migrated`);
          res.json({
            success: true,
            message: `Successfully migrated ${migratedCount} images to family prefix structure`,
            migratedCount: migratedCount,
            alreadyMigrated: false
          });
        });
      } catch (migrationError) {
        console.error(`Image migration failed for family "${familyName}":`, migrationError);
        res.status(500).json({ error: 'Image migration failed: ' + migrationError.message });
      }
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get migration status
app.get('/api/admin/migration-status', authenticateToken, (req, res) => {
  authDb.get('SELECT family_name, s3_images_migrated FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      familyName: user.family_name,
      migrated: Boolean(user.s3_images_migrated)
    });
  });
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
          bloodline: Boolean(row.bloodline)
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
      bloodline
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, type, position.x, position.y, data.name, data.surname, data.maidenName,
      data.birthDate, data.deathDate, data.street, data.housenumber, data.city, data.zip, data.country, data.phone,
      data.email, data.latitude, data.longitude, data.addressHash, data.lastGeocoded,
      data.bloodline ? 1 : 0
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
        bloodline = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`;
      updateParams = [
        position?.x, position?.y, data.name, data.surname, data.maidenName, data.birthDate,
        data.deathDate, data.street, data.housenumber, data.city, data.zip, data.country, data.phone, data.email,
        data.latitude, data.longitude, data.addressHash, data.lastGeocoded,
        data.bloodline ? 1 : 0, id
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
            bloodline: Boolean(updatedRow.bloodline)
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
    const maxOperations = 6; // Number of cleanup operations
    
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

// Get presigned URL for uploading an image (client uploads directly to S3)
app.post('/api/images/presigned-upload', authenticateToken, (req, res) => {
  const familyName = req.user.familyName;
  const { filename, contentType, fileSize } = req.body;
  
  // Check if AWS credentials are configured
  if (!AWS_CREDENTIALS_CONFIGURED) {
    console.error('Presigned upload URL requested but AWS credentials are not configured');
    return res.status(500).json({ 
      error: 'Server configuration error: AWS S3 credentials not configured. Please contact the administrator.',
      code: 'AWS_NOT_CONFIGURED'
    });
  }
  
  // Validate content type
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedMimes.includes(contentType)) {
    return res.status(400).json({ 
      error: 'Only image files are allowed (JPEG, PNG, GIF, WebP).',
      code: 'INVALID_FILE_TYPE'
    });
  }
  
  // Validate file size (10MB limit)
  const maxSize = 10 * 1024 * 1024;
  if (fileSize && fileSize > maxSize) {
    return res.status(400).json({ 
      error: 'File too large. Maximum file size is 10MB.',
      code: 'FILE_TOO_LARGE'
    });
  }
  
  try {
    // Generate unique S3 key
    const fileExtension = path.extname(filename) || '.jpg';
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    const s3Key = `images/${familyName}/${uniqueFileName}`;
    
    // Generate presigned upload URL
    const uploadUrl = generatePresignedUploadUrl(s3Key, contentType);
    
    res.json({
      success: true,
      uploadUrl,
      s3Key,
      expiresIn: PRESIGNED_URL_EXPIRY_UPLOAD
    });
  } catch (error) {
    console.error('Error generating presigned upload URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// Confirm upload and save image metadata to database
app.post('/api/images/confirm-upload', authenticateToken, (req, res) => {
  const familyName = req.user.familyName;
  const { s3Key, originalFilename, description, fileSize, mimeType, uploadedBy } = req.body;
  
  if (!s3Key || !originalFilename) {
    return res.status(400).json({ 
      error: 'Missing required fields: s3Key and originalFilename',
      code: 'MISSING_FIELDS'
    });
  }
  
  try {
    const familyDb = getFamilyDb(familyName);
    const imageId = uuidv4();
    const filename = s3Key.split('/').pop();
    
    const imageData = {
      id: imageId,
      filename: filename,
      original_filename: originalFilename,
      s3_key: s3Key,
      s3_url: '', // No longer storing public URLs
      description: description || '',
      file_size: fileSize || 0,
      mime_type: mimeType || 'image/jpeg',
      uploaded_by: uploadedBy || 'anonymous'
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

      // Generate a presigned view URL for immediate display
      const viewUrl = generatePresignedViewUrl(s3Key);

      res.json({
        success: true,
        image: {
          ...imageData,
          s3Url: viewUrl // Provide presigned URL for immediate use
        }
      });
    });
  } catch (error) {
    console.error('Error confirming image upload:', error);
    res.status(500).json({ error: 'Failed to confirm image upload' });
  }
});

// Get presigned view URL for a single image
app.get('/api/images/:id/presigned-url', authenticateToken, (req, res) => {
  const imageId = req.params.id;
  const familyName = req.user.familyName;
  
  if (!AWS_CREDENTIALS_CONFIGURED) {
    return res.status(500).json({ 
      error: 'AWS S3 credentials not configured',
      code: 'AWS_NOT_CONFIGURED'
    });
  }
  
  try {
    const familyDb = getFamilyDb(familyName);
    
    familyDb.get(`SELECT s3_key FROM images WHERE id = ?`, [imageId], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Image not found' });
      }
      
      const viewUrl = generatePresignedViewUrl(row.s3_key);
      
      res.json({
        success: true,
        imageId,
        url: viewUrl,
        expiresIn: PRESIGNED_URL_EXPIRY_VIEW
      });
    });
  } catch (error) {
    console.error('Error generating presigned view URL:', error);
    res.status(500).json({ error: 'Failed to generate view URL' });
  }
});

// Get presigned view URLs for multiple images (batch)
app.post('/api/images/presigned-urls', authenticateToken, (req, res) => {
  const { imageIds, s3Keys } = req.body;
  const familyName = req.user.familyName;
  
  if (!AWS_CREDENTIALS_CONFIGURED) {
    return res.status(500).json({ 
      error: 'AWS S3 credentials not configured',
      code: 'AWS_NOT_CONFIGURED'
    });
  }
  
  try {
    // If s3Keys are provided directly (for encrypted data scenario)
    if (s3Keys && Array.isArray(s3Keys)) {
      const urls = {};
      for (const s3Key of s3Keys) {
        if (s3Key) {
          urls[s3Key] = generatePresignedViewUrl(s3Key);
        }
      }
      return res.json({
        success: true,
        urls,
        expiresIn: PRESIGNED_URL_EXPIRY_VIEW
      });
    }
    
    // If imageIds are provided, look up s3Keys from database
    if (imageIds && Array.isArray(imageIds) && imageIds.length > 0) {
      const familyDb = getFamilyDb(familyName);
      const placeholders = imageIds.map(() => '?').join(',');
      
      familyDb.all(`SELECT id, s3_key FROM images WHERE id IN (${placeholders})`, imageIds, (err, rows) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        const urls = {};
        for (const row of rows) {
          if (row.s3_key) {
            urls[row.id] = generatePresignedViewUrl(row.s3_key);
          }
        }
        
        res.json({
          success: true,
          urls,
          expiresIn: PRESIGNED_URL_EXPIRY_VIEW
        });
      });
    } else {
      return res.status(400).json({ 
        error: 'Either imageIds or s3Keys array must be provided',
        code: 'MISSING_PARAMS'
      });
    }
  } catch (error) {
    console.error('Error generating batch presigned URLs:', error);
    res.status(500).json({ error: 'Failed to generate view URLs' });
  }
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

// Image proxy endpoint for downloading images from S3 (solves CORS issues for export)
// Accepts either s3Key directly or s3Url (for backwards compatibility)
app.post('/api/images/proxy', authenticateToken, async (req, res) => {
  const { s3Url, s3Key: providedS3Key } = req.body;
  
  if (!s3Url && !providedS3Key) {
    return res.status(400).json({ error: 'Either s3Key or s3Url is required' });
  }
  
  try {
    let s3Key;
    
    if (providedS3Key) {
      // Use provided s3Key directly
      s3Key = providedS3Key;
    } else {
      // Extract S3 key from URL (backwards compatibility)
      // URL format: https://bucket-name.s3.region.amazonaws.com/images/filename.jpg
      const urlParts = new URL(s3Url);
      s3Key = urlParts.pathname.substring(1); // Remove leading slash
    }
    
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
app.delete('/api/images/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const familyName = req.user.familyName;

  try {
    const familyDb = getFamilyDb(familyName);
    
    // First, get the s3_key to delete from S3
    familyDb.get(`SELECT s3_key FROM images WHERE id = ?`, [id], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!row) {
        return res.status(404).json({ error: 'Image not found' });
      }

      const s3Key = row.s3_key;
      
      // Delete from S3 if we have a key and AWS is configured
      if (s3Key && AWS_CREDENTIALS_CONFIGURED) {
        try {
          await s3.deleteObject({
            Bucket: S3_BUCKET_NAME,
            Key: s3Key
          }).promise();
          console.log(`[S3] Deleted image: ${s3Key}`);
        } catch (s3Error) {
          console.error('[S3] Error deleting image:', s3Error);
          // Continue with database deletion even if S3 deletion fails
        }
      }
      
      // Delete from database (this will cascade delete image_people records)
      familyDb.run(`DELETE FROM images WHERE id = ?`, [id], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        res.json({ 
          success: true, 
          message: 'Image deleted successfully'
        });
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