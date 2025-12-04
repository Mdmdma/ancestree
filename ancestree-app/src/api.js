// Use environment variable for API URL, fallback to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// Export the base URL for use in other components
export { API_BASE_URL };

/**
 * Sanitize filename for cross-platform compatibility (Android, iOS, web)
 * - Extracts just the filename from any path format (Windows backslash, Unix forward slash)
 * - Removes problematic characters while keeping the extension
 * - Falls back to a safe default name if needed
 */
const sanitizeFilename = (filename) => {
  if (!filename || typeof filename !== 'string') {
    return 'image.jpg';
  }
  
  // Extract just the filename from any path format
  // Handle both forward slashes (Unix/Android) and backslashes (Windows)
  let baseName = filename.split(/[\\/]/).pop() || filename;
  
  // Remove any query strings or fragments (sometimes present on mobile)
  baseName = baseName.split('?')[0].split('#')[0];
  
  // If the filename is empty after extraction, use a default
  if (!baseName || baseName.trim() === '') {
    return 'image.jpg';
  }
  
  // Extract extension and base name
  const lastDot = baseName.lastIndexOf('.');
  let name = lastDot > 0 ? baseName.substring(0, lastDot) : baseName;
  let ext = lastDot > 0 ? baseName.substring(lastDot) : '.jpg';
  
  // Sanitize the name part - keep alphanumeric, dashes, underscores
  name = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  
  // Ensure we have a valid name
  if (!name || name.trim() === '' || name === '_') {
    name = 'image';
  }
  
  // Ensure extension is lowercase and valid
  ext = ext.toLowerCase();
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  if (!validExtensions.includes(ext)) {
    ext = '.jpg';
  }
  
  return name + ext;
};

// Authentication token management
let authToken = localStorage.getItem('authToken');

// Logout callback for when decryption key is unavailable
let logoutCallback = null;

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

// Set logout callback for encryption key check failures
export const setLogoutCallback = (callback) => {
  logoutCallback = callback;
};

// Trigger logout from API layer
export const triggerLogout = () => {
  console.log('🔴 [API] triggerLogout called - encryption key unavailable');
  
  if (logoutCallback) {
    console.log('[API] Executing logout callback...');
    try {
      logoutCallback();
      console.log('[API] Logout callback executed successfully');
    } catch (error) {
      console.error('[API] Error executing logout callback:', error);
    }
  } else {
    console.error('[API] No logout callback registered');
  }
};

// Store last logged-in family name for auto-fill after forced logout
export const setLastFamilyName = (familyName) => {
  if (familyName) {
    localStorage.setItem('lastFamilyName', familyName);
  }
};

