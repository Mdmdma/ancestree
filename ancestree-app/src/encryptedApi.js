/**
 * Encryption middleware layer for API calls
 * Automatically encrypts data before sending to server and decrypts data received from server
 */

import { api } from './api';
import {
  encryptNode,
  decryptNode,
  encryptImage,
  decryptImage,
  encryptChatMessage,
  decryptChatMessage,
  encryptArray,
  decryptArray,
  generateSalt
} from './encryptionUtils';

// Store encryption state
let encryptionEnabled = false;
let encryptionSalt = null;
let familyPassword = null;

/**
 * Initialize encryption settings
 */
export const initializeEncryption = async (password) => {
  familyPassword = password;
  
  try {
    const settings = await api.getFamilySettings();
    encryptionEnabled = settings.encryptionEnabled;
    encryptionSalt = settings.encryptionSalt;
    
    return { encryptionEnabled, encryptionSalt };
  } catch (error) {
    console.error('Failed to initialize encryption settings:', error);
    encryptionEnabled = false;
    encryptionSalt = null;
    return { encryptionEnabled: false, encryptionSalt: null };
  }
};

/**
 * Get current encryption status
 */
export const getEncryptionStatus = () => ({
  enabled: encryptionEnabled,
  salt: encryptionSalt
});

/**
 * Enable encryption with progress reporting and batching
 */
export const enableEncryption = async (onProgress = null) => {
  if (!familyPassword) {
    throw new Error('Family password not set. Please log in again.');
  }
  
  // Generate salt
  const salt = generateSalt();
  
  if (onProgress) onProgress({ phase: 'loading', percent: 0, message: 'Loading data...' });
  
  // Get all current data
  const nodes = await api.loadNodes();
  const images = await api.loadImages();
  
  const totalItems = nodes.length + images.length;
  let processedItems = 0;
  
  if (onProgress) onProgress({ phase: 'encrypting', percent: 0, message: 'Encrypting data...', total: totalItems, current: 0 });
  
  // Encrypt nodes in batches
  const BATCH_SIZE = 10;
  const encryptedNodes = [];
  
  for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
    const batch = nodes.slice(i, i + BATCH_SIZE);
    const encryptedBatch = await Promise.all(
      batch.map(node => encryptNode(node, familyPassword, salt))
    );
    encryptedNodes.push(...encryptedBatch);
    processedItems += batch.length;
    
    if (onProgress) {
      onProgress({ 
        phase: 'encrypting', 
        percent: Math.round((processedItems / totalItems) * 50), 
        message: `Encrypting data... (${processedItems}/${totalItems})`,
        total: totalItems,
        current: processedItems
      });
    }
  }
  
  // Encrypt images in batches
  const encryptedImages = [];
  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    const batch = images.slice(i, i + BATCH_SIZE);
    const encryptedBatch = await Promise.all(
      batch.map(image => encryptImage(image, familyPassword, salt))
    );
    encryptedImages.push(...encryptedBatch);
    processedItems += batch.length;
    
    if (onProgress) {
      onProgress({ 
        phase: 'encrypting', 
        percent: Math.round((processedItems / totalItems) * 50), 
        message: `Encrypting data... (${processedItems}/${totalItems})`,
        total: totalItems,
        current: processedItems
      });
    }
  }
  
  if (onProgress) onProgress({ phase: 'saving', percent: 50, message: 'Saving encrypted data...' });
  
  // Update encryption status on server first
  await api.setEncryption(true, salt);
  
  let savedItems = 0;
  const totalToSave = encryptedNodes.length + encryptedImages.length;
  
  // Update all nodes in batches
  for (let i = 0; i < encryptedNodes.length; i += BATCH_SIZE) {
    const batch = encryptedNodes.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(node => api.updateNode(node.id, node))
    );
    savedItems += batch.length;
    
    if (onProgress) {
      onProgress({ 
        phase: 'saving', 
        percent: 50 + Math.round((savedItems / totalToSave) * 50), 
        message: `Saving encrypted data... (${savedItems}/${totalToSave})`,
        total: totalToSave,
        current: savedItems
      });
    }
  }
  
  // Update all images in batches
  for (let i = 0; i < encryptedImages.length; i += BATCH_SIZE) {
    const batch = encryptedImages.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(image => api.updateImage(image.id, { description: image.description, original_filename: image.original_filename }))
    );
    savedItems += batch.length;
    
    if (onProgress) {
      onProgress({ 
        phase: 'saving', 
        percent: 50 + Math.round((savedItems / totalToSave) * 50), 
        message: `Saving encrypted data... (${savedItems}/${totalToSave})`,
        total: totalToSave,
        current: savedItems
      });
    }
  }
  
  // Update local state
  encryptionEnabled = true;
  encryptionSalt = salt;
  
  if (onProgress) onProgress({ phase: 'complete', percent: 100, message: 'Encryption enabled successfully!' });
  
  return { success: true };
};

