/**
 * Geocoding Service
 * Manages background geocoding with rate limiting, queue management,
 * and integration with encryption session
 */

import { geocodeAddress, generateAddressHash, createRateLimiter } from './geocodingUtils';
import { isBatchOperationInProgress } from './encryptionSession';
import { encryptedApi } from './encryptedApi';
import { filterAddressForGeocoding, isSkipMarker } from './skipMarkerUtils';

// Singleton state
const state = {
  queue: [],
  isProcessing: false,
  listeners: new Set(),
  stats: {
    totalProcessed: 0,
    successCount: 0,
    failureCount: 0,
    batchStartTime: null,
    batchSize: 0
  }
};

// Rate limiter: 10 requests per second = 100ms between requests
const rateLimiter = createRateLimiter(100);

/**
 * Subscribe to geocoding updates
 * @param {Function} callback - Called when a node is geocoded: (nodeId, success, coordinates)
 * @returns {Function} Unsubscribe function
 */
export const subscribeToGeocodingUpdates = (callback) => {
  state.listeners.add(callback);
  return () => state.listeners.delete(callback);
};

/**
 * Notify all listeners of a geocoding update
 * @param {string} nodeId - The node that was geocoded
 * @param {boolean} success - Whether geocoding succeeded
 * @param {Object|null} coordinates - {latitude, longitude} or null
 */
const notifyListeners = (nodeId, success, coordinates) => {
  state.listeners.forEach(listener => {
    try {
      listener(nodeId, success, coordinates);
    } catch (error) {
      console.error('[GeocodingService] Error in listener:', error);
    }
  });
};

/**
 * Check if a node needs geocoding
 * Compares current address hash with stored hash
 * @param {Object} node - Node object with data property
 * @returns {Promise<boolean>} True if geocoding is needed
 */
export const needsGeocoding = async (node) => {
  if (!node || !node.data) return false;
  
  const { street, housenumber, city, zip, country, addressHash: storedHash } = node.data;
  
  // Filter out skip markers before checking
  const filteredAddress = filterAddressForGeocoding({ street, housenumber, city, zip, country });
  
  // If no address components after filtering, no geocoding needed
  if (!filteredAddress.street && !filteredAddress.housenumber && !filteredAddress.city && !filteredAddress.zip && !filteredAddress.country) {
    console.log(`[GeocodingService] Node ${node.id} has no address components (after filtering skip markers), skipping`);
    return false;
  }
  
  // Check if any address field is encrypted (starts with "enc:")
  const hasEncryptedField = [filteredAddress.street, filteredAddress.housenumber, filteredAddress.city, filteredAddress.zip, filteredAddress.country].some(
    field => field && typeof field === 'string' && field.startsWith('enc:')
  );
  
  if (hasEncryptedField) {
    console.log(`[GeocodingService] Node ${node.id} has encrypted address fields, skipping geocoding`);
    return false;
  }
  
  // Calculate current address hash using filtered address
  const currentHash = await generateAddressHash(
    filteredAddress.street,
    filteredAddress.housenumber,
    filteredAddress.city,
    filteredAddress.zip,
    filteredAddress.country
  );
  
  console.log(`[GeocodingService] Node ${node.id} hash check:`, {
    street: filteredAddress.street,
    housenumber: filteredAddress.housenumber,
    city: filteredAddress.city,
    zip: filteredAddress.zip,
    country: filteredAddress.country,
    currentHash,
    storedHash,
    needsGeocoding: currentHash !== storedHash
  });
  
  // If hashes match, no geocoding needed
  if (currentHash === storedHash) {
    return false;
  }
  
  return true;
};

/**
 * Add a node to the geocoding queue
 * @param {Object} node - Node object with id and data
 */
export const queueGeocoding = async (node) => {
  if (!node || !node.id) {
    console.error('[GeocodingService] Invalid node provided to queueGeocoding');
    return;
  }
  
  // Check if geocoding is needed
  const shouldGeocode = await needsGeocoding(node);
  if (!shouldGeocode) {
    console.log(`[GeocodingService] Node ${node.id} does not need geocoding (address unchanged)`);
    return;
  }
  
  // Check if already in queue
  const alreadyQueued = state.queue.some(item => item.node.id === node.id);
  if (alreadyQueued) {
    console.log(`[GeocodingService] Node ${node.id} already in queue`);
    return;
  }
  
  console.log(`[GeocodingService] Adding node ${node.id} to geocoding queue`);
  state.queue.push({ node, retries: 0 });
  
  // Start processing if not already running
  if (!state.isProcessing) {
    processQueue();
  }
};

/**
 * Batch queue multiple nodes for geocoding
 * @param {Array<Object>} nodes - Array of node objects
 */
export const queueBatchGeocoding = async (nodes) => {
  console.log(`[GeocodingService] Queuing batch of ${nodes.length} nodes for geocoding check`);
  
  // Track batch stats
  state.stats.batchStartTime = Date.now();
  state.stats.batchSize = 0;
  state.stats.successCount = 0;
  state.stats.failureCount = 0;
  state.stats.totalProcessed = 0;
  
  // Check and queue each node
  let checkedCount = 0;
  for (const node of nodes) {
    checkedCount++;
    console.log(`[GeocodingService] Checking node ${checkedCount}/${nodes.length}: ${node.id}`, {
      hasData: !!node.data,
      city: node.data?.city,
      zip: node.data?.zip,
      country: node.data?.country
    });
    await queueGeocoding(node);
  }
  
  state.stats.batchSize = state.queue.length;
  
  console.log(`[GeocodingService] Batch check complete: ${state.stats.batchSize} nodes need geocoding out of ${nodes.length} total`);
};

