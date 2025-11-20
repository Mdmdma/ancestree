/**
 * Encryption API Wrapper
 * Wraps all API calls to automatically encrypt/decrypt data based on session state
 */

import { baseApi } from './api';
import {
  isEncryptionEnabled,
  getDerivedKey,
  shouldSkipGeocoding
} from './encryptionSession';
import {
  encryptValueFast,
  decryptValueFast,
  encryptObjectFields,
  decryptObjectFields
} from './encryptionUtilsOptimized';
import {
  NODE_ENCRYPTED_FIELDS,
  EDGE_ENCRYPTED_FIELDS,
  IMAGE_ENCRYPTED_FIELDS,
  IMAGE_PEOPLE_ENCRYPTED_FIELDS,
  CHAT_MESSAGE_ENCRYPTED_FIELDS
} from './encryptionFieldDefinitions';

/**
 * Geocode an address using the backend API
 * @param {string} city
 * @param {string} zip
 * @param {string} country
 * @returns {Promise<{latitude: number|null, longitude: number|null}>}
 */
const geocodeAddress = async (city, zip, country) => {
  try {
    const response = await baseApi.geocodeForEncryption(city, zip, country);
    return response;
  } catch (error) {
    console.error('[EncryptionAPI] Geocoding failed:', error);
    return { latitude: null, longitude: null };
  }
};

/**
 * Encrypt node data before sending to backend
 */
const encryptNodeData = async (node) => {
  if (!isEncryptionEnabled()) {
    console.log('[EncryptionAPI] encryptNodeData - encryption disabled, returning node as-is');
    return node;
  }
  
  const key = getDerivedKey();
  if (!key) {
    console.warn('[EncryptionAPI] Encryption enabled but no key available');
    return node;
  }
  
  console.log('[EncryptionAPI] encryptNodeData - encrypting node:', node.id, 'name:', node.data?.name);
  
  const encrypted = { ...node };
  
  if (node.data) {
    encrypted.data = { ...node.data };
    
    // Encrypt each field - NO EXCEPTIONS, encrypt everything including placeholders
    for (const field of NODE_ENCRYPTED_FIELDS) {
      const value = node.data[field];
      if (value !== null && value !== undefined && value !== '') {
        const stringValue = String(value);
        const encryptedValue = await encryptValueFast(stringValue, key, true);
        console.log(`[EncryptionAPI] Encrypted ${field}: "${stringValue.substring(0, 20)}" → "${encryptedValue.substring(0, 30)}..."`);
        encrypted.data[field] = encryptedValue;
      }
    }
  }
  
  return encrypted;
};

/**
 * Decrypt node data after receiving from backend
 */
const decryptNodeData = async (node) => {
  if (!isEncryptionEnabled()) {
    return node;
  }
  
  const key = getDerivedKey();
  if (!key) {
    console.warn('[EncryptionAPI] Encryption enabled but no key available');
    return node;
  }
  
  console.log('[EncryptionAPI] decryptNodeData - decrypting node:', node.id);
  
  const decrypted = { ...node };
  
  if (node.data) {
    decrypted.data = { ...node.data };
    
    // Decrypt each field
    for (const field of NODE_ENCRYPTED_FIELDS) {
      if (node.data[field] && typeof node.data[field] === 'string' && node.data[field].startsWith('enc:')) {
        try {
          const decryptedValue = await decryptValueFast(node.data[field], key, true);
          console.log(`[EncryptionAPI] Decrypted ${field}: "${node.data[field].substring(0, 30)}..." → "${decryptedValue?.substring(0, 20)}"`);
          
          // Convert back to numbers for latitude/longitude
          if (field === 'latitude' || field === 'longitude') {
            decrypted.data[field] = decryptedValue ? parseFloat(decryptedValue) : null;
          } else {
            decrypted.data[field] = decryptedValue;
          }
        } catch (error) {
          console.error(`[EncryptionAPI] Failed to decrypt field "${field}":`, error);
          console.error(`[EncryptionAPI] Field value:`, node.data[field].substring(0, 50));
          // Leave the encrypted value as-is if decryption fails
          decrypted.data[field] = node.data[field];
        }
      }
    }
  }
  
  return decrypted;
};

/**
 * Encrypt edge data before sending
 */
