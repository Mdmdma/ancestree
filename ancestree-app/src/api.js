// Use environment variable for API URL, fallback to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// Export the base URL for use in other components
export { API_BASE_URL };

// Authentication token management
let authToken = localStorage.getItem('authToken');

// Helper function to get auth headers
const getAuthHeaders = (socketId = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  if (socketId) {
    headers['X-Socket-Id'] = socketId;
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

  async register(familyName, password, displayName, adminPassword) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyName, password, displayName, adminPassword })
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

  // Admin operations
  async adminLogin(adminPassword) {
    const response = await fetch(`${API_BASE_URL}/auth/admin-login`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ adminPassword })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Admin authentication failed');
    }
    
    return result;
  },

  async changeFamilyPassword(newPassword) {
    const response = await fetch(`${API_BASE_URL}/auth/change-family-password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ newPassword })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to change family password');
    }
    
    return result;
  },

  async changeAdminPassword(newAdminPassword) {
    const response = await fetch(`${API_BASE_URL}/auth/change-admin-password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ newAdminPassword })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to change admin password');
    }
    
    return result;
  },

  // Family settings operations
  async getFamilySettings() {
    const response = await fetch(`${API_BASE_URL}/family/settings`, {
      headers: getAuthHeaders()
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch family settings');
    }
    
    return result;
  },

  async getFamilyPurpose(familyName) {
    const response = await fetch(`${API_BASE_URL}/family/purpose/${encodeURIComponent(familyName)}`);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch family purpose');
    }
    
    return result;
  },

  async updateDisplayName(displayName) {
    const response = await fetch(`${API_BASE_URL}/family/display-name`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ displayName })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to update display name');
    }
    
    return result;
  },

  async updatePurpose(purpose) {
    const response = await fetch(`${API_BASE_URL}/family/purpose`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ purpose })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to update purpose');
    }
    
    return result;
  },

  async setEncryption(enabled, salt) {
    const response = await fetch(`${API_BASE_URL}/family/encryption`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ enabled, salt })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to update encryption setting');
    }
    
    return result;
  },

  // Load initial data
  async loadNodes() {
    const response = await fetch(`${API_BASE_URL}/nodes`, {
      headers: getAuthHeaders()
    });
    const nodes = await response.json();
    return nodes;
  },

  async loadEdges() {
    const response = await fetch(`${API_BASE_URL}/edges`, {
      headers: getAuthHeaders()
    });
    return response.json();
  },

  // Node operations
  async createNode(node, socketId = null) {
    const response = await fetch(`${API_BASE_URL}/nodes`, {
      method: 'POST',
      headers: getAuthHeaders(socketId),
      body: JSON.stringify(node)
    });
    return response.json();
  },

  async updateNode(id, updates, socketId = null) {
    const response = await fetch(`${API_BASE_URL}/nodes/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(socketId),
      body: JSON.stringify(updates)
    });
    return response.json();
  },

  async deleteNode(id) {
    console.log('API: Calling deleteNode for ID:', id);
    const response = await fetch(`${API_BASE_URL}/nodes/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    console.log('API: deleteNode response status:', response.status);
    const result = await response.json();
    console.log('API: deleteNode response body:', result);
    
    // Don't treat 404 as an error since it might mean the node was already deleted
    if (response.status === 404) {
      console.log('API: Node already deleted, treating as success');
      return { success: true, message: 'Node already deleted' };
    }
    
    return result;
  },

  // Edge operations
  async createEdge(edge, socketId = null) {
    const response = await fetch(`${API_BASE_URL}/edges`, {
      method: 'POST',
      headers: getAuthHeaders(socketId),
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

  async updateEdge(id, updates, socketId = null) {
    const response = await fetch(`${API_BASE_URL}/edges/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(socketId),
      body: JSON.stringify(updates)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to update edge');
    }
    
    return result;
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

  // Helper function for exponential backoff retry
  async retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn(attempt);
      } catch (error) {
        lastError = error;
        
        // Don't retry for certain error types
        if (error.message.includes('Invalid file type') || 
            error.message.includes('File too large') ||
            error.message.includes('401') ||
            error.message.includes('403')) {
          throw error;
        }
        
        // If this was the last attempt, throw the error
        if (attempt === maxRetries - 1) {
          throw error;
        }
        
        // Calculate delay with exponential backoff and jitter
        const delay = initialDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(`Upload attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  },

  // Image operations with robust upload
  async uploadImage(file, description, uploadedBy = 'user', onProgress = null) {
    // Validate file on client side before attempting upload
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.');
    }
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error(`File too large. Maximum size is ${maxSize / 1024 / 1024}MB.`);
    }

    // Use retry logic for the upload
    return this.retryWithBackoff(async (attempt) => {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('description', description);
      formData.append('uploaded_by', uploadedBy);

      const authHeaders = getAuthHeaders();
      delete authHeaders['Content-Type']; // Remove Content-Type for FormData

      // Increase timeout for larger files and retry attempts
      const baseTimeout = 60000; // 60 seconds
      const timeoutMultiplier = 1 + (attempt * 0.5); // Increase timeout on retries
      const timeout = baseTimeout * timeoutMultiplier;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        // Use XMLHttpRequest for better progress tracking and mobile compatibility
        const uploadPromise = new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          // Progress tracking
          if (onProgress) {
            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                onProgress(percentComplete, e.loaded, e.total);
              }
            });
          }
          
          // Load event - successful response
          xhr.addEventListener('load', () => {
            clearTimeout(timeoutId);
            
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText);
                resolve(response);
              } catch (e) {
                reject(new Error('Invalid response from server'));
              }
            } else {
              try {
                const errorData = JSON.parse(xhr.responseText);
                reject(new Error(errorData.error || `Upload failed with status ${xhr.status}`));
              } catch (e) {
                reject(new Error(`Upload failed with status ${xhr.status}`));
              }
            }
          });
          
          // Error event - network errors
          xhr.addEventListener('error', () => {
            clearTimeout(timeoutId);
            reject(new Error('Network error. Please check your connection and try again.'));
          });
          
          // Abort event
          xhr.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new Error('Upload timed out. Please try again.'));
          });
          
          // Timeout event
          xhr.addEventListener('timeout', () => {
            clearTimeout(timeoutId);
            reject(new Error('Upload timed out. Please try again.'));
          });
          
          // Open and send request
          xhr.open('POST', `${API_BASE_URL}/images/upload`);
          
          // Set auth header
          if (authToken) {
            xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
          }
          
          // Set timeout
          xhr.timeout = timeout;
          
          // Send the form data
          xhr.send(formData);
          
          // Wire up abort controller
          controller.signal.addEventListener('abort', () => {
            xhr.abort();
          });
        });

        return await uploadPromise;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    }, 3, 1000); // 3 retries, starting with 1 second delay
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

  async updateImage(id, updates) {
    const response = await fetch(`${API_BASE_URL}/images/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates)
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

  async loadPersonImages(personId) {
    const response = await fetch(`${API_BASE_URL}/people/${personId}/images`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to load person images');
    }
    
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
  },

  // Chat operations
  async getChatMessages(imageId) {
    const response = await fetch(`${API_BASE_URL}/images/${imageId}/chat`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load chat messages');
    }
    
    return response.json();
  },

  async postChatMessage(imageId, userName, message) {
    const response = await fetch(`${API_BASE_URL}/images/${imageId}/chat`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userName, message })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to post chat message');
    }
    
    return response.json();
  },

  async deleteChatMessage(imageId, messageId) {
    const response = await fetch(`${API_BASE_URL}/images/${imageId}/chat/${messageId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete chat message');
    }
    
    return response.json();
  }
};