/**
 * Process the geocoding queue
 * Runs in background with rate limiting
 */
const processQueue = async () => {
  if (state.isProcessing) return;
  
  state.isProcessing = true;
  console.log('[GeocodingService] Starting queue processing');
  
  while (state.queue.length > 0) {
    // Check if batch operation is in progress (encryption/decryption)
    if (isBatchOperationInProgress()) {
      console.log('[GeocodingService] Batch operation in progress, pausing geocoding');
      // Wait 2 seconds and check again
      await new Promise(resolve => setTimeout(resolve, 2000));
      continue;
    }
    
    // Get next item from queue
    const item = state.queue.shift();
    
    try {
      // Apply rate limiting
      await rateLimiter();
      
      // Geocode the address
      const { node } = item;
      const { street, housenumber, city, zip, country } = node.data;
      
      // Filter out skip markers for geocoding
      const filteredAddress = filterAddressForGeocoding({ street, housenumber, city, zip, country });
      
      console.log(`[GeocodingService] Geocoding node ${node.id}: ${filteredAddress.street} ${filteredAddress.housenumber}, ${filteredAddress.city}, ${filteredAddress.zip}, ${filteredAddress.country}`);
      
      // Use filtered address fields for geocoding
      const result = await geocodeAddress(
        filteredAddress.street,
        filteredAddress.housenumber,
        filteredAddress.city,
        filteredAddress.zip,
        filteredAddress.country
      );
      
      if (result && result.latitude && result.longitude) {
        // Geocoding succeeded
        console.log(`[GeocodingService] Successfully geocoded node ${node.id}: ${result.latitude}, ${result.longitude}`);
        
        // Generate new address hash using filtered address
        const newHash = await generateAddressHash(
          filteredAddress.street,
          filteredAddress.housenumber,
          filteredAddress.city,
          filteredAddress.zip,
          filteredAddress.country
        );
        
        // Get current timestamp for last_geocoded
        const timestamp = new Date().toISOString();
        
        // Update node in database with new coordinates, hash, and timestamp
        await encryptedApi.updateNode(node.id, {
          latitude: result.latitude,
          longitude: result.longitude,
          addressHash: newHash,
          lastGeocoded: timestamp
        });
        
        // Notify listeners
        notifyListeners(node.id, true, result);
        
        state.stats.successCount++;
      } else {
        // Geocoding failed - set coordinates to null
        console.error(`[GeocodingService] Geocoding failed for node ${node.id}: ${filteredAddress.street} ${filteredAddress.housenumber}, ${filteredAddress.city}, ${filteredAddress.zip}, ${filteredAddress.country}`);
        
        // Generate new address hash using filtered address
        const newHash = await generateAddressHash(
          filteredAddress.street,
          filteredAddress.housenumber,
          filteredAddress.city,
          filteredAddress.zip,
          filteredAddress.country
        );
        const timestamp = new Date().toISOString();
        
        // Update node with null coordinates
        await encryptedApi.updateNode(node.id, {
          latitude: null,
          longitude: null,
          addressHash: newHash,
          lastGeocoded: timestamp
        });
        
        // Notify listeners
        notifyListeners(node.id, false, null);
        
        state.stats.failureCount++;
      }
      
      state.stats.totalProcessed++;
      
    } catch (error) {
      console.error(`[GeocodingService] Error processing node ${item.node.id}:`, error);
      
      // On error, try to update with null coordinates
      try {
        const filteredAddress = filterAddressForGeocoding({
          street: item.node.data.street,
          housenumber: item.node.data.housenumber,
          city: item.node.data.city,
          zip: item.node.data.zip,
          country: item.node.data.country
        });
        const newHash = await generateAddressHash(
          filteredAddress.street,
          filteredAddress.housenumber,
          filteredAddress.city,
          filteredAddress.zip,
          filteredAddress.country
        );
        const timestamp = new Date().toISOString();
        
        await encryptedApi.updateNode(item.node.id, {
          latitude: null,
          longitude: null,
          addressHash: newHash,
          lastGeocoded: timestamp
        });
      } catch (updateError) {
        console.error(`[GeocodingService] Failed to update node ${item.node.id} after error:`, updateError);
      }
      
      notifyListeners(item.node.id, false, null);
      state.stats.failureCount++;
      state.stats.totalProcessed++;
    }
  }
  
  state.isProcessing = false;
  
  // Log batch summary if this was a batch operation (>10 nodes)
  if (state.stats.batchSize > 10) {
    const duration = Date.now() - state.stats.batchStartTime;
    const durationSec = (duration / 1000).toFixed(1);
    
    console.log(`[GeocodingService] Batch geocoding completed:
      Total processed: ${state.stats.totalProcessed}
      Successful: ${state.stats.successCount}
      Failed: ${state.stats.failureCount}
      Duration: ${durationSec}s
    `);
  }
  
  console.log('[GeocodingService] Queue processing complete');
};

/**
 * Get current queue status
 * @returns {Object} Queue status
 */
export const getQueueStatus = () => {
  return {
    queueLength: state.queue.length,
    isProcessing: state.isProcessing,
    stats: { ...state.stats }
  };
};

/**
 * Clear the geocoding queue
 * Useful for testing or emergency stops
 */
export const clearQueue = () => {
  console.log('[GeocodingService] Clearing geocoding queue');
  state.queue = [];
  state.isProcessing = false;
};
