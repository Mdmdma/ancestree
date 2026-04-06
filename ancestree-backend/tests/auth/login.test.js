const request = require('supertest');
const { app } = require('../../server');
const { createTestDatabases } = require('../helpers/testDb');
const { registerFamily, loginFamily, defaultRegistration } = require('../helpers/authHelpers');
const { getAuthDb } = require('../../database');
const bcrypt = require('bcrypt');

describe('POST /api/auth/login', () => {
  let cleanup;

  beforeAll(async () => {
    const result = await createTestDatabases();
    cleanup = result.cleanup;

    // Register a family to test login against
    const res = await registerFamily(app);
    expect(res.status).toBe(201);
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  it('returns 200 and JWT for valid credentials', async () => {
    const res = await loginFamily(app, defaultRegistration.familyName, defaultRegistration.password);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.familyName).toBe(defaultRegistration.familyName);
    expect(res.body.user.id).toBeDefined();
  });

  it('returns user info with displayName', async () => {
    const res = await loginFamily(app, defaultRegistration.familyName, defaultRegistration.password);

    expect(res.status).toBe(200);
    expect(res.body.user.displayName).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    const res = await loginFamily(app, defaultRegistration.familyName, 'wrongpassword');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 401 for nonexistent family', async () => {
    const res = await loginFamily(app, 'NonExistentFamily', 'somepassword');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when familyName is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'somepassword' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/family name/i);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ familyName: 'SomeFamily' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  it('returns a token with correct payload (id and familyName)', async () => {
    const res = await loginFamily(app, defaultRegistration.familyName, defaultRegistration.password);

    expect(res.status).toBe(200);
    const token = res.body.token;
    // Decode token payload (base64url middle segment)
    const payloadBase64 = token.split('.')[1];
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString());

    expect(payload.id).toBeDefined();
    expect(payload.familyName).toBe(defaultRegistration.familyName);
    expect(payload.exp).toBeDefined();
  });

  // BUG: Login does not check deleted_at — soft-deleted families can still log in.
  // This test demonstrates the bug: a soft-deleted family should get 401, but the
  // current implementation returns 200 because it never checks deleted_at.
  it.fails('rejects login for a soft-deleted family (BUG: deleted_at not checked)', async () => {
    // Register a separate family for this test
    const deletedFamilyName = 'DeletedFamily';
    const deletedPassword = 'password123';
    await registerFamily(app, {
      familyName: deletedFamilyName,
      password: deletedPassword,
      adminPassword: 'adminpass123',
      adminEmail: 'deleted@example.com',
    });

    // Mark the family as soft-deleted directly in the database
    const authDb = getAuthDb();
    await new Promise((resolve, reject) => {
      authDb.run(
        "UPDATE users SET deleted_at = datetime('now'), deletion_source = 'user' WHERE family_name = ?",
        [deletedFamilyName],
        function (err) {
          if (err) return reject(err);
          resolve();
        }
      );
    });

    // Attempt login — should be rejected (401) but the bug allows it (200)
    const res = await loginFamily(app, deletedFamilyName, deletedPassword);
    expect(res.status).toBe(401);
  });
});
