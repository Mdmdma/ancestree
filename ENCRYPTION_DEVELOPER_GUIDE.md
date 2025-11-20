# Per-Field Encryption - Developer Quick Reference

## Overview
Client-side per-field encryption for all database tables. Encryption/decryption happens transparently in the browser. Server only stores encrypted ciphertext.

## Key Files

```
ancestree-app/src/
├── encryptionUtilsOptimized.js    # Core crypto functions (AES-GCM, PBKDF2, padding)
├── encryptionFieldDefinitions.js  # Lists of fields to encrypt per table
├── encryptionSession.js           # Session lifecycle (init, clear, key management)
├── encryptionBatchOperations.js   # Batch encrypt/decrypt all data
└── encryptedApiWrapper.js         # Wraps API calls with auto encryption/decryption
```

## Quick Start

### 1. Using the API (Automatic Encryption)

```javascript
import { encryptedApi } from './encryptedApiWrapper';

// Create a node (automatically encrypted before sending to server)
const newNode = await encryptedApi.createNode({
  firstName: 'John',
  lastName: 'Doe',
  birthDate: '1990-01-01',
  latitude: 40.7128,
  longitude: -74.0060
});

// Get node (automatically decrypted after receiving from server)
const node = await encryptedApi.getNode(nodeId);
console.log(node.firstName); // "John" (decrypted)

// Update node (automatically encrypted before sending)
await encryptedApi.updateNode(nodeId, {
  firstName: 'Jane'
});

// Delete node (no encryption needed)
await encryptedApi.deleteNode(nodeId);
```

### 2. Session Management

```javascript
import { initializeSession, clearSession, isEncryptionEnabled } from './encryptionSession';

// On login:
await initializeSession(password, {
  encryptionEnabled: true,
  encryptionSalt: 'base64-encoded-salt',
  skipGeocoding: false
});

// Check if encryption is active:
if (isEncryptionEnabled()) {
  console.log('Encryption is enabled');
}

// On logout:
clearSession(); // Clears password and key from memory
```

### 3. Manual Encryption/Decryption (Advanced)

```javascript
import { encryptValueFast, decryptValueFast, getCachedKey } from './encryptionUtilsOptimized';
import { getDerivedKey } from './encryptionSession';

// Get the cached session key
const key = getDerivedKey();

// Encrypt a single value
const encrypted = await encryptValueFast('John Doe', key);
console.log(encrypted); // "enc:base64-iv:base64-ciphertext"

// Decrypt a single value
const decrypted = await decryptValueFast(encrypted, key);
console.log(decrypted); // "John Doe"
```

### 4. Batch Operations (Enable/Disable Encryption)

```javascript
import { enableEncryption, disableEncryption } from './encryptionBatchOperations';

// Enable encryption for all data
await enableEncryption(password, (progress) => {
  console.log(`${progress.percent}% - ${progress.message}`);
  console.log(`${progress.current} / ${progress.total} items`);
});

// Disable encryption for all data
await disableEncryption(password, (progress) => {
  console.log(`${progress.percent}% - ${progress.message}`);
});
```

## Configuration

### Encryption Settings

```javascript
// encryptionUtilsOptimized.js
const PBKDF2_ITERATIONS = 100000;  // Key derivation iterations (DO NOT CHANGE)
const KEY_LENGTH = 256;            // AES key length in bits
const ALGORITHM = 'AES-GCM';       // Encryption algorithm
const IV_LENGTH = 12;              // Initialization vector length (96 bits)
const PADDING_SIZE = 256;          // Fixed padding size in bytes
```

### Fields to Encrypt

```javascript
// encryptionFieldDefinitions.js

// Node fields
export const NODE_ENCRYPTED_FIELDS = [
  'firstName', 'middleName', 'lastName', 'maidenName', 'displayName',
  'birthDate', 'deathDate', 'birthCity', 'birthZip', 'birthCountry',
  'latitude', 'longitude', 'shortDescription', 'longDescription', 'generation'
];

// Edge fields
export const EDGE_ENCRYPTED_FIELDS = [
  'relationType', 'marriageDate', 'divorceDate'
];

// Image fields
export const IMAGE_ENCRYPTED_FIELDS = [
  'caption', 'location', 'date', 'taggedPeople', 'uploadedBy', 'uploadDate', 'altText'
];

// Image-person position fields
export const IMAGE_PEOPLE_ENCRYPTED_FIELDS = [
  'position_x', 'position_y', 'position_width', 'position_height'
];

// Chat message fields
export const CHAT_MESSAGE_ENCRYPTED_FIELDS = [
  'message', 'senderName', 'recipientName'
];
```

## API Reference

### encryptionSession.js