/**
 * Disable encryption with progress reporting and batching
 */
export const disableEncryption = async (onProgress = null) => {
  if (!familyPassword || !encryptionSalt) {
    throw new Error('Cannot disable encryption: missing password or salt');
  }
  
  if (onProgress) onProgress({ phase: 'loading', percent: 0, message: 'Loading data...' });
  
  // Get all current data
  const nodes = await api.loadNodes();
  const images = await api.loadImages();
  
  const totalItems = nodes.length + images.length;
  let processedItems = 0;
  
  if (onProgress) onProgress({ phase: 'decrypting', percent: 0, message: 'Decrypting data...', total: totalItems, current: 0 });
  
  // Decrypt nodes in batches
  const BATCH_SIZE = 10;
  const decryptedNodes = [];
  
  for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
    const batch = nodes.slice(i, i + BATCH_SIZE);
    const decryptedBatch = await Promise.all(
      batch.map(node => decryptNode(node, familyPassword, encryptionSalt))
    );
    decryptedNodes.push(...decryptedBatch);
    processedItems += batch.length;
    
    if (onProgress) {
      onProgress({ 
        phase: 'decrypting', 
        percent: Math.round((processedItems / totalItems) * 50), 
        message: `Decrypting data... (${processedItems}/${totalItems})`,
        total: totalItems,
        current: processedItems
      });
    }
  }
  
  // Decrypt images in batches
  const decryptedImages = [];
  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    const batch = images.slice(i, i + BATCH_SIZE);
    const decryptedBatch = await Promise.all(
      batch.map(image => decryptImage(image, familyPassword, encryptionSalt))
    );
    decryptedImages.push(...decryptedBatch);
    processedItems += batch.length;
    
    if (onProgress) {
      onProgress({ 
        phase: 'decrypting', 
        percent: Math.round((processedItems / totalItems) * 50), 
        message: `Decrypting data... (${processedItems}/${totalItems})`,
        total: totalItems,
        current: processedItems
      });
    }
  }
  
  if (onProgress) onProgress({ phase: 'saving', percent: 50, message: 'Saving decrypted data...' });
  
  // Update encryption status on server
  await api.setEncryption(false, null);
  
  let savedItems = 0;
  const totalToSave = decryptedNodes.length + decryptedImages.length;
  
  // Update all nodes in batches
  for (let i = 0; i < decryptedNodes.length; i += BATCH_SIZE) {
    const batch = decryptedNodes.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(node => api.updateNode(node.id, node))
    );
    savedItems += batch.length;
    
    if (onProgress) {
      onProgress({ 
        phase: 'saving', 
        percent: 50 + Math.round((savedItems / totalToSave) * 50), 
        message: `Saving decrypted data... (${savedItems}/${totalToSave})`,
        total: totalToSave,
        current: savedItems
      });
    }
  }
  
  // Update all images in batches
  for (let i = 0; i < decryptedImages.length; i += BATCH_SIZE) {
    const batch = decryptedImages.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(image => api.updateImage(image.id, { description: image.description, original_filename: image.original_filename }))
    );
    savedItems += batch.length;
    
    if (onProgress) {
      onProgress({ 
        phase: 'saving', 
        percent: 50 + Math.round((savedItems / totalToSave) * 50), 
        message: `Saving decrypted data... (${savedItems}/${totalToSave})`,
        total: totalToSave,
        current: savedItems
      });
    }
  }
  
  // Update local state
  encryptionEnabled = false;
  encryptionSalt = null;
  
  if (onProgress) onProgress({ phase: 'complete', percent: 100, message: 'Encryption disabled successfully!' });
  
  return { success: true };
};

/**
 * Re-encrypt all data with new password with progress reporting and batching
 */
