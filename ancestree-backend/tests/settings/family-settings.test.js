const request = require('supertest');
const { app } = require('../../server');
const { createTestDatabases } = require('../helpers/testDb');
const { createAuthenticatedAgent } = require('../helpers/authHelpers');

describe('Family settings — /api/family/*', () => {
  let cleanup;
  let auth;

  beforeAll(async () => {
    const result = await createTestDatabases();
    cleanup = result.cleanup;
    auth = await createAuthenticatedAgent(app);
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  // ------------------------------------------------------------------
  // GET /api/family/settings
  // ------------------------------------------------------------------
  describe('GET /api/family/settings', () => {
    it('returns default settings after registration', async () => {
      const res = await request(app)
        .get('/api/family/settings')
        .set(auth.headers);

      expect(res.status).toBe(200);
      // Default values after registration
      expect(res.body).toHaveProperty('encryptionEnabled');
      expect(res.body).toHaveProperty('showStreetFields');
      expect(res.body).toHaveProperty('showPhoneField');
      expect(res.body).toHaveProperty('showEmailField');
      expect(res.body).toHaveProperty('nodeCreationLocked');
      expect(typeof res.body.encryptionEnabled).toBe('boolean');
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/family/settings');

      expect(res.status).toBe(401);
    });
  });

  // ------------------------------------------------------------------
  // POST /api/family/street-fields-visibility
  // ------------------------------------------------------------------
  describe('POST /api/family/street-fields-visibility', () => {
    it('toggles street fields visibility to false', async () => {
      const res = await request(app)
        .post('/api/family/street-fields-visibility')
        .set(auth.headers)
        .send({ showStreetFields: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('reflects the change in GET /api/family/settings', async () => {
      const res = await request(app)
        .get('/api/family/settings')
        .set(auth.headers);

      expect(res.body.showStreetFields).toBe(false);
    });

    it('toggles street fields visibility back to true', async () => {
      const res = await request(app)
        .post('/api/family/street-fields-visibility')
        .set(auth.headers)
        .send({ showStreetFields: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // POST /api/family/phone-field-visibility
  // ------------------------------------------------------------------
  describe('POST /api/family/phone-field-visibility', () => {
    it('toggles phone field visibility', async () => {
      const res = await request(app)
        .post('/api/family/phone-field-visibility')
        .set(auth.headers)
        .send({ showPhoneField: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const settingsRes = await request(app)
        .get('/api/family/settings')
        .set(auth.headers);

      expect(settingsRes.body.showPhoneField).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // POST /api/family/email-field-visibility
  // ------------------------------------------------------------------
  describe('POST /api/family/email-field-visibility', () => {
    it('toggles email field visibility', async () => {
      const res = await request(app)
        .post('/api/family/email-field-visibility')
        .set(auth.headers)
        .send({ showEmailField: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const settingsRes = await request(app)
        .get('/api/family/settings')
        .set(auth.headers);

      expect(settingsRes.body.showEmailField).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // POST /api/family/node-creation-lock
  // ------------------------------------------------------------------
  describe('POST /api/family/node-creation-lock', () => {
    it('toggles node creation lock', async () => {
      const res = await request(app)
        .post('/api/family/node-creation-lock')
        .set(auth.headers)
        .send({ nodeCreationLocked: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const settingsRes = await request(app)
        .get('/api/family/settings')
        .set(auth.headers);

      expect(settingsRes.body.nodeCreationLocked).toBe(true);

      // Reset for other tests
      await request(app)
        .post('/api/family/node-creation-lock')
        .set(auth.headers)
        .send({ nodeCreationLocked: false });
    });
  });

  // ------------------------------------------------------------------
  // POST /api/family/encryption
  // ------------------------------------------------------------------
  describe('POST /api/family/encryption', () => {
    it('enables encryption with a salt', async () => {
      const res = await request(app)
        .post('/api/family/encryption')
        .set(auth.headers)
        .send({ enabled: true, salt: 'random-salt-value-abc123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 400 when enabling encryption without a salt', async () => {
      const res = await request(app)
        .post('/api/family/encryption')
        .set(auth.headers)
        .send({ enabled: true });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('disables encryption', async () => {
      const res = await request(app)
        .post('/api/family/encryption')
        .set(auth.headers)
        .send({ enabled: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('reflects encryption changes in GET /api/family/settings', async () => {
      // Enable
      await request(app)
        .post('/api/family/encryption')
        .set(auth.headers)
        .send({ enabled: true, salt: 'another-salt-456' });

      const res = await request(app)
        .get('/api/family/settings')
        .set(auth.headers);

      expect(res.body.encryptionEnabled).toBe(true);
      expect(res.body.encryptionSalt).toBe('another-salt-456');
    });
  });
});
