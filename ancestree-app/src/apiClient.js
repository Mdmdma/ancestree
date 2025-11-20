/**
 * Unified API client that automatically handles encryption
 * This is the single source of truth for all API calls
 * Import this instead of api.js or encryptedApi.js directly
 */

import { api as baseApi, setAuthToken, getAuthToken, getSocketServerUrl, API_BASE_URL } from './api';
import { encryptedApi } from './encryptedApi';

// Re-export utilities
export { setAuthToken, getAuthToken, getSocketServerUrl, API_BASE_URL };

/**
 * Smart API client that uses encryptedApi when available, falls back to baseApi
 */
export const api = new Proxy(baseApi, {
  get(target, prop) {
    // If encryptedApi has this method and encryption is initialized, use it
    if (encryptedApi[prop] && typeof encryptedApi[prop] === 'function') {
      return encryptedApi[prop];
    }
    // Otherwise, use the base API
    return target[prop];
  }
});

// Also export encryptedApi for direct access when needed
export { encryptedApi };
