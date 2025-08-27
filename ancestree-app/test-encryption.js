import { encryptNode, decryptNode } from './src/utils/encryption.js';

// Test data
const testNode = {
  id: 'test-node-1',
  type: 'person',
  position: { x: 100, y: 100 },
  data: {
    name: 'John',
    surname: 'Doe',
    birthDate: '1980-01-01',
    deathDate: null,
    street: '123 Main Street',
    city: 'Anytown',
    zip: '12345',
    country: 'USA',
    phone: '+1-555-123-4567',
    email: 'john.doe@example.com',
    bloodline: true,
    preferredImageId: null,
    isSelected: false
  }
};

const testPassphrase = 'securepass123';

console.log('Original node data:');
console.log(JSON.stringify(testNode, null, 2));

// Encrypt the node
const encryptedNode = encryptNode(testNode, testPassphrase);
console.log('\nEncrypted node data:');
console.log(JSON.stringify(encryptedNode, null, 2));

// Decrypt the node
const decryptedNode = decryptNode(encryptedNode, testPassphrase);
console.log('\nDecrypted node data:');
console.log(JSON.stringify(decryptedNode, null, 2));

// Verify data integrity
const originalData = JSON.stringify(testNode.data);
const decryptedData = JSON.stringify(decryptedNode.data);

if (originalData === decryptedData) {
  console.log('\n✅ SUCCESS: Encryption/decryption preserves data integrity!');
} else {
  console.log('\n❌ FAILURE: Data integrity lost during encryption/decryption!');
  console.log('Original:', originalData);
  console.log('Decrypted:', decryptedData);
}

// Test with wrong passphrase
const wrongDecrypted = decryptNode(encryptedNode, 'wrongpassword');
console.log('\nDecryption with wrong passphrase:');
console.log(JSON.stringify(wrongDecrypted.data, null, 2));

if (wrongDecrypted.data.name !== testNode.data.name) {
  console.log('✅ SUCCESS: Wrong passphrase does not decrypt correctly!');
} else {
  console.log('❌ FAILURE: Wrong passphrase still decrypted data!');
}
