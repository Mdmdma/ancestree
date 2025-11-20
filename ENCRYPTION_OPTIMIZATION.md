# Encryption Performance Optimization

## The Problem

Your initial test showed only **23 encryptions per second**, which is far too slow. You expected **<5ms per field** (200+ encryptions/sec) for fields under 1KB.

## Root Cause: Key Derivation Overhead

The original implementation was calling `deriveKey()` for **every single field encryption**:

```javascript
// OLD - SLOW APPROACH
export const encryptValue = async (value, password, salt) => {
  const key = await deriveKey(password, salt); // ❌ Called every time!
  // ... encrypt with key
};
```

**PBKDF2 with 100,000 iterations takes ~40-100ms** depending on the machine. When you're encrypting 10,000 fields, this means:
- 10,000 fields × ~50ms = **500,000ms (8+ minutes)!**
- This gives you only ~20 encryptions/second

## The Solution: Key Caching

The fix is simple: **derive the key ONCE and reuse it** for all subsequent operations:

```javascript
// NEW - FAST APPROACH
// 1. Derive key once
const cryptoKey = await deriveKey(password, salt); // Only once!

// 2. Encrypt many fields with the same key
for (let field of fields) {
  await encryptValueFast(field, cryptoKey); // ✓ Very fast!
}
```

## Performance Improvements

### Before Optimization
- **23 encryptions/second**
- Each field: ~43ms (mostly key derivation)
- 10,000 fields: ~430 seconds (7+ minutes)

### After Optimization
- **Expected: 1,000-10,000 encryptions/second** (depending on hardware)
- Key derivation: ~40-100ms (one-time cost)
- Each field: ~0.1-1ms (just encryption)
- 10,000 fields: ~100-500ms + key derivation (under 1 second total!)

## How AES-GCM Encryption Actually Works

For a 256-byte padded field:

1. **Key Derivation** (PBKDF2, 100k iterations): ~40-100ms
   - ❌ Old approach: Done for EVERY field
   - ✓ New approach: Done ONCE per session

2. **Actual Encryption** (AES-256-GCM): ~0.05-0.5ms
   - Generate random 12-byte IV: <0.01ms
   - Encrypt data: ~0.05-0.5ms
   - Combine IV + encrypted data: <0.01ms

## Implementation Changes

### Test Script (`encryptionPerformanceTest.js`)

1. **Added optimized encryption functions**:
   - `encryptValueFast(value, cryptoKey)` - encrypts using pre-derived key
   - `decryptValueFast(encryptedValue, cryptoKey)` - decrypts using pre-derived key

2. **Modified test flow**:
   ```javascript
   // Derive key ONCE per fold
   const cryptoKey = await deriveKey(password, salt);
   
   // Then encrypt all fields with the cached key
   for (let field of testData) {
     await encryptValueFast(field, cryptoKey);
   }
   ```

3. **Added metrics**:
   - Separate tracking of key derivation time
   - Shows amortized cost (key derivation / number of fields ≈ 0)

4. **Fixed padding to use BYTES not characters**:
   - Changed from character-based padding to byte-based (256 bytes)
   - Properly handles UTF-8 multi-byte characters

### Results Display

The test now shows:
- **Key derivation time** (one-time cost)
- **Encryption time** (excluding key derivation)
- **Per-field average** (should be <1ms now)
- **Throughput** (should be 1000+ fields/sec)

## Production Implementation Recommendations

### Current Production Code Needs Update

Your current `encryptionUtils.js` should be updated to:

1. **Add a key cache**:
   ```javascript
   let cachedKey = null;
   let cachedPassword = null;
   let cachedSalt = null;
   
   const getCachedKey = async (password, salt) => {
     if (cachedKey && cachedPassword === password && cachedSalt === salt) {
       return cachedKey;
     }
     cachedKey = await deriveKey(password, salt);
     cachedPassword = password;
     cachedSalt = salt;
     return cachedKey;
   };
   ```

2. **Update encryptValue to use cached key**:
   ```javascript
   export const encryptValue = async (value, password, salt) => {
     const key = await getCachedKey(password, salt); // Uses cache!
     // ... rest of encryption
   };
   ```

3. **Clear cache on logout**:
   ```javascript
   export const clearKeyCache = () => {
     cachedKey = null;
     cachedPassword = null;
     cachedSalt = null;
   };
   ```

### Session Management

- Derive key once when user logs in / enters password
- Store the CryptoKey object in memory (never serialize it)
- Reuse for all encrypt/decrypt operations in that session
- Clear on logout for security

## Expected New Performance

With the optimization, encrypting 10,000 fields with 256-byte padding:

| Operation | Time | Notes |
|-----------|------|-------|
| Key derivation | ~50-100ms | Once per session |
| Encrypt 10,000 fields | ~500-1000ms | 0.05-0.1ms per field |
| Decrypt 10,000 fields | ~500-1000ms | 0.05-0.1ms per field |
| **Total** | **~1-2 seconds** | Plus one-time key derivation |

For a typical tree (1,000 fields):
- **Key derivation**: ~50-100ms (once)
- **Encryption**: ~50-100ms
- **Total**: ~100-200ms ✓ Very acceptable!

## Security Considerations

This optimization does **NOT** reduce security:

✓ Still using AES-256-GCM (industry standard)
✓ Still using PBKDF2 with 100k iterations
✓ Still using random IVs for each field
✓ Still using proper padding
✓ Key is never persisted (only in memory)
✓ Key is derived from password (can be regenerated)

The only difference is we're being smart about **when** we derive the key.

## Padding: Bytes vs Characters

The updated code pads to **256 bytes** (not characters):
- Handles UTF-8 properly (multi-byte characters)
- Ensures consistent encrypted size
- Hides actual data length better

For most text fields (names, dates), this is plenty. For longer fields (biographies), you might want:
- 512 bytes for medium text
- 1024 bytes for long text
- Or use variable padding based on field type

## Testing the Optimization

Run the performance test again and you should see:

1. **Key derivation time**: ~40-100ms per fold (acceptable)
2. **Encryption time**: ~500-1500ms for 10,000 fields
3. **Per-field average**: ~0.05-0.15ms
4. **Throughput**: 5,000-20,000 fields/sec (not 23/sec!)

## Next Steps

1. Run the updated performance test
2. Verify you're getting >1000 encryptions/second
3. Update your production `encryptionUtils.js` with key caching
4. Test with real data
5. Monitor performance in production

The key insight: **Cryptographic operations are fast; key derivation is slow. Do the slow thing once, reuse the result.**