export const reEncryptWithNewPassword = async (oldPassword, newPassword, onProgress = null) => {
  if (!encryptionEnabled || !encryptionSalt) {
    // If encryption is not enabled, just update the password in memory
    familyPassword = newPassword;
    return { success: true };
  }
  
  if (onProgress) onProgress({ phase: 'loading', percent: 0, message: 'Loading data...' });
  
  // Get all current data
  const nodes = await api.loadNodes();
  const images = await api.loadImages();
  
  const totalItems = nodes.length + images.length;
  let processedItems = 0;
  
  if (onProgress) onProgress({ phase: 'decrypting', percent: 0, message: 'Decrypting with old password...', total: totalItems, current: 0 });
  
  // Decrypt with old password in batches
  const BATCH_SIZE = 10;
  const decryptedNodes = [];
  
  for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
    const batch = nodes.slice(i, i + BATCH_SIZE);
    const decryptedBatch = await Promise.all(
      batch.map(node => decryptNode(node, oldPassword, encryptionSalt))
    );
    decryptedNodes.push(...decryptedBatch);
    processedItems += batch.length;
    
    if (onProgress) {
      onProgress({ 
        phase: 'decrypting', 
        percent: Math.round((processedItems / totalItems) * 25), 
        message: `Decrypting with old password... (${processedItems}/${totalItems})`,
        total: totalItems,
        current: processedItems
      });
    }
  }
  
  // Decrypt images with old password in batches
  const decryptedImages = [];
  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    const batch = images.slice(i, i + BATCH_SIZE);
    const decryptedBatch = await Promise.all(
      batch.map(image => decryptImage(image, oldPassword, encryptionSalt))
    );
    decryptedImages.push(...decryptedBatch);
    processedItems += batch.length;
    
    if (onProgress) {
      onProgress({ 
        phase: 'decrypting', 
        percent: Math.round((processedItems / totalItems) * 25), 
        message: `Decrypting with old password... (${processedItems}/${totalItems})`,
        total: totalItems,
        current: processedItems
      });
    }
  }
  
  // Generate new salt
  const newSalt = generateSalt();
  
  processedItems = 0;
  if (onProgress) onProgress({ phase: 'encrypting', percent: 25, message: 'Encrypting with new password...', total: totalItems, current: 0 });
  
  // Encrypt with new password in batches
  const reEncryptedNodes = [];
  for (let i = 0; i < decryptedNodes.length; i += BATCH_SIZE) {
    const batch = decryptedNodes.slice(i, i + BATCH_SIZE);
    const encryptedBatch = await Promise.all(
      batch.map(node => encryptNode(node, newPassword, newSalt))
    );
    reEncryptedNodes.push(...encryptedBatch);
    processedItems += batch.length;
    
    if (onProgress) {
      onProgress({ 
        phase: 'encrypting', 
        percent: 25 + Math.round((processedItems / totalItems) * 25), 
        message: `Encrypting with new password... (${processedItems}/${totalItems})`,
        total: totalItems,
        current: processedItems
      });
    }
  }
  
  // Encrypt images with new password in batches
  const reEncryptedImages = [];
  for (let i = 0; i < decryptedImages.length; i += BATCH_SIZE) {
    const batch = decryptedImages.slice(i, i + BATCH_SIZE);
    const encryptedBatch = await Promise.all(
      batch.map(image => encryptImage(image, newPassword, newSalt))
    );
    reEncryptedImages.push(...encryptedBatch);
    processedItems += batch.length;
    
    if (onProgress) {
      onProgress({ 
        phase: 'encrypting', 
        percent: 25 + Math.round((processedItems / totalItems) * 25), 
        message: `Encrypting with new password... (${processedItems}/${totalItems})`,
        total: totalItems,
        current: processedItems
      });
    }
  }
  
  if (onProgress) onProgress({ phase: 'saving', percent: 50, message: 'Saving re-encrypted data...' });
  
  // Update encryption salt on server
  await api.setEncryption(true, newSalt);
  
  let savedItems = 0;
  const totalToSave = reEncryptedNodes.length + reEncryptedImages.length;
  
  // Update all nodes in batches
  for (let i = 0; i < reEncryptedNodes.length; i += BATCH_SIZE) {
    const batch = reEncryptedNodes.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(node => api.updateNode(node.id, node))
    );
    savedItems += batch.length;
    
    if (onProgress) {
      onProgress({ 
        phase: 'saving', 
        percent: 50 + Math.round((savedItems / totalToSave) * 50), 
        message: `Saving re-encrypted data... (${savedItems}/${totalToSave})`,
        total: totalToSave,
        current: savedItems
      });
    }
  }
  
  // Update all images in batches
  for (let i = 0; i < reEncryptedImages.length; i += BATCH_SIZE) {
    const batch = reEncryptedImages.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(image => api.updateImage(image.id, { description: image.description, original_filename: image.original_filename }))
    );
    savedItems += batch.length;
    
    if (onProgress) {
      onProgress({ 
        phase: 'saving', 
        percent: 50 + Math.round((savedItems / totalToSave) * 50), 
        message: `Saving re-encrypted data... (${savedItems}/${totalToSave})`,
        total: totalToSave,
        current: savedItems
      });
    }
  }
  
  // Update local state
  familyPassword = newPassword;
  encryptionSalt = newSalt;
  
  if (onProgress) onProgress({ phase: 'complete', percent: 100, message: 'Password changed and data re-encrypted successfully!' });
  
  return { success: true };
};

