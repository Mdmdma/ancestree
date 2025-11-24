/**
 * Encryption Session Manager
 * Manages encryption key lifecycle, password storage, and session state
 */

import { getCachedKey, clearCachedKey, hasCachedKey, generateSalt } from './encryptionUtilsOptimized';

// Session state
let sessionState = {
  familyPassword: null,
  encryptionEnabled: false,
  encryptionSalt: null,
  derivedKey: null,
  skipGeocoding: false,
  familyName: null,
  isBatchOperationInProgress: false, // Flag to indicate when batch encryption/decryption is happening
  originalSkipGeocoding: false, // Store original setting to restore after batch operation
  pauseKeyCheck: false // Flag to pause key availability checks during sensitive operations
};

/**
 * Initialize encryption session on login
 * @param {string} familyPassword - The family password
 * @param {Object} familySettings - Settings from API (encryptionEnabled, encryptionSalt, skipGeocoding)
 * @returns {Promise<Object>} Session state
 */
export const initializeSession = async (familyPassword, familySettings = {}) => {
  console.log('[EncryptionSession] Initializing session with settings:', familySettings);
  
  sessionState.familyPassword = familyPassword;
  sessionState.encryptionEnabled = Boolean(familySettings.encryptionEnabled);
  sessionState.encryptionSalt = familySettings.encryptionSalt || null;
  sessionState.skipGeocoding = Boolean(familySettings.skipGeocoding);
  sessionState.familyName = familySettings.familyName || null;
  
  console.log('[EncryptionSession] Session state set - encryptionEnabled:', sessionState.encryptionEnabled, 'has salt:', !!sessionState.encryptionSalt);
  
  // If encryption is enabled, derive the key immediately
  if (sessionState.encryptionEnabled && sessionState.encryptionSalt) {
    console.log('[EncryptionSession] Encryption enabled, deriving key...');
    sessionState.derivedKey = await getCachedKey(familyPassword, sessionState.encryptionSalt);
    console.log('[EncryptionSession] Key derived and cached, key exists:', !!sessionState.derivedKey);
  } else {
    sessionState.derivedKey = null;
    console.log('[EncryptionSession] Encryption not enabled or no salt');
  }
  
  return getSessionState();
};

/**
 * Update session when encryption is toggled
 * @param {boolean} enabled - Whether encryption is enabled
 * @param {string} salt - The encryption salt (required if enabling)
 * @returns {Promise<Object>} Updated session state
 */
export const updateEncryptionStatus = async (enabled, salt = null) => {
  console.log(`[EncryptionSession] Updating encryption status: ${enabled ? 'enabled' : 'disabled'}`);
  
  sessionState.encryptionEnabled = enabled;
  
  if (enabled) {
    // Enabling encryption - derive key if we have password and salt
    if (!salt) {
      throw new Error('Salt is required when enabling encryption');
    }
    if (!sessionState.familyPassword) {
      throw new Error('Family password not available in session');
    }
    
    sessionState.encryptionSalt = salt;
    sessionState.derivedKey = await getCachedKey(sessionState.familyPassword, salt);
    console.log('[EncryptionSession] Encryption enabled, key cached');
  } else {
    // Disabling encryption - clear key
    sessionState.encryptionSalt = null;
    sessionState.derivedKey = null;
    clearCachedKey();
    console.log('[EncryptionSession] Encryption disabled, key cleared');
  }
  
  return getSessionState();
};

/**
 * Update password and re-derive encryption key
 * Used after password changes to update session with new password
 * @param {string} newPassword - The new family password
 * @param {string} newSalt - The new encryption salt (optional, uses existing if not provided)
 * @returns {Promise<Object>} Updated session state
 */
export const updatePassword = async (newPassword, newSalt = null) => {
  console.log('[EncryptionSession] Updating password in session');
  
  sessionState.familyPassword = newPassword;
  
  // If we have a new salt, update it
  if (newSalt) {
    sessionState.encryptionSalt = newSalt;
  }
  
  // If encryption is enabled, re-derive the key with new password
  if (sessionState.encryptionEnabled && sessionState.encryptionSalt) {
    console.log('[EncryptionSession] Re-deriving key with new password');
    sessionState.derivedKey = await getCachedKey(newPassword, sessionState.encryptionSalt);
    console.log('[EncryptionSession] Key re-derived successfully');
  }
  
  return getSessionState();
};