const encryptEdgeData = async (edge) => {
  if (!isEncryptionEnabled()) {
    return edge;
  }
  
  const key = getDerivedKey();
  if (!key) return edge;
  
  const encrypted = { ...edge };
  
  for (const field of EDGE_ENCRYPTED_FIELDS) {
    if (edge[field] !== null && edge[field] !== undefined && edge[field] !== '') {
      encrypted[field] = await encryptValueFast(String(edge[field]), key, true);
    }
  }
  
  return encrypted;
};

/**
 * Decrypt edge data after receiving
 */
const decryptEdgeData = async (edge) => {
  if (!isEncryptionEnabled()) {
    return edge;
  }
  
  const key = getDerivedKey();
  if (!key) return edge;
  
  console.log('[EncryptionAPI] decryptEdgeData - decrypting edge:', edge.id);
  
  const decrypted = { ...edge };
  
  for (const field of EDGE_ENCRYPTED_FIELDS) {
    if (edge[field] && typeof edge[field] === 'string' && edge[field].startsWith('enc:')) {
      try {
        const decryptedValue = await decryptValueFast(edge[field], key, true);
        console.log(`[EncryptionAPI] Decrypted edge ${field}: "${edge[field].substring(0, 30)}..." → "${decryptedValue}"`);
        decrypted[field] = decryptedValue;
      } catch (error) {
        console.error(`[EncryptionAPI] Failed to decrypt edge field "${field}":`, error);
        console.error(`[EncryptionAPI] Edge field value:`, edge[field].substring(0, 50));
        // Leave the encrypted value as-is if decryption fails
        decrypted[field] = edge[field];
      }
    }
  }
  
  return decrypted;
};

/**
 * Encrypt image data before sending
 */
const encryptImageData = async (image) => {
  if (!isEncryptionEnabled()) {
    return image;
  }
  
  const key = getDerivedKey();
  if (!key) return image;
  
  const encrypted = { ...image };
  
  for (const field of IMAGE_ENCRYPTED_FIELDS) {
    if (image[field] !== null && image[field] !== undefined && image[field] !== '') {
      encrypted[field] = await encryptValueFast(String(image[field]), key, true);
    }
  }
  
  return encrypted;
};

/**
 * Decrypt image data after receiving
 */
const decryptImageData = async (image) => {
  if (!isEncryptionEnabled()) {
    return image;
  }
  
  const key = getDerivedKey();
  if (!key) return image;
  
  const decrypted = { ...image };
  
  // Decrypt image fields
  for (const field of IMAGE_ENCRYPTED_FIELDS) {
    if (image[field] && typeof image[field] === 'string' && image[field].startsWith('enc:')) {
      decrypted[field] = await decryptValueFast(image[field], key, true);
    }
  }
  
  // Decrypt person names in the people array (they come from nodes table)
  if (image.people && Array.isArray(image.people)) {
    decrypted.people = [];
    for (const person of image.people) {
      const decryptedPerson = { ...person };
      
      // Decrypt personName and personSurname if they're encrypted
      if (person.personName && typeof person.personName === 'string' && person.personName.startsWith('enc:')) {
        decryptedPerson.personName = await decryptValueFast(person.personName, key, true);
      }
      if (person.personSurname && typeof person.personSurname === 'string' && person.personSurname.startsWith('enc:')) {
        decryptedPerson.personSurname = await decryptValueFast(person.personSurname, key, true);
      }
      
      decrypted.people.push(decryptedPerson);
    }
  }
  
  return decrypted;
};

/**
 * Encrypt chat message data before sending
 */
const encryptChatMessageData = async (chatMessage) => {
  if (!isEncryptionEnabled()) {
    return chatMessage;
  }
  
  const key = getDerivedKey();
  if (!key) return chatMessage;
  
  const encrypted = { ...chatMessage };
  
  for (const field of CHAT_MESSAGE_ENCRYPTED_FIELDS) {
    if (chatMessage[field] !== null && chatMessage[field] !== undefined && chatMessage[field] !== '') {
      encrypted[field] = await encryptValueFast(String(chatMessage[field]), key, true);
    }
  }
  
  return encrypted;
};

/**
 * Decrypt chat message data after receiving
 */
