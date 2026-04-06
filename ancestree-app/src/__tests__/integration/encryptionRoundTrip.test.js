import {
  getCachedKey,
  generateSalt,
  encryptValueFast,
  decryptValueFast,
  encryptObjectFields,
  decryptObjectFields,
} from '../../encryptionUtilsOptimized';
import { NODE_ENCRYPTED_FIELDS } from '../../encryptionFieldDefinitions';

describe('Encryption round-trip (real Web Crypto API)', () => {
  let key;
  let salt;
  const password = 'test-password-123';

  beforeAll(async () => {
    salt = generateSalt();
    key = await getCachedKey(password, salt);
  });

  it('encrypts and decrypts a string round-trip', async () => {
    const original = 'Hello, Ancestree!';
    const encrypted = await encryptValueFast(original, key);

    expect(encrypted).toMatch(/^enc:/);
    expect(encrypted).not.toBe(original);

    const decrypted = await decryptValueFast(encrypted, key);
    expect(decrypted).toBe(original);
  });

  it('full node data round-trip: encrypt all NODE_ENCRYPTED_FIELDS then decrypt', async () => {
    const mockNode = {
      id: 42,
      name: 'Max',
      surname: 'Mustermann',
      maidenName: '',
      birthDate: '1990-05-15',
      deathDate: '',
      street: 'Hauptstrasse',
      housenumber: '12',
      city: 'Zurich',
      zip: '8001',
      country: 'Switzerland',
      phone: '+41791234567',
      email: 'max@example.com',
      latitude: '47.3769',
      longitude: '8.5417',
      lastGeocoded: '2024-01-15T10:30:00Z',
      biography: 'A test biography.',
      occupation: 'Engineer',
      education: 'ETH Zurich',
      nationality: 'Swiss',
      notes: 'Some notes',
      addressHash: 'abc123hash',
    };

    const encrypted = await encryptObjectFields(mockNode, NODE_ENCRYPTED_FIELDS, key);

    // id should NOT be encrypted
    expect(encrypted.id).toBe(42);

    // All non-empty string fields should be encrypted
    for (const field of NODE_ENCRYPTED_FIELDS) {
      if (mockNode[field] && mockNode[field] !== '') {
        expect(encrypted[field]).toMatch(/^enc:/);
      }
    }

    const decrypted = await decryptObjectFields(encrypted, NODE_ENCRYPTED_FIELDS, key);

    // All fields should match the originals
    for (const field of NODE_ENCRYPTED_FIELDS) {
      if (mockNode[field] && mockNode[field] !== '') {
        expect(decrypted[field]).toBe(mockNode[field]);
      }
    }

    // id should survive unchanged
    expect(decrypted.id).toBe(42);
  });

  it('encrypting with one key, decrypting with another fails', async () => {
    const otherSalt = generateSalt();
    const otherKey = await getCachedKey('different-password', otherSalt);

    const encrypted = await encryptValueFast('secret data', key);

    await expect(decryptValueFast(encrypted, otherKey)).rejects.toThrow();
  });

  it('null/undefined/empty values pass through unchanged', async () => {
    expect(await encryptValueFast(null, key)).toBeNull();
    expect(await encryptValueFast(undefined, key)).toBeUndefined();
    expect(await encryptValueFast('', key)).toBe('');
  });

  it('latitude/longitude as number strings survive round-trip', async () => {
    const lat = '47.3769';
    const lng = '8.5417';

    const encLat = await encryptValueFast(lat, key);
    const encLng = await encryptValueFast(lng, key);

    const decLat = await decryptValueFast(encLat, key);
    const decLng = await decryptValueFast(encLng, key);

    expect(decLat).toBe(lat);
    expect(decLng).toBe(lng);
    // Verify they can be parsed back to numbers
    expect(parseFloat(decLat)).toBeCloseTo(47.3769);
    expect(parseFloat(decLng)).toBeCloseTo(8.5417);
  });
});
