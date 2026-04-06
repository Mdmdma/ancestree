const request = require('supertest');
const { app } = require('../../server');
const { createTestDatabases } = require('../helpers/testDb');
const { createAuthenticatedAgent } = require('../helpers/authHelpers');

describe('Completion settings — /api/completion/settings', () => {
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
  // GET /api/completion/settings
  // ------------------------------------------------------------------
  describe('GET /api/completion/settings', () => {
    it('returns default values (all require* true, showMissingRequired false)', async () => {
      const res = await request(app)
        .get('/api/completion/settings')
        .set(auth.headers);

      expect(res.status).toBe(200);
      expect(res.body.showMissingRequired).toBe(false);
      expect(res.body.requireName).toBe(true);
      expect(res.body.requireSurname).toBe(true);
      expect(res.body.requireMaidenName).toBe(true);
      expect(res.body.requireBirthDate).toBe(true);
      expect(res.body.requireStreetFields).toBe(true);
      expect(res.body.requireCityZip).toBe(true);
      expect(res.body.requireCountry).toBe(true);
      expect(res.body.requirePhone).toBe(true);
      expect(res.body.requireEmail).toBe(true);
      expect(res.body.requireTaggedImage).toBe(true);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/completion/settings');

      expect(res.status).toBe(401);
    });
  });

  // ------------------------------------------------------------------
  // POST /api/completion/settings
  // ------------------------------------------------------------------
  describe('POST /api/completion/settings', () => {
    it('updates fields and returns 200', async () => {
      const res = await request(app)
        .post('/api/completion/settings')
        .set(auth.headers)
        .send({
          showMissingRequired: true,
          requireName: true,
          requireSurname: false,
          requireMaidenName: false,
          requireBirthDate: true,
          requireStreetFields: false,
          requireCityZip: true,
          requireCountry: false,
          requirePhone: false,
          requireEmail: false,
          requireTaggedImage: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET reflects the updates', async () => {
      const res = await request(app)
        .get('/api/completion/settings')
        .set(auth.headers);

      expect(res.status).toBe(200);
      expect(res.body.showMissingRequired).toBe(true);
      expect(res.body.requireName).toBe(true);
      expect(res.body.requireSurname).toBe(false);
      expect(res.body.requireMaidenName).toBe(false);
      expect(res.body.requireBirthDate).toBe(true);
      expect(res.body.requireStreetFields).toBe(false);
      expect(res.body.requireCityZip).toBe(true);
      expect(res.body.requireCountry).toBe(false);
      expect(res.body.requirePhone).toBe(false);
      expect(res.body.requireEmail).toBe(false);
      expect(res.body.requireTaggedImage).toBe(false);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/completion/settings')
        .send({ showMissingRequired: true });

      expect(res.status).toBe(401);
    });
  });
});