const decryptChatMessageData = async (chatMessage) => {
  if (!isEncryptionEnabled()) {
    return chatMessage;
  }
  
  const key = getDerivedKey();
  if (!key) return chatMessage;
  
  const decrypted = { ...chatMessage };
  
  for (const field of CHAT_MESSAGE_ENCRYPTED_FIELDS) {
    if (chatMessage[field] && typeof chatMessage[field] === 'string' && chatMessage[field].startsWith('enc:')) {
      decrypted[field] = await decryptValueFast(chatMessage[field], key, true);
    }
  }
  
  return decrypted;
};

/**
 * Enhanced API with encryption wrapper
 */
export const encryptedApi = {
  // Pass through authentication methods
  checkAuthStatus: baseApi.checkAuthStatus,
  login: baseApi.login,
  register: baseApi.register,
  verifyToken: baseApi.verifyToken,
  logout: baseApi.logout,
  adminLogin: baseApi.adminLogin,
  changeFamilyPassword: baseApi.changeFamilyPassword,
  changeAdminPassword: baseApi.changeAdminPassword,
  
  // Pass through family settings
  getFamilySettings: baseApi.getFamilySettings,
  getFamilyPurpose: baseApi.getFamilyPurpose,
  updateDisplayName: baseApi.updateDisplayName,
  updatePurpose: baseApi.updatePurpose,
  setEncryptionStatus: baseApi.setEncryption,
  
  // Add skip geocoding method
  async updateSkipGeocoding(skipGeocoding) {
    return baseApi.updateSkipGeocoding(skipGeocoding);
  },
  
  // Geocoding for encryption
  async geocodeForEncryption(city, zip, country) {
    return baseApi.geocodeForEncryption(city, zip, country);
  },
  
  // Load operations with decryption
  async loadNodes() {
    const nodes = await baseApi.loadNodes();
    
    const encEnabled = isEncryptionEnabled();
    const key = getDerivedKey();
    console.log('[EncryptedAPI] loadNodes - encryption enabled:', encEnabled, 'has key:', !!key, 'nodes count:', nodes.length);
    
    if (!encEnabled) {
      console.log('[EncryptedAPI] Returning nodes without decryption (encryption disabled)');
      return nodes;
    }
    
    if (!key) {
      console.warn('[EncryptedAPI] Encryption enabled but no key - returning encrypted data');
      return nodes;
    }
    
    // Decrypt all nodes
    console.log('[EncryptedAPI] Decrypting', nodes.length, 'nodes...');
    const decryptedNodes = [];
    for (const node of nodes) {
      const decrypted = await decryptNodeData(node);
      console.log('[EncryptedAPI] Node', node.id, 'decryption - first field:', node.data?.firstName?.substring(0, 20), '→', decrypted.data?.firstName?.substring(0, 20));
      decryptedNodes.push(decrypted);
    }
    
    return decryptedNodes;
  },
  
  async loadEdges() {
    const edges = await baseApi.loadEdges();
    
    if (!isEncryptionEnabled()) {
      return edges;
    }
    
    // Decrypt all edges
    const decryptedEdges = [];
    for (const edge of edges) {
      decryptedEdges.push(await decryptEdgeData(edge));
    }
    
    return decryptedEdges;
  },
  
  async loadImages() {
    const images = await baseApi.loadImages();
    
    if (!isEncryptionEnabled()) {
      return images;
    }
    
    // Decrypt all images
    const decryptedImages = [];
    for (const image of images) {
      decryptedImages.push(await decryptImageData(image));
    }
    
    return decryptedImages;
  },
  
  // Node operations with encryption
  async createNode(node, socketId = null) {
    let nodeToSend = { ...node };
    
    // Handle geocoding if enabled and data has address fields
    if (!shouldSkipGeocoding() && node.data) {
      const { city, zip, country } = node.data;
      if (city || zip || country) {
        const coords = await geocodeAddress(city, zip, country);
        nodeToSend.data = {
          ...nodeToSend.data,
          latitude: coords.latitude,
          longitude: coords.longitude
        };
      }
    }
    
    // Encrypt if encryption is enabled
    nodeToSend = await encryptNodeData(nodeToSend);
    
    // Send to backend
    const result = await baseApi.createNode(nodeToSend, socketId);
    
    // Decrypt response if needed
    if (result && result.id) {
      // Backend might return the created node, decrypt it
      return result;
    }
    
    return result;
  },
  
  async updateNode(id, updates, socketId = null) {
    let updatesToSend = { ...updates };
    
    // Handle geocoding if address changed
    if (!shouldSkipGeocoding() && updates.data) {
      const { city, zip, country } = updates.data;
      if (city !== undefined || zip !== undefined || country !== undefined) {
        const coords = await geocodeAddress(
          city || '', 
          zip || '', 
          country || ''
        );
        updatesToSend.data = {
          ...updatesToSend.data,
          latitude: coords.latitude,
          longitude: coords.longitude
        };
      }
    }
    
    // Encrypt the updates
    if (isEncryptionEnabled() && updatesToSend.data) {
      const key = getDerivedKey();
      if (key) {
        const encryptedData = {};
        for (const field of NODE_ENCRYPTED_FIELDS) {
          if (updatesToSend.data[field] !== undefined) {
            if (updatesToSend.data[field] !== null && updatesToSend.data[field] !== '') {
              encryptedData[field] = await encryptValueFast(String(updatesToSend.data[field]), key, true);
            } else {
              encryptedData[field] = updatesToSend.data[field];
            }
          }
        }
        updatesToSend.data = { ...updatesToSend.data, ...encryptedData };
      }
    }
    
    return baseApi.updateNode(id, updatesToSend, socketId);
  },
  
  async deleteNode(id) {
    return baseApi.deleteNode(id);
  },
  
  // Edge operations with encryption
  async createEdge(edge, socketId = null) {
    const encryptedEdge = await encryptEdgeData(edge);
    return baseApi.createEdge(encryptedEdge, socketId);
  },
  
  async updateEdge(id, updates) {
    const encryptedUpdates = await encryptEdgeData(updates);
    return baseApi.updateEdge(id, encryptedUpdates);
  },
  
  async deleteEdge(id) {
    return baseApi.deleteEdge(id);
  },
  
  // Image operations with encryption
  async uploadImage(formData) {
    // Upload the image first (multipart/form-data cannot be encrypted)
    const result = await baseApi.uploadImage(formData);
    
    // If encryption is enabled, immediately encrypt the metadata
    if (isEncryptionEnabled() && result.success && result.image) {
      const imageId = result.image.id;
      
      // Encrypt all metadata fields
      const metadataToEncrypt = {
        filename: result.image.filename,
        originalFilename: result.image.originalFilename,
        s3Key: result.image.s3Key,
        s3Url: result.image.s3Url,
        uploadedBy: result.image.uploadedBy,
        description: result.image.description,
        mimeType: result.image.mimeType,
        uploadDate: result.image.uploadDate
      };
      
      const encryptedMetadata = await encryptImageData(metadataToEncrypt);
      
      // Update the image record with encrypted metadata
      await baseApi.updateImage(imageId, encryptedMetadata);
      
      // Return the decrypted result for the UI
      return {
        ...result,
        image: {
          ...result.image,
          // Keep the original decrypted values for immediate UI display
        }
      };
    }
    
    return result;
  },
  
  async getImage(id) {
    const image = await baseApi.getImage(id);
    return await decryptImageData(image);
  },
  
  async updateImage(id, updates) {
    const encryptedUpdates = await encryptImageData(updates);
    const result = await baseApi.updateImage(id, encryptedUpdates);
    return result;
  },
  
  async updateImageDescription(id, description) {
    // Validate description length (max 1000 chars)
    if (description && description.length > 1000) {
      throw new Error('Description cannot exceed 1000 characters');
    }
    
    const encryptedUpdate = await encryptImageData({ description });
    const result = await baseApi.updateImageDescription(id, encryptedUpdate.description);
    return result;
  },

  async deleteImage(id) {
    return baseApi.deleteImage(id);
  },
  
  async loadPersonImages(personId) {
    const images = await baseApi.loadPersonImages(personId);
    
    if (!isEncryptionEnabled()) {
      return images;
    }
    
    // Decrypt all images
    const decryptedImages = [];
    for (const image of images) {
      decryptedImages.push(await decryptImageData(image));
    }
    
    return decryptedImages;
  },
  
  // Image-person tagging operations with encryption
  async tagPersonInImage(imageId, personId, positionX = null, positionY = null, width = null, height = null) {
    // Position data is part of IMAGE_PEOPLE_ENCRYPTED_FIELDS if encryption is enabled
    // For now, pass through as-is since positions are stored separately
    return baseApi.tagPersonInImage(imageId, personId, positionX, positionY, width, height);
  },
  
  async removePersonFromImage(imageId, personId) {
    return baseApi.removePersonFromImage(imageId, personId);
  },
  
  async updatePersonPositionInImage(imageId, personId, positionX, positionY, width, height) {
    return baseApi.updatePersonPositionInImage(imageId, personId, positionX, positionY, width, height);
  },
  
  async getImageTags(imageId) {
    return baseApi.getImageTags(imageId);
  },
  
  async setPreferredImage(personId, imageId) {
    return baseApi.setPreferredImage(personId, imageId);
  },
  
  // Chat operations with encryption
  async getChatMessages(imageId) {
    const messages = await baseApi.getChatMessages(imageId);
    
    const encEnabled = isEncryptionEnabled();
    const key = getDerivedKey();
    console.log('[EncryptedAPI] getChatMessages - encryption enabled:', encEnabled, 'has key:', !!key, 'messages count:', messages?.length || 0);
    
    if (!encEnabled || !messages || messages.length === 0) {
      console.log('[EncryptedAPI] Returning messages without decryption - encEnabled:', encEnabled, 'messages:', messages?.length || 0);
      return messages;
    }
    
    if (!key) {
      console.warn('[EncryptedAPI] Encryption enabled but no key - returning encrypted messages');
      return messages;
    }
    
    // Decrypt all chat messages
    console.log('[EncryptedAPI] Decrypting', messages.length, 'chat messages...');
    const decryptedMessages = [];
    for (const message of messages) {
      const decrypted = await decryptChatMessageData(message);
      console.log('[EncryptedAPI] Message', message.id, 'decryption - userName:', message.userName?.substring(0, 20), '→', decrypted.userName?.substring(0, 20));
      decryptedMessages.push(decrypted);
    }
    
    return decryptedMessages;
  },
  
  async postChatMessage(imageId, userName, message) {
    // Validate message length (max 300 chars)
    if (message && message.length > 300) {
      throw new Error('Message cannot exceed 300 characters');
    }
    
    // Encrypt the message data
    const encryptedData = await encryptChatMessageData({ userName, message });
    
    const result = await baseApi.postChatMessage(
      imageId,
      encryptedData.userName || userName,
      encryptedData.message || message
    );
    
    // Decrypt the returned message immediately for display
    if (result && (result.id || result.message)) {
      const messageToDecrypt = result.message || result;
      return {
        ...result,
        message: await decryptChatMessageData(messageToDecrypt)
      };
    }
    
    return result;
  },
  
  // Pass through cleanup
  cleanup: baseApi.cleanup,

  /**
   * Change password with automatic re-encryption
   * This is equivalent to: disable encryption → change password → enable encryption
   * @param {string} oldPassword - Current family password
   * @param {string} newPassword - New family password
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<{success: boolean, salt: string}>}
   */
  async changePasswordWithReEncryption(oldPassword, newPassword, onProgress = null) {
    console.log('[EncryptedAPI] Starting password change with re-encryption...');
    
    // Import encryption utilities and session management
    const { getCachedKey, generateSalt } = await import('./encryptionUtilsOptimized');
    const { getEncryptionSalt, startBatchOperation, endBatchOperation } = await import('./encryptionSession');
    
    // Start batch operation mode - pauses geocoding and signals UI to pause renders
    startBatchOperation();
    
    try {
      // Get current encryption salt
      const currentSalt = getEncryptionSalt();
      if (!currentSalt) {
        throw new Error('Encryption is not enabled. Cannot change password.');
      }
    
    // Verify old password by deriving key
    if (onProgress) onProgress({ phase: 'verifying', percent: 0, message: 'Verifying current password...' });
    const oldKey = await getCachedKey(oldPassword, currentSalt);
    if (!oldKey) {
      throw new Error('Failed to verify current password');
    }
    
    // Step 1: Load all data
    if (onProgress) onProgress({ phase: 'loading', percent: 5, message: 'Loading encrypted data...' });
    const [nodes, edges, images, chatMessages] = await Promise.all([
      baseApi.loadNodes(),
      baseApi.loadEdges(),
      baseApi.loadImages(),
      baseApi.loadChatMessages ? baseApi.loadChatMessages() : Promise.resolve([])
    ]);
    
    console.log(`[EncryptedAPI] Loaded: ${nodes.length} nodes, ${edges.length} edges, ${images.length} images, ${chatMessages.length} messages`);
    
    const totalItems = nodes.length + edges.length + images.length + chatMessages.length;
    let processedItems = 0;
    
    if (totalItems === 0) {
      // No data to re-encrypt, just change password
      await baseApi.changeFamilyPassword(newPassword);
      if (onProgress) onProgress({ phase: 'complete', percent: 100, message: 'Password changed (no data to re-encrypt)' });
      return { success: true, salt: currentSalt };
    }
    
    const updateProgress = (phase, message) => {
      const percent = 10 + Math.round((processedItems / totalItems) * 80);
      if (onProgress) {
        onProgress({ phase, percent, message, current: processedItems, total: totalItems });
      }
    };
    
    // Step 2: Decrypt all data with old password
    if (onProgress) onProgress({ phase: 'decrypting', percent: 10, message: 'Decrypting with old password...' });
    console.log('[EncryptedAPI] Decrypting data with old password...');
    
    const decryptedNodes = [];
    for (const node of nodes) {
      const decryptedData = { ...node.data };
      
      for (const field of NODE_ENCRYPTED_FIELDS) {
        if (node.data && node.data[field] && typeof node.data[field] === 'string' && node.data[field].startsWith('enc:')) {
          try {
            decryptedData[field] = await decryptValueFast(node.data[field], oldKey, true);
          } catch (error) {
            console.error(`[EncryptedAPI] Failed to decrypt node ${node.id} field ${field}:`, error);
            throw new Error(`Failed to decrypt data. Please verify your current password is correct.`);
          }
        }
      }
      
      decryptedNodes.push({ ...node, data: decryptedData });
      processedItems++;
      if (processedItems % 5 === 0) updateProgress('decrypting', `Decrypting nodes... (${processedItems}/${totalItems})`);
    }
    
    const decryptedEdges = [];
    for (const edge of edges) {
      const decryptedEdge = { ...edge };
      
      for (const field of EDGE_ENCRYPTED_FIELDS) {
        if (edge[field] && typeof edge[field] === 'string' && edge[field].startsWith('enc:')) {
          try {
            decryptedEdge[field] = await decryptValueFast(edge[field], oldKey, true);
          } catch (error) {
            console.error(`[EncryptedAPI] Failed to decrypt edge ${edge.id} field ${field}:`, error);
            throw new Error(`Failed to decrypt data. Please verify your current password is correct.`);
          }
        }
      }
      
      decryptedEdges.push(decryptedEdge);
      processedItems++;
      if (processedItems % 5 === 0) updateProgress('decrypting', `Decrypting edges... (${processedItems}/${totalItems})`);
    }
    
    const decryptedImages = [];
    for (const image of images) {
      const decryptedImage = { ...image };
      
      for (const field of IMAGE_ENCRYPTED_FIELDS) {
        if (image[field] && typeof image[field] === 'string' && image[field].startsWith('enc:')) {
          try {
            decryptedImage[field] = await decryptValueFast(image[field], oldKey, true);
          } catch (error) {
            console.error(`[EncryptedAPI] Failed to decrypt image ${image.id} field ${field}:`, error);
            throw new Error(`Failed to decrypt data. Please verify your current password is correct.`);
          }
        }
      }
      
      decryptedImages.push(decryptedImage);
      processedItems++;
      if (processedItems % 5 === 0) updateProgress('decrypting', `Decrypting images... (${processedItems}/${totalItems})`);
    }
    
    const decryptedMessages = [];
    for (const message of chatMessages) {
      const decryptedMessage = { ...message };
      
      for (const field of CHAT_MESSAGE_ENCRYPTED_FIELDS) {
        if (message[field] && typeof message[field] === 'string' && message[field].startsWith('enc:')) {
          try {
            decryptedMessage[field] = await decryptValueFast(message[field], oldKey, true);
          } catch (error) {
            console.error(`[EncryptedAPI] Failed to decrypt message ${message.id} field ${field}:`, error);
            throw new Error(`Failed to decrypt data. Please verify your current password is correct.`);
          }
        }
      }
      
      decryptedMessages.push(decryptedMessage);
      processedItems++;
      if (processedItems % 5 === 0) updateProgress('decrypting', `Decrypting messages... (${processedItems}/${totalItems})`);
    }
    
    // Step 3: Generate new salt and derive new key
    if (onProgress) onProgress({ phase: 'deriving_key', percent: 45, message: 'Generating new encryption key...' });
    const newSalt = generateSalt();
    const newKey = await getCachedKey(newPassword, newSalt);
    console.log('[EncryptedAPI] Generated new salt and derived new key');
    
    // Step 4: Re-encrypt all data with new password
    if (onProgress) onProgress({ phase: 'encrypting', percent: 50, message: 'Encrypting with new password...' });
    console.log('[EncryptedAPI] Re-encrypting data with new password...');
    
    processedItems = 0;
    
    for (const node of decryptedNodes) {
      const encryptedData = { ...node.data };
      
      for (const field of NODE_ENCRYPTED_FIELDS) {
        if (node.data && node.data[field] !== null && node.data[field] !== undefined && node.data[field] !== '') {
          encryptedData[field] = await encryptValueFast(String(node.data[field]), newKey, true);
        }
      }
      
      await baseApi.updateNode(node.id, { position: node.position, data: encryptedData });
      processedItems++;
      if (processedItems % 5 === 0) updateProgress('encrypting', `Encrypting nodes... (${processedItems}/${totalItems})`);
    }
    
    for (const edge of decryptedEdges) {
      const encryptedEdge = { ...edge };
      
      for (const field of EDGE_ENCRYPTED_FIELDS) {
        if (edge[field] !== null && edge[field] !== undefined && edge[field] !== '') {
          encryptedEdge[field] = await encryptValueFast(String(edge[field]), newKey, true);
        }
      }
      
      await baseApi.updateEdge(edge.id, encryptedEdge);
      processedItems++;
      if (processedItems % 5 === 0) updateProgress('encrypting', `Encrypting edges... (${processedItems}/${totalItems})`);
    }
    
    for (const image of decryptedImages) {
      const encryptedImage = { ...image };
      
      for (const field of IMAGE_ENCRYPTED_FIELDS) {
        if (image[field] !== null && image[field] !== undefined && image[field] !== '') {
          encryptedImage[field] = await encryptValueFast(String(image[field]), newKey, true);
        }
      }
      
      await baseApi.updateImage(image.id, encryptedImage);
      processedItems++;
      if (processedItems % 5 === 0) updateProgress('encrypting', `Encrypting images... (${processedItems}/${totalItems})`);
    }
    
    for (const message of decryptedMessages) {
      const encryptedMessage = { ...message };
      
      for (const field of CHAT_MESSAGE_ENCRYPTED_FIELDS) {
        if (message[field] !== null && message[field] !== undefined && message[field] !== '') {
          encryptedMessage[field] = await encryptValueFast(String(message[field]), newKey, true);
        }
      }
      
      await baseApi.updateChatMessage(message.id, encryptedMessage);
      processedItems++;
      if (processedItems % 5 === 0) updateProgress('encrypting', `Encrypting messages... (${processedItems}/${totalItems})`);
    }
    
    // Step 5: Update encryption settings with new salt and change password
    if (onProgress) onProgress({ phase: 'saving_settings', percent: 95, message: 'Updating password and encryption settings...' });
    await baseApi.setEncryption(true, newSalt);
    await baseApi.changeFamilyPassword(newPassword);
    
    console.log('[EncryptedAPI] Password changed and data re-encrypted successfully');
    if (onProgress) onProgress({ phase: 'complete', percent: 100, message: 'Password changed and data re-encrypted successfully!' });
    
    return { success: true, salt: newSalt };
    
    } catch (error) {
      console.error('[EncryptedAPI] Error during password change:', error);
      throw error;
    } finally {
      // Always end batch operation mode to restore normal operation
      endBatchOperation();
    }
  }
};

export default encryptedApi;

// Export utility functions for use in other components
export { decryptNodeData, decryptEdgeData };
