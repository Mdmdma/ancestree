import {
  initializeSession,
  getSessionState,
  getDerivedKey,
  isEncryptionEnabled,
  isSessionReady,
  clearSession,
  startBatchOperation,
  endBatchOperation,
  isBatchOperationInProgress,
} from '../../encryptionSession';

import { generateSalt, clearCachedKey } from '../../encryptionUtilsOptimized';

describe('encryptionSession', () => {
  // IMPORTANT: This module has module-level state, so we must clean up after each test.
  // clearSession does NOT reset encryptionEnabled, so we re-initialize with encryption off.
  afterEach(async () => {
    clearSession();
    clearCachedKey();
    await initializeSession('reset', { encryptionEnabled: false });
    clearSession();
    clearCachedKey();
  });

  describe('initializeSession', () => {
    it('initializes with encryption disabled', async () => {
      await initializeSession('password123', { encryptionEnabled: false });
      const state = getSessionState();
      expect(state.encryptionEnabled).toBe(false);
      expect(state.hasKey).toBe(false);
      expect(state.hasFamilyPassword).toBe(true);
    });

    it('initializes with encryption enabled and derives a key', async () => {
      const salt = generateSalt();
      await initializeSession('password123', {
        encryptionEnabled: true,
        encryptionSalt: salt,
        familyName: 'TestFamily',
      });
      const state = getSessionState();
      expect(state.encryptionEnabled).toBe(true);
      expect(state.hasKey).toBe(true);
      expect(state.hasFamilyPassword).toBe(true);
      expect(state.encryptionSalt).toBe(salt);
      expect(state.familyName).toBe('TestFamily');
    });

    it('initializes with encryption enabled but no salt (no key derived)', async () => {
      await initializeSession('password123', {
        encryptionEnabled: true,
        encryptionSalt: null,
      });
      const state = getSessionState();
      expect(state.encryptionEnabled).toBe(true);
      expect(state.hasKey).toBe(false);
    });

    it('handles empty familySettings gracefully', async () => {
      await initializeSession('password123');
      const state = getSessionState();
      expect(state.encryptionEnabled).toBe(false);
      expect(state.hasKey).toBe(false);
    });
  });

  describe('getDerivedKey', () => {
    it('returns CryptoKey when encryption is enabled', async () => {
      const salt = generateSalt();
      await initializeSession('password123', {
        encryptionEnabled: true,
        encryptionSalt: salt,
      });
      const key = getDerivedKey();
      expect(key).not.toBeNull();
      expect(key.constructor.name).toBe('CryptoKey');
    });

    it('returns null when encryption is disabled', async () => {
      await initializeSession('password123', { encryptionEnabled: false });
      const key = getDerivedKey();
      expect(key).toBeNull();
    });
  });

  describe('isEncryptionEnabled', () => {
    it('returns false by default', () => {
      expect(isEncryptionEnabled()).toBe(false);
    });

    it('returns true after enabling encryption', async () => {
      const salt = generateSalt();
      await initializeSession('password123', {
        encryptionEnabled: true,
        encryptionSalt: salt,
      });
      expect(isEncryptionEnabled()).toBe(true);
    });

    it('remains true after clearing session (clearSession does not reset encryptionEnabled)', async () => {
      const salt = generateSalt();
      await initializeSession('password123', {
        encryptionEnabled: true,
        encryptionSalt: salt,
      });
      clearSession();
      // Note: clearSession clears password, salt, key, familyName but NOT encryptionEnabled
      expect(isEncryptionEnabled()).toBe(true);
    });
  });

  describe('isSessionReady', () => {
    it('returns true when encryption is disabled (always ready)', async () => {
      await initializeSession('password123', { encryptionEnabled: false });
      expect(isSessionReady()).toBe(true);
    });

    it('returns true when encryption is enabled with password, salt, and key', async () => {
      const salt = generateSalt();
      await initializeSession('password123', {
        encryptionEnabled: true,
        encryptionSalt: salt,
      });
      expect(isSessionReady()).toBe(true);
    });

    it('returns false when encryption is enabled but key is missing', async () => {
      await initializeSession('password123', {
        encryptionEnabled: true,
        encryptionSalt: null,
      });
      expect(isSessionReady()).toBe(false);
    });
  });

  describe('clearSession', () => {
    it('wipes sensitive data but preserves encryptionEnabled flag', async () => {
      const salt = generateSalt();
      await initializeSession('password123', {
        encryptionEnabled: true,
        encryptionSalt: salt,
        familyName: 'TestFamily',
      });

      clearSession();

      const state = getSessionState();
      // clearSession clears password, salt, derivedKey, familyName
      // but does NOT reset encryptionEnabled
      expect(state.encryptionEnabled).toBe(true);
      expect(state.hasKey).toBe(false);
      expect(state.hasFamilyPassword).toBe(false);
      expect(state.encryptionSalt).toBeNull();
      expect(state.familyName).toBeNull();
    });

    it('makes getDerivedKey return null', async () => {
      const salt = generateSalt();
      await initializeSession('password123', {
        encryptionEnabled: true,
        encryptionSalt: salt,
      });
      clearSession();
      expect(getDerivedKey()).toBeNull();
    });
  });

  describe('batch operations', () => {
    it('isBatchOperationInProgress is false by default', () => {
      expect(isBatchOperationInProgress()).toBe(false);
    });

    it('startBatchOperation sets flag to true', () => {
      startBatchOperation();
      expect(isBatchOperationInProgress()).toBe(true);
    });

    it('endBatchOperation sets flag back to false', () => {
      startBatchOperation();
      expect(isBatchOperationInProgress()).toBe(true);
      endBatchOperation();
      expect(isBatchOperationInProgress()).toBe(false);
    });

    it('multiple start/end cycles work correctly', () => {
      startBatchOperation();
      expect(isBatchOperationInProgress()).toBe(true);
      endBatchOperation();
      expect(isBatchOperationInProgress()).toBe(false);
      startBatchOperation();
      expect(isBatchOperationInProgress()).toBe(true);
      endBatchOperation();
      expect(isBatchOperationInProgress()).toBe(false);
    });
  });

  describe('getSessionState', () => {
    it('does not expose the raw password or key', async () => {
      const salt = generateSalt();
      await initializeSession('password123', {
        encryptionEnabled: true,
        encryptionSalt: salt,
      });
      const state = getSessionState();
      // Should have boolean indicators, not the actual sensitive values
      expect(state).not.toHaveProperty('familyPassword');
      expect(state).not.toHaveProperty('derivedKey');
      expect(state).toHaveProperty('hasKey');
      expect(state).toHaveProperty('hasFamilyPassword');
    });
  });
});
