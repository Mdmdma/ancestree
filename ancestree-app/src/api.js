// Use environment variable for API URL, fallback to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// Import encryption utilities
import { encryptNode, decryptNode, encryptNodes, decryptNodes } from './utils/encryption.js';

// Export the base URL for use in other components
export { API_BASE_URL };

// Authentication token management
let authToken = localStorage.getItem('authToken');
let currentPassphrase = null; // Store current passphrase for encryption

// Set passphrase for encryption
export const setPassphrase = (passphrase) => {
  currentPassphrase = passphrase;
};

// Clear passphrase
export const clearPassphrase = () => {
  currentPassphrase = null;
};

// Helper function to get auth headers
const getAuthHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
};

// Set auth token
export const setAuthToken = (token) => {
  authToken = token;
  if (token) {
    localStorage.setItem('authToken', token);
  } else {
    localStorage.removeItem('authToken');
  }
};

// Get auth token
export const getAuthToken = () => authToken;

// Helper function to get the Socket.IO server URL from the API base URL
export const getSocketServerUrl = () => {
  // In production, if using relative API URL, use the current origin
  if (API_BASE_URL.startsWith('/')) {
    return window.location.origin;
  }
  // Remove '/api' suffix if present to get the base server URL
  return API_BASE_URL.replace('/api', '');
};

export const api = {
  // Authentication operations
  async checkAuthStatus() {
    const response = await fetch(`${API_BASE_URL}/auth/status`);
    return response.json();
  },

  async login(familyName, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyName, password })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Login failed');
    }
    
    // Store the token
    setAuthToken(result.token);
    return result;
  },

  async register(familyName, password) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyName, password })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Registration failed');
    }
    
    // Store the token
    setAuthToken(result.token);
    return result;
  },

  async verifyToken() {
    const response = await fetch(`${API_BASE_URL}/auth/verify`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Token verification failed');
    }
    
    return response.json();
  },

  logout() {
    setAuthToken(null);
  },

  // Load initial data
  async loadNodes() {
    const response = await fetch(`${API_BASE_URL}/nodes`, {
      headers: getAuthHeaders()
    });
    const nodes = await response.json();
    
    // Decrypt nodes if we have a passphrase
    if (currentPassphrase && nodes) {
      return decryptNodes(nodes, currentPassphrase);
    }
    return nodes;
  },

  async loadEdges() {
    const response = await fetch(`${API_BASE_URL}/edges`, {
      headers: getAuthHeaders()
    });
    return response.json();
  },

  // Node operations
  async createNode(node) {
    // Encrypt node data before sending to backend
    const nodeToSend = currentPassphrase ? encryptNode(node, currentPassphrase) : node;
    
    const response = await fetch(`${API_BASE_URL}/nodes`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(nodeToSend)
    });
    return response.json();
  },

  async updateNode(id, updates) {
    // Encrypt node data before sending to backend
    const updatesToSend = currentPassphrase ? encryptNode(updates, currentPassphrase) : updates;
    
    const response = await fetch(`${API_BASE_URL}/nodes/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updatesToSend)
    });
    return response.json();
  },

  async deleteNode(id) {
    const response = await fetch(`${API_BASE_URL}/nodes/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return response.json();
  },

  // Edge operations
  async createEdge(edge) {
    const response = await fetch(`${API_BASE_URL}/edges`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(edge)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to create edge');
    }
    
    return result;
  },

  async deleteEdge(id) {
    const response = await fetch(`${API_BASE_URL}/edges/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return response.json();
  },

  // Database operations
  async resetDatabase() {
    const response = await fetch(`${API_BASE_URL}/reset`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return response.json();
  },

  async cleanupDatabase() {
    const response = await fetch(`${API_BASE_URL}/cleanup`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return response.json();
  },

  // Image operations
  async uploadImage(file, description = '', uploadedBy = 'anonymous') {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('description', description);
    formData.append('uploaded_by', uploadedBy);

    const authHeaders = getAuthHeaders();
    delete authHeaders['Content-Type']; // Remove Content-Type for FormData

    const response = await fetch(`${API_BASE_URL}/images/upload`, {
      method: 'POST',
      headers: authHeaders,
      body: formData
    });
    return response.json();
  },

  async loadImages() {
    const response = await fetch(`${API_BASE_URL}/images`, {
      headers: getAuthHeaders()
    });
    return response.json();
  },

  async getImage(id) {
    const response = await fetch(`${API_BASE_URL}/images/${id}`, {
      headers: getAuthHeaders()
    });
    return response.json();
  },

  async updateImageDescription(id, description) {
    const response = await fetch(`${API_BASE_URL}/images/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ description })
    });
    return response.json();
  },

  async deleteImage(id) {
    const response = await fetch(`${API_BASE_URL}/images/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return response.json();
  },

  // Image-person associations
  async tagPersonInImage(imageId, personId, positionX = null, positionY = null, width = null, height = null) {
    const response = await fetch(`${API_BASE_URL}/images/${imageId}/people`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ 
        personId, 
        positionX, 
        positionY, 
        width, 
        height 
      })
    });
    return response.json();
  },

  async removePersonFromImage(imageId, personId) {
    const response = await fetch(`${API_BASE_URL}/images/${imageId}/people/${personId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return response.json();
  },

  async updatePersonPositionInImage(imageId, personId, positionX, positionY, width, height) {
    const response = await fetch(`${API_BASE_URL}/images/${imageId}/people/${personId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ 
        positionX, 
        positionY, 
        width, 
        height 
      })
    });
    return response.json();
  },

  // Preferred image operations
  async setPreferredImage(personId, imageId) {
    const response = await fetch(`${API_BASE_URL}/nodes/${personId}/preferred-image`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ imageId })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to set preferred image');
    }
    
    return response.json();
  },

  // Geocoding operations
  async geocodeAddress(address) {
    const response = await fetch(`${API_BASE_URL}/geocode`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ address })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to geocode address');
    }
    
    return response.json();
  }
};