/**
 * Update skip_geocoding setting
 * @param {boolean} skip - Whether to skip geocoding
 */
export const updateSkipGeocoding = (skip) => {
  sessionState.skipGeocoding = Boolean(skip);
  console.log(`[EncryptionSession] Skip geocoding: ${sessionState.skipGeocoding}`);
};

/**
 * Get current session state
 * @returns {Object} Current session state (without sensitive data)
 */
export const getSessionState = () => {
  return {
    encryptionEnabled: sessionState.encryptionEnabled,
    encryptionSalt: sessionState.encryptionSalt,
    skipGeocoding: sessionState.skipGeocoding,
    hasKey: sessionState.derivedKey !== null,
    hasFamilyPassword: sessionState.familyPassword !== null,
    familyName: sessionState.familyName
  };
};

/**
 * Get the derived encryption key
 * @returns {CryptoKey|null} The derived key or null if not available
 */
export const getDerivedKey = () => {
  if (!sessionState.encryptionEnabled) {
    return null;
  }
  
  if (!sessionState.derivedKey) {
    console.warn('[EncryptionSession] Encryption enabled but key not derived');
  }
  
  return sessionState.derivedKey;
};

/**
 * Get the family password (use carefully!)
 * @returns {string|null} The family password
 */
export const getFamilyPassword = () => {
  return sessionState.familyPassword;
};

/**
 * Get the encryption salt
 * @returns {string|null} The encryption salt
 */
export const getEncryptionSalt = () => {
  return sessionState.encryptionSalt;
};

/**
 * Check if encryption is enabled
 * @returns {boolean} Whether encryption is enabled
 */
export const isEncryptionEnabled = () => {
  return sessionState.encryptionEnabled;
};

/**
 * Check if geocoding should be skipped
 * @returns {boolean} Whether to skip geocoding
 */
export const shouldSkipGeocoding = () => {
  // Always skip geocoding during batch operations
  if (sessionState.isBatchOperationInProgress) {
    return true;
  }
  return sessionState.skipGeocoding;
};

/**
 * Start a batch operation (enables temporary geocoding skip)
 */
export const startBatchOperation = () => {
  console.log('[EncryptionSession] Starting batch operation - pausing geocoding and UI renders');
  sessionState.originalSkipGeocoding = sessionState.skipGeocoding;
  sessionState.isBatchOperationInProgress = true;
  sessionState.skipGeocoding = true; // Force skip geocoding during batch operations
  sessionState.pauseKeyCheck = true; // Pause key availability checks
};

/**
 * End a batch operation (restores original geocoding setting)
 */
export const endBatchOperation = () => {
  console.log('[EncryptionSession] Ending batch operation - restoring normal operation');
  sessionState.isBatchOperationInProgress = false;
  sessionState.skipGeocoding = sessionState.originalSkipGeocoding;
  sessionState.pauseKeyCheck = false; // Resume key availability checks
};

/**
 * Check if a batch operation is in progress
 * @returns {boolean} Whether a batch operation is in progress
 */
export const isBatchOperationInProgress = () => {
  return sessionState.isBatchOperationInProgress;
};

/**
 * Check if session is ready for encryption operations
 * @returns {boolean} Whether session has everything needed for encryption
 */
export const isSessionReady = () => {
  if (!sessionState.encryptionEnabled) {
    return true; // Session is "ready" even if encryption is off
  }
  
  return (
    sessionState.familyPassword !== null &&
    sessionState.encryptionSalt !== null &&
    sessionState.derivedKey !== null
  );
};

/**
 * Re-derive the encryption key (if needed after cache clear)
 * @returns {Promise<CryptoKey>} The derived key
 */