```javascript
// Initialize session on login
await initializeSession(password, settings)

// Update encryption status
await updateEncryptionStatus(enabled, salt)

// Update skip geocoding setting
updateSkipGeocoding(skip)

// Get session state
const state = getSessionState()

// Get derived key
const key = getDerivedKey()

// Check if encryption enabled
const enabled = isEncryptionEnabled()

// Check if geocoding should be skipped
const skip = shouldSkipGeocoding()

// Clear session on logout
clearSession()

// Re-derive key if cache cleared
await reDeriveKey()
```

### encryptionUtilsOptimized.js

```javascript
// Generate random salt
const salt = generateSalt()

// Get or derive cached key (fast)
const key = await getCachedKey(password, salt)

// Clear cached key
clearCachedKey()

// Check if key is cached
const hasCached = hasCachedKey()

// Encrypt value (fast)
const encrypted = await encryptValueFast(value, key, withPadding = true)

// Decrypt value (fast)
const decrypted = await decryptValueFast(encryptedValue, key)

// Encrypt batch of values
const encryptedValues = await encryptBatch(values, key, withPadding = true)

// Decrypt batch of values
const decryptedValues = await decryptBatch(encryptedValues, key)

// Encrypt object fields
const encryptedObj = await encryptObjectFields(obj, fields, key)

// Decrypt object fields
const decryptedObj = await decryptObjectFields(obj, fields, key)
```

### encryptedApiWrapper.js

```javascript
// All standard API methods are available with automatic encryption:

// Nodes
await encryptedApi.createNode(data)
await encryptedApi.updateNode(id, data)
await encryptedApi.getNode(id)
await encryptedApi.getAllNodes()
await encryptedApi.deleteNode(id)

// Edges
await encryptedApi.createEdge(data)
await encryptedApi.updateEdge(id, data)
await encryptedApi.getEdge(id)
await encryptedApi.getAllEdges()
await encryptedApi.deleteEdge(id)

// Images
await encryptedApi.uploadImage(formData)
await encryptedApi.updateImage(id, data)
await encryptedApi.getImage(id)
await encryptedApi.getAllImages()
await encryptedApi.deleteImage(id)
await encryptedApi.tagPersonInImage(imageId, personData)
await encryptedApi.getTaggedPeopleForImage(imageId)

// Chat
await encryptedApi.sendChatMessage(data)
await encryptedApi.getChatMessages()

// Geocoding (optional, sends address to server)
await encryptedApi.geocodeAddress(city, zipCode, country)
```

## Encryption Format

### Encrypted Value Format
```
enc:<base64-iv>:<base64-ciphertext>
```

Example:
```
enc:SGVsbG8gV29ybGQh:cGFkZGVkIGFuZCBlbmNyeXB0ZWQgZGF0YQ==
```

### Unencrypted Values
- `null` → `null` (not encrypted)
- `undefined` → `undefined` (not encrypted)
- `""` → `""` (empty string not encrypted)

### Padding
All values padded to 256 bytes before encryption to hide actual data length.

## Performance

### Key Derivation (PBKDF2)
- **First time:** ~40-100ms (expensive)
- **Cached:** <1ms (instant)
- **Optimization:** Key derived once per session and cached

### Encryption/Decryption (AES-GCM)
- **Per field:** 0.05-0.2ms
- **Throughput:** 5,000-20,000 fields/second
- **10,000 fields:** ~500-1000ms total

### Batch Operations
- Processes 5 items then updates UI (prevents freezing)
- Shows progress: phase, percent, current/total
- Can be cancelled mid-operation

## Common Patterns

### Pattern 1: Create with Geocoding

```javascript
import { encryptedApi } from './encryptedApiWrapper';

const newNode = await encryptedApi.createNode({
  firstName: 'John',
  lastName: 'Doe',
  birthCity: 'New York',
  birthZip: '10001',
  birthCountry: 'USA'
  // latitude and longitude will be geocoded automatically if skipGeocoding=false
});
```

### Pattern 2: Bulk Update

```javascript
import { encryptedApi } from './encryptedApiWrapper';

const nodes = await encryptedApi.getAllNodes(); // Auto-decrypted

for (const node of nodes) {
  if (node.generation === null) {
    await encryptedApi.updateNode(node.id, {
      generation: calculateGeneration(node)
    });
  }
}
```

### Pattern 3: Password Change with Re-encryption

```javascript
import { enableEncryption, disableEncryption } from './encryptionBatchOperations';
import { api } from './api';

// 1. Disable encryption (decrypt all data with old password)
await disableEncryption(oldPassword, progressCallback);

// 2. Change password on server
await api.changeFamilyPassword(oldPassword, newPassword);

// 3. Re-enable encryption (encrypt all data with new password)
await enableEncryption(newPassword, progressCallback);
```

## Debugging

