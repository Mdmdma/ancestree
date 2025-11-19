/**
 * Client-side encryption utilities for Ancestree
 * Uses Web Crypto API with PBKDF2 key derivation and AES-256-GCM encryption
 */

// Configuration
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256;
const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12; // 96 bits for GCM

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
 * Derive encryption key from password and salt using PBKDF2
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
 * Encrypt a string value
 */
export const encryptValue = async (value, password, salt) => {
  if (!value || value === null || value === undefined || value === '') {
    return value; // Don't encrypt empty values
  }
  
  try {
    const key = await deriveKey(password, salt);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const valueBuffer = stringToArrayBuffer(String(value));
    
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: iv
      },
      key,
      valueBuffer
    );
    
    // Combine IV and encrypted data, then base64 encode
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);
    
    return 'enc:' + arrayBufferToBase64(combined.buffer);
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
};

/**
 * Decrypt a string value
 */
export const decryptValue = async (encryptedValue, password, salt) => {
  if (!encryptedValue || !encryptedValue.startsWith('enc:')) {
    return encryptedValue; // Not encrypted or empty
  }
  
  try {
    const key = await deriveKey(password, salt);
    const combined = base64ToArrayBuffer(encryptedValue.substring(4)); // Remove 'enc:' prefix
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, IV_LENGTH);
    const encryptedData = combined.slice(IV_LENGTH);
    
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv
      },
      key,
      encryptedData
    );
    
    return arrayBufferToString(decryptedBuffer);
  } catch (error) {
    console.error('Decryption error:', error);
    throw error;
  }
};

/**
 * Encrypt an object's fields
 */
export const encryptObject = async (obj, password, salt, fieldsToEncrypt = null) => {
  if (!obj) return obj;
  
  const encrypted = { ...obj };
  const fields = fieldsToEncrypt || Object.keys(obj);
  
  for (const field of fields) {
    if (obj[field] !== null && obj[field] !== undefined && obj[field] !== '') {
      encrypted[field] = await encryptValue(obj[field], password, salt);
    }
  }
  
  return encrypted;
};

/**
 * Decrypt an object's fields
 */
export const decryptObject = async (obj, password, salt, fieldsToDecrypt = null) => {
  if (!obj) return obj;
  
  const decrypted = { ...obj };
  const fields = fieldsToDecrypt || Object.keys(obj);
  
  for (const field of fields) {
    if (obj[field] && typeof obj[field] === 'string' && obj[field].startsWith('enc:')) {
      decrypted[field] = await decryptValue(obj[field], password, salt);
    }
  }
  
  return decrypted;
};

/**
 * Fields that should be encrypted in nodes
 */
export const NODE_ENCRYPTED_FIELDS = [
  'name',
  'surname',
  'maiden_name',
  'birth_date',
  'death_date',
  'city',
  'zip',
  'country',
  'phone',
  'email'
];

/**
 * Fields that should be encrypted in images
 */
export const IMAGE_ENCRYPTED_FIELDS = [
  'description',
  'original_filename'
];

/**
 * Fields that should be encrypted in chat messages
 */
export const CHAT_ENCRYPTED_FIELDS = [
  'user_name',
  'message'
];

/**
 * Encrypt a node
 */
export const encryptNode = async (node, password, salt) => {
  return encryptObject(node, password, salt, NODE_ENCRYPTED_FIELDS);
};

/**
 * Decrypt a node
 */
export const decryptNode = async (node, password, salt) => {
  return decryptObject(node, password, salt, NODE_ENCRYPTED_FIELDS);
};

/**
 * Encrypt an image
 */
export const encryptImage = async (image, password, salt) => {
  return encryptObject(image, password, salt, IMAGE_ENCRYPTED_FIELDS);
};

/**
 * Decrypt an image
 */
export const decryptImage = async (image, password, salt) => {
  return decryptObject(image, password, salt, IMAGE_ENCRYPTED_FIELDS);
};

/**
 * Encrypt a chat message
 */
export const encryptChatMessage = async (message, password, salt) => {
  return encryptObject(message, password, salt, CHAT_ENCRYPTED_FIELDS);
};

/**
 * Decrypt a chat message
 */
export const decryptChatMessage = async (message, password, salt) => {
  return decryptObject(message, password, salt, CHAT_ENCRYPTED_FIELDS);
};

/**
 * Encrypt an array of objects
 */
export const encryptArray = async (array, password, salt, encryptFunction) => {
  if (!array || !Array.isArray(array)) return array;
  
  return Promise.all(array.map(item => encryptFunction(item, password, salt)));
};

/**
 * Decrypt an array of objects
 */
export const decryptArray = async (array, password, salt, decryptFunction) => {
  if (!array || !Array.isArray(array)) return array;
  
  return Promise.all(array.map(item => decryptFunction(item, password, salt)));
};