/**
 * Wrapped API methods with automatic encryption/decryption
 */
export const encryptedApi = {
  // Initialize
  async initialize(password) {
    return await initializeEncryption(password);
  },

  // Node operations
  async loadNodes() {
    const nodes = await api.loadNodes();
    if (!encryptionEnabled || !familyPassword || !encryptionSalt) {
      return nodes;
    }
    return await decryptArray(nodes, familyPassword, encryptionSalt, decryptNode);
  },

  async createNode(node, socketId = null) {
    let nodeToSend = node;
    if (encryptionEnabled && familyPassword && encryptionSalt) {
      nodeToSend = await encryptNode(node, familyPassword, encryptionSalt);
    }
    const result = await api.createNode(nodeToSend, socketId);
    
    // Decrypt the returned node if needed
    if (encryptionEnabled && familyPassword && encryptionSalt) {
      return await decryptNode(result, familyPassword, encryptionSalt);
    }
    return result;
  },

  async updateNode(id, updates, socketId = null) {
    let updatesToSend = updates;
    if (encryptionEnabled && familyPassword && encryptionSalt) {
      updatesToSend = await encryptNode(updates, familyPassword, encryptionSalt);
    }
    const result = await api.updateNode(id, updatesToSend, socketId);
    
    // Decrypt the returned node if needed
    if (encryptionEnabled && familyPassword && encryptionSalt && result) {
      return await decryptNode(result, familyPassword, encryptionSalt);
    }
    return result;
  },

  async deleteNode(id) {
    return await api.deleteNode(id);
  },

  // Image operations
  async loadImages() {
    const images = await api.loadImages();
    if (!encryptionEnabled || !familyPassword || !encryptionSalt) {
      return images;
    }
    return await decryptArray(images, familyPassword, encryptionSalt, decryptImage);
  },

  async uploadImage(formData) {
    // For file uploads, we don't encrypt the file itself, only metadata
    // Encryption of metadata happens on the server side or through separate update
    return await api.uploadImage(formData);
  },

  async updateImage(id, updates) {
    let updatesToSend = updates;
    if (encryptionEnabled && familyPassword && encryptionSalt) {
      updatesToSend = await encryptImage(updates, familyPassword, encryptionSalt);
    }
    return await api.updateImage(id, updatesToSend);
  },

  async deleteImage(id) {
    return await api.deleteImage(id);
  },

  // Chat operations
  async getChatMessages(imageId) {
    const messages = await api.getChatMessages(imageId);
    if (!encryptionEnabled || !familyPassword || !encryptionSalt) {
      return messages;
    }
    return await decryptArray(messages, familyPassword, encryptionSalt, decryptChatMessage);
  },

  async sendChatMessage(imageId, userName, message) {
    let messageToSend = message;
    let userNameToSend = userName;
    
    if (encryptionEnabled && familyPassword && encryptionSalt) {
      const encrypted = await encryptChatMessage({ user_name: userName, message }, familyPassword, encryptionSalt);
      userNameToSend = encrypted.user_name;
      messageToSend = encrypted.message;
    }
    
    return await api.sendChatMessage(imageId, userNameToSend, messageToSend);
  },

  // Pass-through methods (no encryption needed)
  loadEdges: api.loadEdges.bind(api),
  createEdge: api.createEdge.bind(api),
  deleteEdge: api.deleteEdge.bind(api),
  tagPersonInImage: api.tagPersonInImage.bind(api),
  removePersonFromImage: api.removePersonFromImage.bind(api),
  cleanupDatabase: api.cleanupDatabase.bind(api),
  
  // Encryption management
  getEncryptionStatus,
  enableEncryption,
  disableEncryption,
  reEncryptWithNewPassword
};
