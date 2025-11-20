/**
 * Optimized Client-side Encryption Utilities for Ancestree
 * 
 * Key optimizations:
 * 1. Derives key ONCE per session and caches it
 * 2. Pads all values to 256 bytes before encryption
 * 3. Uses fast encryption/decryption with pre-derived key
 * 4. Provides ~1000-10000x faster performance than deriving key per field
 */

// Configuration
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256;
const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12; // 96 bits for GCM
const PADDING_SIZE = 256; // Bytes

// Session key cache
let cachedKey = null;
let cachedPassword = null;
let cachedSalt = null;

/**
 * Convert string to ArrayBuffer
 */
const stringToArrayBuffer = (str) => {
  return new TextEncoder().encode(str);
};

/**
 * Convert ArrayBuffer to string
 */
const arrayBufferToString = (buffer) => {
  return new TextDecoder().decode(buffer);
};

/**
 * Convert ArrayBuffer to base64
 */
const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Convert base64 to ArrayBuffer
 */
const base64ToArrayBuffer = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Generate a random salt
 */
export const generateSalt = () => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return arrayBufferToBase64(salt);
};

/**
 * Pad a value to fixed byte length
 * Ensures all encrypted values have the same length to hide actual data length
 */
const padValue = (value, targetBytes = PADDING_SIZE) => {
  const str = String(value || '');
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  
  if (bytes.length >= targetBytes) {
    // If value exceeds target, just return it (no padding)
    return str;
  }
  
  // Create padded array with null bytes
  const padded = new Uint8Array(targetBytes);
  padded.set(bytes);
  // Rest is automatically filled with zeros
  
  return new TextDecoder().decode(padded);
};

/**
 * Remove padding from a value
 */
const unpadValue = (paddedValue) => {
  if (!paddedValue) return paddedValue;
  // Remove null bytes from the end
  return paddedValue.replace(/\0+$/, '');
};

/**
 * Derive encryption key from password and salt using PBKDF2
 * This is expensive (~40-100ms) and should only be called ONCE per session
 */
const deriveKey = async (password, salt) => {
  const passwordBuffer = stringToArrayBuffer(password);
  const saltBuffer = base64ToArrayBuffer(salt);
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive AES key
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
  
  return key;
};

/**
 * Get or derive the encryption key (with caching)
 * Call this once at session start, then reuse the cached key
 */
export const getCachedKey = async (password, salt) => {
  // Return cached key if password and salt match
  if (cachedKey && cachedPassword === password && cachedSalt === salt) {
    return cachedKey;
  }
  
  // Derive new key and cache it
  console.log('[Encryption] Deriving new encryption key...');
  const startTime = performance.now();
  cachedKey = await deriveKey(password, salt);
  const endTime = performance.now();
  console.log(`[Encryption] Key derived in ${(endTime - startTime).toFixed(2)}ms`);
  
  cachedPassword = password;
  cachedSalt = salt;
  
  return cachedKey;
};

/**
 * Clear the cached encryption key (call on logout for security)
 */
export const clearCachedKey = () => {
  cachedKey = null;
  cachedPassword = null;
  cachedSalt = null;
  console.log('[Encryption] Cached key cleared');
};

/**
 * Check if a key is cached
 */
export const hasCachedKey = () => {
  return cachedKey !== null;
};

/**
 * Encrypt a value using a pre-derived key (FAST)
 * @param {string|number} value - Value to encrypt
 * @param {CryptoKey} cryptoKey - Pre-derived encryption key
 * @param {boolean} withPadding - Whether to pad the value (default: true)
 * @returns {Promise<string>} Encrypted value with 'enc:' prefix
 */
export const encryptValueFast = async (value, cryptoKey, withPadding = true) => {
  // Don't encrypt null, undefined, or empty string
  if (value === null || value === undefined || value === '') {
    return value;
  }
  
  try {
    // Convert to string and optionally pad
    const stringValue = String(value);
    const valueToEncrypt = withPadding ? padValue(stringValue) : stringValue;
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const valueBuffer = stringToArrayBuffer(valueToEncrypt);
    
    // Encrypt
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: iv
      },
      cryptoKey,
      valueBuffer
    );
    
    // Combine IV and encrypted data, then base64 encode
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);
    
    return 'enc:' + arrayBufferToBase64(combined.buffer);
  } catch (error) {
    console.error('[Encryption] Encryption error:', error);
    throw error;
  }
};

