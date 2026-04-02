---
paths:
  - "ancestree-app/src/encryption*"
  - "ancestree-app/src/encryptedApi*"
---

# Encryption System Architecture

3-layer client-side encryption. Backend never sees plaintext.

## Layer 1: Session Management (`encryptionSession.js`)

Module-level `sessionState` object:
```
{ familyPassword, encryptionEnabled, encryptionSalt, derivedKey, familyName,
  isBatchOperationInProgress, pauseKeyCheck }
```

**Key exports:**
- `initializeSession(password, familySettings)` — called on login, derives key if encryption enabled
- `updateEncryptionStatus(enabled, salt)` — toggle encryption, derives/clears key
- `updatePassword(newPassword, newSalt?)` — re-derives key with new password
- `getDerivedKey()` — returns cached CryptoKey (null if encryption disabled)
- `isEncryptionEnabled()` — boolean check
- `isSessionReady()` — true if encryption off, or if password+salt+key all present
- `reDeriveKey()` — force re-derivation from cached password+salt
- `clearSession()` — logout cleanup, wipes all sensitive data
- `startBatchOperation()` / `endBatchOperation()` — pauses UI renders during bulk ops
- `pauseKeyCheck()` / `resumeKeyCheck()` — pauses key availability checks during sensitive ops (password changes)
- `validateFamilyPassword(password)` — attempts key derivation to validate
- `getFamilyPassword()`, `getEncryptionSalt()`, `getFamilyName()` — getters

Dev debugging (DEV only): `window.__encryptionSession`, `window.__checkEncryptionStatus()`

## Layer 2: Crypto Operations (`encryptionUtilsOptimized.js`)

**Constants:**
- `PBKDF2_ITERATIONS = 100000`
- `KEY_LENGTH = 256` (AES-256)
- `ALGORITHM = 'AES-GCM'`
- `IV_LENGTH = 12` (96 bits)
- `PADDING_SIZE = 256` bytes (hides plaintext length)

**Key derivation (expensive, ~40-100ms):**
- `getCachedKey(password, salt)` — derives via PBKDF2+SHA-256, caches result. Returns cached if password+salt unchanged.
- `clearCachedKey()` — wipes cache (call on logout)
- `hasCachedKey()` — boolean

**Encrypt/Decrypt (fast, uses pre-derived CryptoKey):**
- `encryptValueFast(value, cryptoKey, withPadding=true)` — pads to 256 bytes, AES-GCM encrypts, returns `enc:` + base64(IV + ciphertext). Skips null/undefined/empty.
- `decryptValueFast(encryptedValue, cryptoKey, withPadding=true)` — returns plaintext if starts with `enc:`, otherwise returns as-is.
- `encryptBatch(values, cryptoKey)` / `decryptBatch(values, cryptoKey)` — sequential array processing
- `encryptObjectFields(obj, fields, cryptoKey)` / `decryptObjectFields(obj, fields, cryptoKey)` — encrypt/decrypt named fields on object
- `isEncrypted(value)` — checks for `enc:` prefix
- `generateSalt()` — random 16-byte salt, base64 encoded

## Layer 3: Encrypted API Wrapper (`encryptedApi.js`)

Wraps `baseApi` from `api.js`. All data methods auto-encrypt outgoing and decrypt incoming.

**Internal helpers:**
- `encryptNodeData(data)` / `decryptNodeData(data)` — uses NODE_ENCRYPTED_FIELDS
- `encryptEdgeData(data)` / `decryptEdgeData(data)` — uses EDGE_ENCRYPTED_FIELDS
- `encryptImageData(data)` / `decryptImageData(data)` — uses IMAGE_ENCRYPTED_FIELDS
- `encryptChatMessage(data)` / `decryptChatMessage(data)` — uses CHAT_MESSAGE_ENCRYPTED_FIELDS

**Behavior:**
- Auth methods (login, register, verifyToken) pass through to baseApi unchanged
- Data methods encrypt before send, decrypt after receive
- Latitude/longitude parsed back to float after decryption
- Decryption failures log errors but return data as-is (graceful degradation)
- `apiClient.js` is an ES6 Proxy that delegates to `encryptedApi` methods when available

**~40 exported methods** covering: auth, nodes, edges, images, image_people, chat, admin settings, completion settings, family settings, terms.

## Field Definitions (`encryptionFieldDefinitions.js`)

**NODE_ENCRYPTED_FIELDS (camelCase):** name, surname, maidenName, birthDate, deathDate, street, housenumber, city, zip, country, phone, email, latitude, longitude, lastGeocoded, biography, occupation, education, nationality, notes, addressHash

**NODE_DB_ENCRYPTED_COLUMNS (snake_case):** name, surname, maiden_name, birth_date, death_date, street, housenumber, city, zip, country, phone, email, latitude, longitude, address_hash, last_geocoded

**EDGE_ENCRYPTED_FIELDS:** sourceHandle, targetHandle, type, label, notes
**EDGE_DB_ENCRYPTED_COLUMNS:** source_handle, target_handle, type

**IMAGE_ENCRYPTED_FIELDS:** filename, originalFilename, description, uploadedBy, s3Key, s3Url, thumbnailS3Key, uploadDate, fileSize, mimeType, title, location, date, caption
**IMAGE_DB_ENCRYPTED_COLUMNS:** filename, original_filename, description, uploaded_by, s3_key, s3_url, thumbnail_s3_key, upload_date, file_size, mime_type

**IMAGE_PEOPLE_ENCRYPTED_FIELDS:** positionX, positionY, width, height
**IMAGE_PEOPLE_DB_ENCRYPTED_COLUMNS:** position_x, position_y, width, height

**CHAT_MESSAGE_ENCRYPTED_FIELDS:** userName, message, createdAt
**CHAT_MESSAGE_DB_ENCRYPTED_COLUMNS:** user_name, message, created_at

**ADMIN_ENCRYPTED_FIELDS:** value
**ADMIN_DB_ENCRYPTED_COLUMNS:** value

**NEVER_ENCRYPT_FIELDS:** id, source, target, image_id, person_id, imageId, personId

**Helpers:** `getEncryptedFields(dataType)`, `getEncryptedDbColumns(dataType)`, `shouldEncryptField(fieldName, dataType)`, `camelToSnake(str)`, `snakeToCamel(str)`

## Batch Operations (`encryptionBatchOperations.js`)

Used when toggling encryption on/off to re-encrypt or decrypt all existing data across all entity types. Calls `startBatchOperation()` / `endBatchOperation()` to pause UI renders during bulk processing.

## Critical Rules

1. **Always use `encryptedApi`** (or `apiClient`) for data operations, never raw `api.js`
2. When adding new encrypted fields: update `encryptionFieldDefinitions.js` (both camelCase and snake_case arrays), add encrypt/decrypt handling in `encryptedApi.js`, update `encryptionBatchOperations.js` if field needs migration
3. Test with encryption **enabled AND disabled**
4. `NEVER_ENCRYPT_FIELDS` must exclude structural/reference fields needed for DB joins
5. Encrypted values always start with `enc:` prefix
6. Key derivation is expensive (~40-100ms) — cache and reuse, never re-derive unnecessarily
7. Backend stores encrypted data as-is — never decrypts, never expects plaintext for encrypted fields
