/**
 * Encryption API Wrapper
 * Wraps all API calls to automatically encrypt/decrypt data based on session state
 */

import { api as baseApi } from './api';
import {
  isEncryptionEnabled,
  getDerivedKey
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
    return node;
  }
  
  const key = getDerivedKey();
  if (!key) {
    console.warn('[EncryptionAPI] Encryption enabled but no key available');
    return node;
  }
  
  const encrypted = { ...node };
  
  if (node.data) {
    encrypted.data = { ...node.data };
    
    // Encrypt each field
    for (const field of NODE_ENCRYPTED_FIELDS) {
      if (node.data[field] !== null && node.data[field] !== undefined && node.data[field] !== '') {
        // Convert numbers to strings for encryption
        const value = String(node.data[field]);
        encrypted.data[field] = await encryptValueFast(value, key, true);
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
  
  const decrypted = { ...node };
  
  if (node.data) {
    decrypted.data = { ...node.data };
    
    // Decrypt each field
    for (const field of NODE_ENCRYPTED_FIELDS) {
      if (node.data[field] && typeof node.data[field] === 'string' && node.data[field].startsWith('enc:')) {
        const decryptedValue = await decryptValueFast(node.data[field], key, true);
        
        // Convert back to numbers for latitude/longitude
        if (field === 'latitude' || field === 'longitude') {
          decrypted.data[field] = decryptedValue ? parseFloat(decryptedValue) : null;
        } else {
          decrypted.data[field] = decryptedValue;
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
  
  const decrypted = { ...edge };
  
  for (const field of EDGE_ENCRYPTED_FIELDS) {
    if (edge[field] && typeof edge[field] === 'string' && edge[field].startsWith('enc:')) {
      decrypted[field] = await decryptValueFast(edge[field], key, true);
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
  
  for (const field of IMAGE_ENCRYPTED_FIELDS) {
    if (image[field] && typeof image[field] === 'string' && image[field].startsWith('enc:')) {
      decrypted[field] = await decryptValueFast(image[field], key, true);
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
  
  // Geocoding for encryption
  async geocodeForEncryption(city, zip, country) {
    return baseApi.geocodeForEncryption(city, zip, country);
  },
  
  // Load operations with decryption
  async loadNodes() {
    const nodes = await baseApi.loadNodes();
    
    if (!isEncryptionEnabled()) {
      return nodes;
    }
    
    // Decrypt all nodes
    const decryptedNodes = [];
    for (const node of nodes) {
      decryptedNodes.push(await decryptNodeData(node));
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
    
    // Geocoding is now handled client-side via geocodingService
    // No need to geocode here anymore
    
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
    
    // Geocoding is now handled client-side via geocodingService
    // No need to geocode here anymore
    
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
    // Images are uploaded as multipart/form-data
    // We'll need to encrypt metadata after upload
    return baseApi.uploadImage(formData);
  },
  
  async updateImage(id, updates) {
    const encryptedUpdates = await encryptImageData(updates);
    return baseApi.updateImage(id, encryptedUpdates);
  },
  
  async deleteImage(id) {
    return baseApi.deleteImage(id);
  },
  
  // Pass through other image operations
  tagPersonInImage: baseApi.tagPersonInImage,
  untagPersonFromImage: baseApi.untagPersonFromImage,
  getImageTags: baseApi.getImageTags,
  
  // Pass through chat operations (encryption would be applied if needed)
  sendChatMessage: baseApi.sendChatMessage,
  getChatMessages: baseApi.getChatMessages,
  
  // Pass through cleanup
  cleanup: baseApi.cleanup
};

export default encryptedApi;
