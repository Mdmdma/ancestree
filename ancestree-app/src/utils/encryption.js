import CryptoJS from 'crypto-js';

/**
 * Client-side encryption utility for protecting personal information
 * Uses AES encryption with the family passphrase as the key
 */

// Fields that should be encrypted for privacy
const ENCRYPTED_FIELDS = [
  'name',
  'surname', 
  'birthDate',
  'deathDate',
  'street',
  'city',
  'zip',
  'country',
  'phone',
  'email'
];

/**
 * Encrypts a value using AES encryption
 * @param {string} value - The value to encrypt
 * @param {string} passphrase - The family passphrase used as encryption key
 * @returns {string} - The encrypted value
 */
export function encryptValue(value, passphrase) {
  if (!value || !passphrase) return value;
  try {
    return CryptoJS.AES.encrypt(value, passphrase).toString();
  } catch (error) {
    console.error('Encryption error:', error);
    return value; // Return original value if encryption fails
  }
}

/**
 * Decrypts a value using AES decryption
 * @param {string} encryptedValue - The encrypted value to decrypt
 * @param {string} passphrase - The family passphrase used as decryption key
 * @returns {string} - The decrypted value
 */
export function decryptValue(encryptedValue, passphrase) {
  if (!encryptedValue || !passphrase) return encryptedValue;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedValue, passphrase);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || encryptedValue; // Return original if decryption fails
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedValue; // Return encrypted value if decryption fails
  }
}

/**
 * Encrypts all personal information in a person node's data
 * @param {object} nodeData - The node data object
 * @param {string} passphrase - The family passphrase
 * @returns {object} - The node data with encrypted fields
 */
export function encryptNodeData(nodeData, passphrase) {
  if (!nodeData || !passphrase) return nodeData;
  
  const encryptedData = { ...nodeData };
  
  ENCRYPTED_FIELDS.forEach(field => {
    if (encryptedData[field]) {
      encryptedData[field] = encryptValue(encryptedData[field], passphrase);
    }
  });
  
  return encryptedData;
}

/**
 * Decrypts all personal information in a person node's data
 * @param {object} nodeData - The node data object with encrypted fields
 * @param {string} passphrase - The family passphrase
 * @returns {object} - The node data with decrypted fields
 */
export function decryptNodeData(nodeData, passphrase) {
  if (!nodeData || !passphrase) return nodeData;
  
  const decryptedData = { ...nodeData };
  
  ENCRYPTED_FIELDS.forEach(field => {
    if (decryptedData[field]) {
      decryptedData[field] = decryptValue(decryptedData[field], passphrase);
    }
  });
  
  return decryptedData;
}

/**
 * Encrypts a complete node object for storage
 * @param {object} node - The complete node object
 * @param {string} passphrase - The family passphrase
 * @returns {object} - The node with encrypted data
 */
export function encryptNode(node, passphrase) {
  if (!node || !passphrase) return node;
  
  return {
    ...node,
    data: encryptNodeData(node.data, passphrase)
  };
}

/**
 * Decrypts a complete node object from storage
 * @param {object} node - The node object with encrypted data
 * @param {string} passphrase - The family passphrase
 * @returns {object} - The node with decrypted data
 */
export function decryptNode(node, passphrase) {
  if (!node || !passphrase) return node;
  
  return {
    ...node,
    data: decryptNodeData(node.data, passphrase)
  };
}

/**
 * Encrypts an array of nodes
 * @param {array} nodes - Array of node objects
 * @param {string} passphrase - The family passphrase
 * @returns {array} - Array of nodes with encrypted data
 */
export function encryptNodes(nodes, passphrase) {
  if (!nodes || !passphrase) return nodes;
  return nodes.map(node => encryptNode(node, passphrase));
}

/**
 * Decrypts an array of nodes
 * @param {array} nodes - Array of node objects with encrypted data
 * @param {string} passphrase - The family passphrase
 * @returns {array} - Array of nodes with decrypted data
 */
export function decryptNodes(nodes, passphrase) {
  if (!nodes || !passphrase) return nodes;
  return nodes.map(node => decryptNode(node, passphrase));
}