export const reDeriveKey = async () => {
  if (!sessionState.encryptionEnabled) {
    throw new Error('Cannot derive key when encryption is not enabled');
  }
  
  if (!sessionState.familyPassword || !sessionState.encryptionSalt) {
    throw new Error('Cannot derive key: missing password or salt');
  }
  
  console.log('[EncryptionSession] Re-deriving encryption key...');
  sessionState.derivedKey = await getCachedKey(sessionState.familyPassword, sessionState.encryptionSalt);
  return sessionState.derivedKey;
};

/**
 * Pause key availability checks (for sensitive operations like password changes)
 */
export const pauseKeyCheck = () => {
  console.log('[EncryptionSession] Pausing key availability checks');
  sessionState.pauseKeyCheck = true;
};

/**
 * Resume key availability checks
 */
export const resumeKeyCheck = () => {
  console.log('[EncryptionSession] Resuming key availability checks');
  sessionState.pauseKeyCheck = false;
};

/**
 * Check if key availability checks should be paused
 * @returns {boolean} Whether checks are paused
 */
export const shouldPauseKeyCheck = () => {
  return sessionState.pauseKeyCheck;
};

/**
 * Start encryption toggle operation (pause key checks)
 * Alias for pauseKeyCheck for backward compatibility
 */
export const startEncryptionToggle = () => {
  console.log('[EncryptionSession] Starting encryption toggle - pausing key checks');
  pauseKeyCheck();
};

/**
 * End encryption toggle operation (resume key checks)
 * Alias for resumeKeyCheck for backward compatibility
 */
export const endEncryptionToggle = () => {
  console.log('[EncryptionSession] Ending encryption toggle - resuming key checks');
  resumeKeyCheck();
};

/**
 * Clear the session (call on logout)
 * Securely removes all sensitive data from memory
 */
export const clearSession = () => {
  console.log('[EncryptionSession] Clearing session...');
  
  // Clear password and key
  sessionState.familyPassword = null;
  sessionState.encryptionSalt = null;
  sessionState.derivedKey = null;
  sessionState.familyName = null;
  
  // Clear cached key
  clearCachedKey();
  
  // Keep encryption status (will be reloaded on next login)
  // sessionState.encryptionEnabled = false;
  // sessionState.skipGeocoding = false;
  
  console.log('[EncryptionSession] Session cleared');
};

/**
 * Validate family password by attempting to derive a key
 * Useful for password confirmation dialogs
 * @param {string} password - Password to validate
 * @returns {Promise<boolean>} Whether the password is valid
 */
export const validateFamilyPassword = async (password) => {
  if (!password || !sessionState.encryptionSalt) {
    return false;
  }
  
  try {
    // Try to derive a key with the password
    // If it succeeds, password is valid (though we can't verify it's correct)
    await getCachedKey(password, sessionState.encryptionSalt);
    return true;
  } catch (error) {
    console.error('[EncryptionSession] Password validation failed:', error);
    return false;
  }
};

/**
 * Get family name
 * @returns {string|null} The family name
 */
export const getFamilyName = () => {
  return sessionState.familyName;
};

// Export session state for debugging (development only)
if (import.meta.env.DEV) {
  window.__encryptionSession = sessionState;
  window.__checkEncryptionStatus = () => {
    console.log('=== Encryption Session Status ===');
    console.log('Encryption Enabled:', sessionState.encryptionEnabled);
    console.log('Has Salt:', !!sessionState.encryptionSalt);
    console.log('Has Derived Key:', !!sessionState.derivedKey);
    console.log('Has Password:', !!sessionState.familyPassword);
    console.log('Skip Geocoding:', sessionState.skipGeocoding);
    console.log('Family Name:', sessionState.familyName);
    console.log('================================');
    return sessionState;
  };
}

export default {
  initializeSession,
  updateEncryptionStatus,
  updatePassword,
  updateSkipGeocoding,
  getSessionState,
  getDerivedKey,
  getFamilyPassword,
  getEncryptionSalt,
  isEncryptionEnabled,
  shouldSkipGeocoding,
  startBatchOperation,
  endBatchOperation,
  isBatchOperationInProgress,
  isSessionReady,
  reDeriveKey,
  clearSession,
  validateFamilyPassword,
  getFamilyName
};