// Get last logged-in family name
export const getLastFamilyName = () => {
  return localStorage.getItem('lastFamilyName') || '';
};

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

  async register(familyName, password, displayName, adminPassword, adminEmail, betaAccessPassword, termsAccepted, termsVersion) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyName, password, displayName, adminPassword, adminEmail, betaAccessPassword, termsAccepted, termsVersion })
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

  async deleteFamily(adminPassword) {
    const response = await fetch(`${API_BASE_URL}/auth/delete-family`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ adminPassword })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to delete family');
    }
    
    return result;
  },

  // Terms and Conditions operations
  async getTermsVersion() {
    const response = await fetch(`${API_BASE_URL}/terms/version`);
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to get terms version');
    }
    
    return result;
  },

  async getTermsStatus() {
    const response = await fetch(`${API_BASE_URL}/terms/status`, {
      headers: getAuthHeaders()
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to get terms status');
    }
    
    return result;
  },

  async acceptTerms(adminPassword, termsVersion) {
    const response = await fetch(`${API_BASE_URL}/terms/accept`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ adminPassword, termsVersion })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to accept terms');
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

  // Completion settings operations
  async getCompletionSettings() {
    const response = await fetch(`${API_BASE_URL}/completion/settings`, {
      headers: getAuthHeaders()
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch completion settings');
    }
    
    return result;
  },

  async updateCompletionSettings(settings) {
    const response = await fetch(`${API_BASE_URL}/completion/settings`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(settings)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to update completion settings');
    }
    
    return result;
  },

  // Admin settings operations (key-value store in family database)
  async getAdminSettings() {
    const response = await fetch(`${API_BASE_URL}/admin/settings`, {
      headers: getAuthHeaders()
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch admin settings');
    }
    
    return result;
  },

  async getAdminSetting(key) {
    const response = await fetch(`${API_BASE_URL}/admin/setting/${encodeURIComponent(key)}`, {
      headers: getAuthHeaders()
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch admin setting');
    }
    
    return result;
  },

  async setAdminSetting(key, value) {
    const response = await fetch(`${API_BASE_URL}/admin/setting`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ key, value })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to update admin setting');
    }
    
    return result;
  },

  // Legacy methods for backward compatibility - now use admin settings
  async updateDisplayName(displayName) {
    return this.setAdminSetting('display_name', displayName);
  },

  async updatePurpose(purpose) {
    return this.setAdminSetting('purpose', purpose);
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

  async updateStreetFieldsVisibility(showStreetFields) {
    const response = await fetch(`${API_BASE_URL}/family/street-fields-visibility`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ showStreetFields })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to update street fields visibility setting');
    }
    
    return result;
  },

  async updatePhoneFieldVisibility(showPhoneField) {
    const response = await fetch(`${API_BASE_URL}/family/phone-field-visibility`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ showPhoneField })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to update phone field visibility setting');
    }
    
    return result;
  },

  async updateEmailFieldVisibility(showEmailField) {
    const response = await fetch(`${API_BASE_URL}/family/email-field-visibility`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ showEmailField })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to update email field visibility setting');
    }
    
    return result;
  },

  async updateNodeCreationLock(nodeCreationLocked) {
    const response = await fetch(`${API_BASE_URL}/family/node-creation-lock`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ nodeCreationLocked })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to update node creation lock setting');
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
    
    const result = await response.json();
    
    if (!response.ok) {
      const error = new Error(result.error || 'Failed to create node');
      error.locked = result.locked;
      throw error;
    }
    
    return result;
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

  // Image operations with presigned URLs for private S3 bucket
  
  // Step 1: Get presigned URL for uploading to S3
  async getPresignedUploadUrl(filename, contentType, fileSize) {
    const response = await fetch(`${API_BASE_URL}/images/presigned-upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ filename, contentType, fileSize })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get upload URL');
    }
    
    return response.json();
  },
  
  // Step 2: Upload file directly to S3 using presigned URL
  // Accepts either a File or Blob object
  async uploadToS3(uploadUrl, fileOrBlob, onProgress = null) {
    return new Promise((resolve, reject) => {
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
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ success: true });
        } else {
          reject(new Error(`S3 upload failed with status ${xhr.status}`));
        }
      });
      
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during S3 upload'));
      });
      
      xhr.addEventListener('abort', () => {
        reject(new Error('S3 upload was aborted'));
      });
      
      xhr.addEventListener('timeout', () => {
        reject(new Error('S3 upload timed out'));
      });
      
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', fileOrBlob.type);
      xhr.timeout = 120000; // 2 minutes for large files
      xhr.send(fileOrBlob);
    });
  },
  
  // Step 3: Confirm upload and save metadata to database
  async confirmImageUpload(s3Key, originalFilename, description, fileSize, mimeType, uploadedBy = 'user') {
    const response = await fetch(`${API_BASE_URL}/images/confirm-upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ 
        s3Key, 
        originalFilename, 
        description, 
        fileSize, 
        mimeType, 
        uploadedBy 
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to confirm upload');
    }
    
    return response.json();
  },
  
  // Combined upload function (handles all 3 steps)
  // Note: For Android compatibility, the file should already be read into memory
  // (as a stable File/Blob) before calling this function. See ImageGallery.jsx.
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

    // Sanitize filename for cross-platform compatibility (Android paths can be problematic)
    const safeFilename = sanitizeFilename(file.name);
    const fileType = file.type;
    const fileSize = file.size;

    // Use retry logic for the upload
    return this.retryWithBackoff(async (attempt) => {
      // Step 1: Get presigned upload URL from backend
      if (onProgress) onProgress(5, 0, fileSize);
      const { uploadUrl, s3Key } = await this.getPresignedUploadUrl(safeFilename, fileType, fileSize);
      
      // Step 2: Upload directly to S3
      if (onProgress) onProgress(10, 0, fileSize);
      await this.uploadToS3(uploadUrl, file, (percent, loaded, total) => {
        // Scale progress from 10% to 90%
        if (onProgress) {
          const scaledPercent = 10 + (percent * 0.8);
          onProgress(scaledPercent, loaded, total);
        }
      });
      
      // Step 3: Confirm upload and save metadata
      if (onProgress) onProgress(95, fileSize, fileSize);
      const result = await this.confirmImageUpload(
        s3Key, 
        safeFilename, 
        description, 
        fileSize, 
        fileType, 
        uploadedBy
      );
      
      if (onProgress) onProgress(100, fileSize, fileSize);
      return result;
    }, 3, 1000); // 3 retries, starting with 1 second delay
  },
  
  // Get presigned view URL for a single image
  async getPresignedViewUrl(imageId) {
    const response = await fetch(`${API_BASE_URL}/images/${imageId}/presigned-url`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get view URL');
    }
    
    return response.json();
  },
  
  // Get presigned view URLs for multiple images (batch) - by image IDs
  async getPresignedViewUrls(imageIds) {
    const response = await fetch(`${API_BASE_URL}/images/presigned-urls`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ imageIds })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get view URLs');
    }
    
    return response.json();
  },
  
  // Get presigned view URLs for multiple images (batch) - by S3 keys (for encrypted data)
  async getPresignedViewUrlsByKeys(s3Keys) {
    const response = await fetch(`${API_BASE_URL}/images/presigned-urls`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ s3Keys })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get view URLs');
    }
    
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

  async updateImage(id, updates) {
    const response = await fetch(`${API_BASE_URL}/images/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    return response.json();
  },

  async toggleImageQuestion(id, hasOpenQuestions) {
    const response = await fetch(`${API_BASE_URL}/images/${id}/question`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ hasOpenQuestions })
    });
    
    if (!response.ok) {
      throw new Error('Failed to toggle image question');
    }
    
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

  // Image proxy for downloading images (solves CORS issues)
  // Accepts either s3Key (preferred) or s3Url (backwards compatibility)
  async fetchImageViaProxy(s3KeyOrUrl) {
    // Determine if it's a key or URL
    const isUrl = s3KeyOrUrl && (s3KeyOrUrl.startsWith('http://') || s3KeyOrUrl.startsWith('https://'));
    
    const response = await fetch(`${API_BASE_URL}/images/proxy`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(isUrl ? { s3Url: s3KeyOrUrl } : { s3Key: s3KeyOrUrl })
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch image via proxy');
    }
    
    // Return as blob for further processing
    return response.blob();
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
  
  async loadChatMessages() {
    const response = await fetch(`${API_BASE_URL}/chat-messages`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load all chat messages');
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
  
  async updateChatMessage(id, updates) {
    const response = await fetch(`${API_BASE_URL}/chat-messages/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update chat message');
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

// Export the base API for internal use by encryptedApi
export const baseApi = api;

// Note: The main 'api' export above is the base API without encryption.
// Components should use this base API, but for data operations (nodes, edges, images),
// the encryptedApi wrapper will automatically handle encryption/decryption when enabled.
// Importing { api } from './api' gives you the base API.
// Importing { encryptedApi } from './encryptedApi' gives you the encryption-aware wrapper.
