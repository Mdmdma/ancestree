const request = require('supertest');
const { app } = require('../../server');
const { createTestDatabases } = require('../helpers/testDb');
const { registerFamily, defaultRegistration } = require('../helpers/authHelpers');

describe('POST /api/auth/register', () => {
  let cleanup;

  beforeAll(async () => {
    const result = await createTestDatabases();
    cleanup = result.cleanup;
  });

  afterAll(async () => {
    // Registration triggers async background operations (encryptField, family DB writes)
    // that may still be in flight. Wait briefly to let them settle or fail before cleanup.
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (cleanup) await cleanup();
  });

  // BUG: Registration calls encryptField from an empty encryption.js module,
  // which causes a TypeError. The registration itself (user creation + JWT)
  // succeeds, but the post-registration step (storing encrypted admin settings
  // in the family DB) crashes. The 201 response is still returned because the
  // crash happens asynchronously after the response is sent.
  it('returns 201 with token and encryption salt for valid registration', async () => {
    const res = await registerFamily(app, { familyName: 'NewFamily' });

    // The 201 response is sent before encryptField is called, so registration
    // appears to succeed even though a background error occurs.
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
    expect(res.body.encryptionEnabled).toBe(true);
    expect(res.body.encryptionSalt).toBeDefined();
    expect(typeof res.body.encryptionSalt).toBe('string');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.familyName).toBe('NewFamily');
    expect(res.body.user.id).toBeDefined();
  });

  it('returns 400 when familyName is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        password: 'testpass123',
        adminPassword: 'adminpass123',
        adminEmail: 'test@example.com',
        termsAccepted: true,
        termsVersion: 'beta-1.0',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        familyName: 'MissingPwdFamily',
        adminPassword: 'adminpass123',
        adminEmail: 'test@example.com',
        termsAccepted: true,
        termsVersion: 'beta-1.0',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when adminPassword is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        familyName: 'MissingAdminPwdFamily',
        password: 'testpass123',
        adminEmail: 'test@example.com',
        termsAccepted: true,
        termsVersion: 'beta-1.0',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/admin password/i);
  });

  it('returns 400 when adminEmail is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        familyName: 'MissingEmailFamily',
        password: 'testpass123',
        adminPassword: 'adminpass123',
        termsAccepted: true,
        termsVersion: 'beta-1.0',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('returns 400 when termsAccepted is false', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        familyName: 'NoTermsFamily',
        password: 'testpass123',
        adminPassword: 'adminpass123',
        adminEmail: 'test@example.com',
        termsAccepted: false,
        termsVersion: 'beta-1.0',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/terms/i);
  });

  it('returns 400 when termsVersion is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        familyName: 'NoTermsVersionFamily',
        password: 'testpass123',
        adminPassword: 'adminpass123',
        adminEmail: 'test@example.com',
        termsAccepted: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/terms version/i);
  });

  it('returns 400 when password is shorter than 6 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        familyName: 'ShortPwdFamily',
        password: '12345',
        adminPassword: 'adminpass123',
        adminEmail: 'test@example.com',
        termsAccepted: true,
        termsVersion: 'beta-1.0',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/6 characters/i);
  });

  it('returns 400 when adminPassword is shorter than 6 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        familyName: 'ShortAdminPwdFamily',
        password: 'testpass123',
        adminPassword: '12345',
        adminEmail: 'test@example.com',
        termsAccepted: true,
        termsVersion: 'beta-1.0',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/admin password.*6 characters/i);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        familyName: 'BadEmailFamily',
        password: 'testpass123',
        adminPassword: 'adminpass123',
        adminEmail: 'not-an-email',
        termsAccepted: true,
        termsVersion: 'beta-1.0',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/valid email/i);
  });

  it('returns 400 for duplicate family name', async () => {
    // First registration — use a unique name for this test
    const first = await registerFamily(app, { familyName: 'DuplicateTestFamily' });
    expect(first.status).toBe(201);

    // Second registration with the same name
    const second = await registerFamily(app, { familyName: 'DuplicateTestFamily' });
    expect([400, 409]).toContain(second.status);
    expect(second.body.error).toMatch(/already exists/i);
  });

  describe('beta access password enforcement', () => {
    const originalBetaPassword = process.env.BETA_ACCESS_PASSWORD;

    beforeAll(() => {
      process.env.BETA_ACCESS_PASSWORD = 'secret-beta-pw';
    });

    afterAll(() => {
      process.env.BETA_ACCESS_PASSWORD = originalBetaPassword;
    });

    it('returns 403 when beta password is required but wrong', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          familyName: 'BetaWrongFamily',
          password: 'testpass123',
          adminPassword: 'adminpass123',
          adminEmail: 'beta@example.com',
          termsAccepted: true,
          termsVersion: 'beta-1.0',
          betaAccessPassword: 'wrong-beta-pw',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/beta/i);
    });

    it('returns 403 when beta password is required but missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          familyName: 'BetaMissingFamily',
          password: 'testpass123',
          adminPassword: 'adminpass123',
          adminEmail: 'beta2@example.com',
          termsAccepted: true,
          termsVersion: 'beta-1.0',
        });

      expect(res.status).toBe(403);
    });

    it('succeeds when correct beta password is provided', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          familyName: 'BetaCorrectFamily',
          password: 'testpass123',
          adminPassword: 'adminpass123',
          adminEmail: 'beta3@example.com',
          termsAccepted: true,
          termsVersion: 'beta-1.0',
          betaAccessPassword: 'secret-beta-pw',
        });

      expect(res.status).toBe(201);
    });
  });
});
