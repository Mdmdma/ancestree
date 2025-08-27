import CryptoJS from 'crypto-js';

/**
 * Passphrase validation utility for reducing re-entry frequency
 * Uses a secure challenge-response mechanism
 */

const STORAGE_KEY = 'ancestree_passphrase_hash';
const VALIDATION_STRING = 'AncestreeValidationString2024';

/**
 * Create a hash of the passphrase for validation purposes
 * @param {string} passphrase - The user's passphrase
 * @returns {string} - A hash that can be used for validation
 */
export function createPassphraseValidationHash(passphrase) {
  if (!passphrase) return null;
  
  try {
    // Create a hash using the passphrase to encrypt a known string
    const hash = CryptoJS.AES.encrypt(VALIDATION_STRING, passphrase).toString();
    return hash;
  } catch (error) {
    console.error('Error creating passphrase hash:', error);
    return null;
  }
}

/**
 * Validate a passphrase against the stored hash
 * @param {string} passphrase - The passphrase to validate
 * @param {string} storedHash - The stored hash to validate against
 * @returns {boolean} - True if passphrase is valid
 */
export function validatePassphrase(passphrase, storedHash) {
  if (!passphrase || !storedHash) return false;
  
  try {
    // Try to decrypt the validation string with the provided passphrase
    const bytes = CryptoJS.AES.decrypt(storedHash, passphrase);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted === VALIDATION_STRING;
  } catch (error) {
    console.error('Error validating passphrase:', error);
    return false;
  }
}

/**
 * Store the passphrase validation hash in sessionStorage
 * @param {string} passphrase - The user's passphrase
 */
export function storePassphraseValidation(passphrase) {
  if (!passphrase) return;
  
  const hash = createPassphraseValidationHash(passphrase);
  if (hash) {
    sessionStorage.setItem(STORAGE_KEY, hash);
  }
}

/**
 * Get the stored passphrase validation hash
 * @returns {string|null} - The stored hash or null if not found
 */
export function getStoredPassphraseHash() {
  return sessionStorage.getItem(STORAGE_KEY);
}

/**
 * Clear the stored passphrase validation
 */
export function clearPassphraseValidation() {
  sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if a passphrase is valid using the stored hash
 * @param {string} passphrase - The passphrase to check
 * @returns {boolean} - True if valid
 */
export function isPassphraseValid(passphrase) {
  const storedHash = getStoredPassphraseHash();
  return validatePassphrase(passphrase, storedHash);
}

/**
 * Auto-validate common passphrases that users might try
 * This helps reduce friction for users with simpler passphrases
 * @param {Array} commonPassphrases - Array of passphrases to try
 * @returns {string|null} - Valid passphrase if found, null otherwise
 */
export function tryCommonPassphrases(commonPassphrases = []) {
  const storedHash = getStoredPassphraseHash();
  if (!storedHash) return null;
  
  for (const passphrase of commonPassphrases) {
    if (validatePassphrase(passphrase, storedHash)) {
      return passphrase;
    }
  }
  
  return null;
}
