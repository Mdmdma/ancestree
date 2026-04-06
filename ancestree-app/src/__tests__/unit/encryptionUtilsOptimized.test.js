import {
  generateSalt,
  getCachedKey,
  clearCachedKey,
  hasCachedKey,
  encryptValueFast,
  decryptValueFast,
  encryptBatch,
  decryptBatch,
  encryptObjectFields,
  decryptObjectFields,
  isEncrypted,
} from '../../encryptionUtilsOptimized';

describe('encryptionUtilsOptimized', () => {
  const TEST_PASSWORD = 'test-password-123';
  let testSalt;
  let testKey;

  beforeAll(async () => {
    testSalt = generateSalt();
    testKey = await getCachedKey(TEST_PASSWORD, testSalt);
  });

  afterEach(() => {
    // Clear the cached key between tests to avoid cross-test contamination
    clearCachedKey();
  });

  afterAll(() => {
    clearCachedKey();
  });

  describe('generateSalt', () => {
    it('returns a base64 string', () => {
      const salt = generateSalt();
      expect(typeof salt).toBe('string');
      // base64 should decode without error
      expect(() => atob(salt)).not.toThrow();
    });

    it('generates different salts on each call', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1).not.toBe(salt2);
    });

    it('has reasonable length (16 bytes = ~24 base64 chars)', () => {
      const salt = generateSalt();
      expect(salt.length).toBeGreaterThanOrEqual(20);
      expect(salt.length).toBeLessThanOrEqual(28);
    });
  });

  describe('getCachedKey', () => {
    it('returns a CryptoKey', async () => {
      const salt = generateSalt();
      const key = await getCachedKey(TEST_PASSWORD, salt);
      expect(key).toBeDefined();
      expect(key.constructor.name).toBe('CryptoKey');
    });

    it('caches the key for identical password and salt', async () => {
      const salt = generateSalt();
      const key1 = await getCachedKey(TEST_PASSWORD, salt);
      const key2 = await getCachedKey(TEST_PASSWORD, salt);
      expect(key1).toBe(key2); // same reference
    });

    it('derives a new key when password changes', async () => {
      const salt = generateSalt();
      const key1 = await getCachedKey('password-a', salt);
      const key2 = await getCachedKey('password-b', salt);
      expect(key1).not.toBe(key2);
    });

    it('derives a new key when salt changes', async () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      const key1 = await getCachedKey(TEST_PASSWORD, salt1);
      const key2 = await getCachedKey(TEST_PASSWORD, salt2);
      expect(key1).not.toBe(key2);
    });
  });

  describe('clearCachedKey / hasCachedKey', () => {
    it('hasCachedKey returns true after getCachedKey', async () => {
      const salt = generateSalt();
      await getCachedKey(TEST_PASSWORD, salt);
      expect(hasCachedKey()).toBe(true);
    });

    it('hasCachedKey returns false after clearCachedKey', async () => {
      const salt = generateSalt();
      await getCachedKey(TEST_PASSWORD, salt);
      clearCachedKey();
      expect(hasCachedKey()).toBe(false);
    });
  });

  describe('encryptValueFast / decryptValueFast', () => {
    let key;
    beforeEach(async () => {
      const salt = generateSalt();
      key = await getCachedKey(TEST_PASSWORD, salt);
    });

    it('round-trips a simple string', async () => {
      const encrypted = await encryptValueFast('hello', key);
      const decrypted = await decryptValueFast(encrypted, key);
      expect(decrypted).toBe('hello');
    });

    it('round-trips unicode text', async () => {
      const unicode = 'Zurich Strasse 42';
      const encrypted = await encryptValueFast(unicode, key);
      const decrypted = await decryptValueFast(encrypted, key);
      expect(decrypted).toBe(unicode);
    });

    it('round-trips emoji text', async () => {
      const emoji = 'Hello World';
      const encrypted = await encryptValueFast(emoji, key);
      const decrypted = await decryptValueFast(encrypted, key);
      expect(decrypted).toBe(emoji);
    });

    it('passes through null unchanged', async () => {
      const result = await encryptValueFast(null, key);
      expect(result).toBeNull();
    });

    it('passes through undefined unchanged', async () => {
      const result = await encryptValueFast(undefined, key);
      expect(result).toBeUndefined();
    });

    it('passes through empty string unchanged', async () => {
      const result = await encryptValueFast('', key);
      expect(result).toBe('');
    });

    it('encrypted value starts with "enc:" prefix', async () => {
      const encrypted = await encryptValueFast('test', key);
      expect(encrypted).toMatch(/^enc:/);
    });

    it('decryptValueFast returns non-encrypted values as-is', async () => {
      expect(await decryptValueFast('plain text', key)).toBe('plain text');
      expect(await decryptValueFast(null, key)).toBeNull();
      expect(await decryptValueFast(undefined, key)).toBeUndefined();
      expect(await decryptValueFast('', key)).toBe('');
    });

    it('produces different ciphertext for the same plaintext (random IV)', async () => {
      const enc1 = await encryptValueFast('same', key);
      const enc2 = await encryptValueFast('same', key);
      expect(enc1).not.toBe(enc2);
    });

    it('converts numbers to strings for encryption', async () => {
      const encrypted = await encryptValueFast(42, key);
      const decrypted = await decryptValueFast(encrypted, key);
      expect(decrypted).toBe('42');
    });

    it('fails decryption with a wrong key', async () => {
      const salt2 = generateSalt();
      const wrongKey = await getCachedKey('wrong-password', salt2);

      const encrypted = await encryptValueFast('secret', key);
      await expect(decryptValueFast(encrypted, wrongKey)).rejects.toThrow();
    });
  });

  describe('isEncrypted', () => {
    it('returns true for strings starting with "enc:"', () => {
      expect(isEncrypted('enc:abc123')).toBe(true);
    });

    it('returns false for regular strings', () => {
      expect(isEncrypted('hello')).toBe(false);
      expect(isEncrypted('encrypted: yes')).toBe(false);
    });

    it('returns false for non-string values', () => {
      expect(isEncrypted(null)).toBe(false);
      expect(isEncrypted(undefined)).toBe(false);
      expect(isEncrypted(123)).toBe(false);
      expect(isEncrypted(true)).toBe(false);
    });
  });

  describe('encryptBatch / decryptBatch', () => {
    let key;
    beforeEach(async () => {
      const salt = generateSalt();
      key = await getCachedKey(TEST_PASSWORD, salt);
    });

    it('round-trips an array of values', async () => {
      const values = ['alpha', 'beta', 'gamma'];
      const encrypted = await encryptBatch(values, key);
      expect(encrypted).toHaveLength(3);
      encrypted.forEach((val) => expect(val).toMatch(/^enc:/));

      const decrypted = await decryptBatch(encrypted, key);
      expect(decrypted).toEqual(values);
    });

    it('handles null and empty values in the array', async () => {
      const values = ['hello', null, '', undefined, 'world'];
      const encrypted = await encryptBatch(values, key);
      // null, '', undefined should pass through
      expect(encrypted[1]).toBeNull();
      expect(encrypted[2]).toBe('');
      expect(encrypted[3]).toBeUndefined();

      const decrypted = await decryptBatch(encrypted, key);
      expect(decrypted[0]).toBe('hello');
      expect(decrypted[1]).toBeNull();
      expect(decrypted[2]).toBe('');
      expect(decrypted[3]).toBeUndefined();
      expect(decrypted[4]).toBe('world');
    });

    it('handles empty array', async () => {
      const encrypted = await encryptBatch([], key);
      expect(encrypted).toEqual([]);
      const decrypted = await decryptBatch([], key);
      expect(decrypted).toEqual([]);
    });
  });

  describe('encryptObjectFields / decryptObjectFields', () => {
    let key;
    beforeEach(async () => {
      const salt = generateSalt();
      key = await getCachedKey(TEST_PASSWORD, salt);
    });

    it('encrypts and decrypts specified fields on an object', async () => {
      const obj = { name: 'John', surname: 'Doe', id: '123' };
      const fields = ['name', 'surname'];

      const encrypted = await encryptObjectFields(obj, fields, key);
      expect(encrypted.id).toBe('123'); // not encrypted
      expect(isEncrypted(encrypted.name)).toBe(true);
      expect(isEncrypted(encrypted.surname)).toBe(true);

      const decrypted = await decryptObjectFields(encrypted, fields, key);
      expect(decrypted.name).toBe('John');
      expect(decrypted.surname).toBe('Doe');
      expect(decrypted.id).toBe('123');
    });

    it('skips null, undefined, and empty string fields during encryption', async () => {
      const obj = { name: null, surname: undefined, email: '' };
      const fields = ['name', 'surname', 'email'];

      const encrypted = await encryptObjectFields(obj, fields, key);
      expect(encrypted.name).toBeNull();
      expect(encrypted.surname).toBeUndefined();
      expect(encrypted.email).toBe('');
    });

    it('returns null/undefined object as-is', async () => {
      expect(await encryptObjectFields(null, ['name'], key)).toBeNull();
      expect(await encryptObjectFields(undefined, ['name'], key)).toBeUndefined();
      expect(await decryptObjectFields(null, ['name'], key)).toBeNull();
      expect(await decryptObjectFields(undefined, ['name'], key)).toBeUndefined();
    });

    it('does not modify the original object', async () => {
      const obj = { name: 'John', id: '123' };
      const encrypted = await encryptObjectFields(obj, ['name'], key);
      expect(obj.name).toBe('John'); // original unchanged
      expect(encrypted.name).not.toBe('John');
    });
  });
});
