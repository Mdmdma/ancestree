vi.mock('aws-sdk', () => {
  const mockS3 = {
    getSignedUrl: vi.fn((op, params) => `https://test-bucket.s3.amazonaws.com/${params.Key}?signed`),
    getObject: vi.fn().mockReturnValue({
      promise: () => Promise.resolve({ Body: Buffer.from('fake'), ContentType: 'image/jpeg', ContentLength: 4 })
    }),
    putObject: vi.fn().mockReturnValue({ promise: () => Promise.resolve() }),
    deleteObject: vi.fn().mockReturnValue({ promise: () => Promise.resolve() }),
    deleteObjects: vi.fn().mockReturnValue({ promise: () => Promise.resolve({ Deleted: [], Errors: [] }) }),
    listObjectsV2: vi.fn().mockReturnValue({ promise: () => Promise.resolve({ Contents: [], IsTruncated: false }) }),
    copyObject: vi.fn().mockReturnValue({ promise: () => Promise.resolve() }),
    headObject: vi.fn().mockReturnValue({ promise: () => Promise.resolve({ ContentLength: 1024, ContentType: 'image/jpeg' }) })
  };
  return { config: { update: vi.fn() }, S3: vi.fn(() => mockS3) };
});

const request = require('supertest');
const { app } = require('../../server');
const { createTestDatabases } = require('../helpers/testDb');
const { createAuthenticatedAgent } = require('../helpers/authHelpers');

describe('Admin Settings — /api/admin/*', () => {
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
  // GET /api/admin/settings
  // ------------------------------------------------------------------
  describe('GET /api/admin/settings', () => {
    it('returns an object (may be empty initially)', async () => {
      const res = await request(app)
        .get('/api/admin/settings')
        .set(auth.headers);

      expect(res.status).toBe(200);
      expect(typeof res.body).toBe('object');
      expect(Array.isArray(res.body)).toBe(false);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .get('/api/admin/settings');

      expect(res.status).toBe(401);
    });
  });

  // ------------------------------------------------------------------
  // POST /api/admin/setting — store a key/value pair
  // ------------------------------------------------------------------
  describe('POST /api/admin/setting', () => {
    it('stores a key/value pair', async () => {
      const res = await request(app)
        .post('/api/admin/setting')
        .set(auth.headers)
        .send({ key: 'theme', value: 'dark' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 400 when key is missing', async () => {
      const res = await request(app)
        .post('/api/admin/setting')
        .set(auth.headers)
        .send({ value: 'orphan-value' });

      expect(res.status).toBe(400);
    });
  });

  // ------------------------------------------------------------------
  // GET /api/admin/setting/:key — retrieve a specific setting
  // ------------------------------------------------------------------
  describe('GET /api/admin/setting/:key', () => {
    it('returns the value for a stored key', async () => {
      // Store a value first
      await request(app)
        .post('/api/admin/setting')
        .set(auth.headers)
        .send({ key: 'language', value: 'de' });

      const res = await request(app)
        .get('/api/admin/setting/language')
        .set(auth.headers);

      expect(res.status).toBe(200);
      expect(res.body.value).toBe('de');
    });

    it('returns empty string for a key that does not exist', async () => {
      const res = await request(app)
        .get('/api/admin/setting/nonexistent-key')
        .set(auth.headers);

      expect(res.status).toBe(200);
      expect(res.body.value).toBe('');
    });
  });

  // ------------------------------------------------------------------
  // POST /api/admin/setting — upsert (overwrite existing key)
  // ------------------------------------------------------------------
  describe('Upsert behavior', () => {
    it('upserts an existing key with a new value', async () => {
      // Set initial value
      await request(app)
        .post('/api/admin/setting')
        .set(auth.headers)
        .send({ key: 'theme', value: 'dark' });

      // Overwrite
      await request(app)
        .post('/api/admin/setting')
        .set(auth.headers)
        .send({ key: 'theme', value: 'light' });

      // Verify updated value
      const res = await request(app)
        .get('/api/admin/setting/theme')
        .set(auth.headers);

      expect(res.body.value).toBe('light');
    });

    it('stored settings appear in GET /api/admin/settings', async () => {
      const res = await request(app)
        .get('/api/admin/settings')
        .set(auth.headers);

      expect(res.status).toBe(200);
      // We stored 'theme' and 'language' in previous tests
      expect(res.body.theme).toBeDefined();
      expect(res.body.language).toBeDefined();
    });
  });

  // ------------------------------------------------------------------
  // GET /api/admin/migration-status
  // ------------------------------------------------------------------
  describe('GET /api/admin/migration-status', () => {
    it('returns migration status for the family', async () => {
      const res = await request(app)
        .get('/api/admin/migration-status')
        .set(auth.headers);

      expect(res.status).toBe(200);
      expect(res.body.familyName).toBeDefined();
      expect(typeof res.body.migrated).toBe('boolean');
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .get('/api/admin/migration-status');

      expect(res.status).toBe(401);
    });
  });
});
