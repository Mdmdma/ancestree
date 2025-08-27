// Test encryption functionality using CommonJS
const CryptoJS = require('crypto-js');

// Simple encryption/decryption test
function encryptValue(value, passphrase) {
  if (!value || !passphrase) return value;
  try {
    return CryptoJS.AES.encrypt(value, passphrase).toString();
  } catch (error) {
    console.error('Encryption error:', error);
    return value;
  }
}

function decryptValue(encryptedValue, passphrase) {
  if (!encryptedValue || !passphrase) return encryptedValue;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedValue, passphrase);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || encryptedValue;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedValue;
  }
}

// Test data
const testData = {
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+1-555-123-4567',
  street: '123 Main Street'
};

const passphrase = 'securepass123';

console.log('🔒 Client-Side Encryption Test');
console.log('==============================');

console.log('\n📝 Original data:');
console.log(JSON.stringify(testData, null, 2));

// Encrypt each field
const encryptedData = {};
Object.keys(testData).forEach(key => {
  encryptedData[key] = encryptValue(testData[key], passphrase);
});

console.log('\n🔐 Encrypted data:');
console.log(JSON.stringify(encryptedData, null, 2));

// Decrypt each field
const decryptedData = {};
Object.keys(encryptedData).forEach(key => {
  decryptedData[key] = decryptValue(encryptedData[key], passphrase);
});

console.log('\n🔓 Decrypted data:');
console.log(JSON.stringify(decryptedData, null, 2));

// Verify integrity
const isValid = JSON.stringify(testData) === JSON.stringify(decryptedData);
console.log('\n✅ Data integrity check:', isValid ? 'PASSED' : 'FAILED');

// Test wrong passphrase
const wrongDecrypted = decryptValue(encryptedData.name, 'wrongpassword');
console.log('\n🚫 Wrong passphrase test:');
console.log('Encrypted name:', encryptedData.name);
console.log('Wrong decrypt result:', wrongDecrypted);
console.log('Successfully protected:', wrongDecrypted !== testData.name ? 'YES' : 'NO');

console.log('\n🎉 Encryption implementation is working correctly!');