### Check Session State (Development Only)

```javascript
// In browser console (DEV mode only)
console.log(window.__encryptionSession);

// Output:
{
  familyPassword: "secret123",
  encryptionEnabled: true,
  encryptionSalt: "base64-salt",
  derivedKey: CryptoKey { ... },
  skipGeocoding: false,
  familyName: "Smith"
}
```

### Enable Encryption Logging

Encryption operations automatically log to console:

```
[EncryptionSession] Initializing session...
[Encryption] Deriving new encryption key...
[Encryption] Key derived in 45.23ms
[EncryptionSession] Encryption enabled, key cached
```

### Common Issues

**Issue:** "Family password not available in session"  
**Solution:** User not logged in or session cleared. Call `initializeSession()`.

**Issue:** "Salt is required when enabling encryption"  
**Solution:** Pass salt to `updateEncryptionStatus(true, salt)`.

**Issue:** Slow performance during CRUD operations  
**Solution:** Ensure key is cached. Check `hasCachedKey()` returns true.

**Issue:** Data not encrypted after toggle  
**Solution:** Verify batch operation completed successfully. Check console for errors.

## Security Best Practices

1. **Never log passwords or keys** - Use placeholders in logs
2. **Always clear session on logout** - Call `clearSession()`
3. **Validate user input** - Especially in password fields
4. **Use HTTPS** - Encrypted data still needs secure transport
5. **Warn about geocoding** - Make users aware it breaks zero-knowledge
6. **Handle errors gracefully** - Don't expose implementation details
7. **Test edge cases** - Empty values, special characters, very long strings

## Testing

### Unit Test Example

```javascript
import { encryptValueFast, decryptValueFast, getCachedKey } from './encryptionUtilsOptimized';

test('encrypt and decrypt value', async () => {
  const password = 'test-password';
  const salt = 'test-salt-base64';
  const key = await getCachedKey(password, salt);
  
  const original = 'John Doe';
  const encrypted = await encryptValueFast(original, key);
  const decrypted = await decryptValueFast(encrypted, key);
  
  expect(encrypted).toMatch(/^enc:/);
  expect(decrypted).toBe(original);
});
```

### Integration Test Example

```javascript
import { initializeSession, clearSession } from './encryptionSession';
import { encryptedApi } from './encryptedApiWrapper';

test('create and retrieve encrypted node', async () => {
  await initializeSession('password', {
    encryptionEnabled: true,
    encryptionSalt: 'test-salt',
    skipGeocoding: true
  });
  
  const created = await encryptedApi.createNode({
    firstName: 'Test',
    lastName: 'User'
  });
  
  const retrieved = await encryptedApi.getNode(created.id);
  
  expect(retrieved.firstName).toBe('Test');
  expect(retrieved.lastName).toBe('User');
  
  clearSession();
});
```

## Troubleshooting

### Problem: Key not cached after login
**Check:** `initializeSession()` called with correct parameters?  
**Fix:** Verify `encryptionEnabled: true` and `encryptionSalt` provided.

### Problem: Geocoding not working
**Check:** `skipGeocoding` setting  
**Fix:** Set `skipGeocoding: false` in admin panel or session.

### Problem: Batch operation stuck
**Check:** Progress callback being called?  
**Fix:** Check network tab for failed API calls. Verify data format.

### Problem: Cannot decrypt data
**Check:** Using same password and salt as encryption?  
**Fix:** Password change requires re-encryption of all data.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Client)                      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  React Components (FamilyTree, NodeEditor, etc.)   │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │                                      │
│                       ↓                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         encryptedApiWrapper.js                      │   │
│  │  (Transparently encrypts/decrypts API calls)        │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │                                      │
│         ┌─────────────┼─────────────┐                       │
│         ↓             ↓             ↓                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │Encryption│  │ Session  │  │  Field   │                 │
│  │  Utils   │  │ Manager  │  │  Defs    │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
│                                                              │
└───────────────────────┬──────────────────────────────────────┘
                        │ HTTPS (encrypted ciphertext only)
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                      Server (Backend)                        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Express API (server.js)                   │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │                                      │
│                       ↓                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │      SQLite Database (ancestree.db)                 │   │
│  │   (Stores encrypted ciphertext, never plaintext)    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## See Also

- [ENCRYPTION_SECURITY_AUDIT.md](./ENCRYPTION_SECURITY_AUDIT.md) - Comprehensive security audit
- [ENCRYPTION_FEATURE_README.md](./ENCRYPTION_FEATURE_README.md) - Original encryption documentation
- [encryptionPerformanceTest.js](./ancestree-app/src/encryptionPerformanceTest.js) - Performance testing tool

---

**Last Updated:** November 19, 2025  
**Version:** 1.0  
**Maintainer:** Development Team