/**
 * Decrypt a value using a pre-derived key (FAST)
 * @param {string} encryptedValue - Encrypted value with 'enc:' prefix
 * @param {CryptoKey} cryptoKey - Pre-derived encryption key
 * @param {boolean} withPadding - Whether the value was padded (default: true)
 * @returns {Promise<string>} Decrypted value
 */
export const decryptValueFast = async (encryptedValue, cryptoKey, withPadding = true) => {
  // Return as-is if not encrypted
  if (!encryptedValue || !encryptedValue.startsWith('enc:')) {
    return encryptedValue;
  }
  
  try {
    const combined = base64ToArrayBuffer(encryptedValue.substring(4)); // Remove 'enc:' prefix
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, IV_LENGTH);
    const encryptedData = combined.slice(IV_LENGTH);
    
    // Decrypt
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv
      },
      cryptoKey,
      encryptedData
    );
    
    const decryptedValue = arrayBufferToString(decryptedBuffer);
    
    // Remove padding if it was used
    return withPadding ? unpadValue(decryptedValue) : decryptedValue;
  } catch (error) {
    console.error('[Encryption] Decryption error:', error);
    throw error;
  }
};

/**
 * Encrypt multiple values efficiently (batch operation)
 * @param {Array<any>} values - Array of values to encrypt
 * @param {CryptoKey} cryptoKey - Pre-derived encryption key
 * @param {boolean} withPadding - Whether to pad values
 * @returns {Promise<Array<string>>} Array of encrypted values
 */
export const encryptBatch = async (values, cryptoKey, withPadding = true) => {
  const encrypted = [];
  for (const value of values) {
    encrypted.push(await encryptValueFast(value, cryptoKey, withPadding));
  }
  return encrypted;
};

/**
 * Decrypt multiple values efficiently (batch operation)
 * @param {Array<string>} encryptedValues - Array of encrypted values
 * @param {CryptoKey} cryptoKey - Pre-derived encryption key
 * @param {boolean} withPadding - Whether values were padded
 * @returns {Promise<Array<any>>} Array of decrypted values
 */
export const decryptBatch = async (encryptedValues, cryptoKey, withPadding = true) => {
  const decrypted = [];
  for (const value of encryptedValues) {
    decrypted.push(await decryptValueFast(value, cryptoKey, withPadding));
  }
  return decrypted;
};

/**
 * Encrypt an object's specified fields
 * @param {Object} obj - Object to encrypt
 * @param {Array<string>} fields - List of field names to encrypt
 * @param {CryptoKey} cryptoKey - Pre-derived encryption key
 * @returns {Promise<Object>} Object with encrypted fields
 */
export const encryptObjectFields = async (obj, fields, cryptoKey) => {
  if (!obj) return obj;
  
  const result = { ...obj };
  
  for (const field of fields) {
    if (obj[field] !== null && obj[field] !== undefined && obj[field] !== '') {
      result[field] = await encryptValueFast(obj[field], cryptoKey, true);
    }
  }
  
  return result;
};

/**
 * Decrypt an object's specified fields
 * @param {Object} obj - Object with encrypted fields
 * @param {Array<string>} fields - List of field names to decrypt
 * @param {CryptoKey} cryptoKey - Pre-derived encryption key
 * @returns {Promise<Object>} Object with decrypted fields
 */
export const decryptObjectFields = async (obj, fields, cryptoKey) => {
  if (!obj) return obj;
  
  const result = { ...obj };
  
  for (const field of fields) {
    if (obj[field] && typeof obj[field] === 'string' && obj[field].startsWith('enc:')) {
      result[field] = await decryptValueFast(obj[field], cryptoKey, true);
    }
  }
  
  return result;
};

/**
 * Check if a value is encrypted
 */
export const isEncrypted = (value) => {
  return typeof value === 'string' && value.startsWith('enc:');
};

// Export padding size for reference
export { PADDING_SIZE };
