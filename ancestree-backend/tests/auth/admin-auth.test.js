const request = require('supertest');
const { app } = require('../../server');
const { createTestDatabases } = require('../helpers/testDb');
const { registerFamily, loginFamily, getAuthHeaders, createAuthenticatedAgent, defaultRegistration } = require('../helpers/authHelpers');
const { getAuthDb } = require('../../database');

describe('POST /api/auth/admin-login', () => {
  let cleanup;
  let authToken;

  beforeAll(async () => {
    const result = await createTestDatabases();
    cleanup = result.cleanup;

    // Register and get a token
    const agent = await createAuthenticatedAgent(app);
    authToken = agent.token;
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  it('returns 200 for correct admin password', async () => {
    const res = await request(app)
      .post('/api/auth/admin-login')
      .set(getAuthHeaders(authToken))
      .send({ adminPassword: defaultRegistration.adminPassword });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 401 for wrong admin password', async () => {
    const res = await request(app)
      .post('/api/auth/admin-login')
      .set(getAuthHeaders(authToken))
      .send({ adminPassword: 'wrongadminpwd' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid admin password/i);
  });

  it('returns 400 when adminPassword is missing', async () => {
    const res = await request(app)
      .post('/api/auth/admin-login')
      .set(getAuthHeaders(authToken))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/admin password.*required/i);
  });

  it('returns 401 without JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/admin-login')
      .send({ adminPassword: defaultRegistration.adminPassword });

    expect(res.status).toBe(401);
  });

  // BUG: When admin_password_hash is NULL in the database, the endpoint
  // auto-creates a hardcoded default password "adminn" (note the double 'n')
  // and then validates against it. This is a security vulnerability because
  // any attacker who knows this default can gain admin access to families
  // that were created before admin passwords were required.
  it('auto-creates default "adminn" password when admin_password_hash is null (BUG: insecure default)', async () => {
    // Register a new family
    const uniqueName = 'NullAdminPwdFamily';
    const regRes = await registerFamily(app, {
      familyName: uniqueName,
      password: 'testpass123',
      adminPassword: 'adminpass123',
      adminEmail: 'nulladmin@example.com',
    });
    expect(regRes.status).toBe(201);
    const token = regRes.body.token;

    // Directly set admin_password_hash to NULL in the database
    const authDb = getAuthDb();
    await new Promise((resolve, reject) => {
      authDb.run(
        'UPDATE users SET admin_password_hash = NULL WHERE family_name = ?',
        [uniqueName],
        function (err) {
          if (err) return reject(err);
          resolve();
        }
      );
    });

    // Now try admin-login with the hardcoded default "adminn"
    const res = await request(app)
      .post('/api/auth/admin-login')
      .set(getAuthHeaders(token))
      .send({ adminPassword: 'adminn' });

    // BUG: This succeeds because the server auto-creates "adminn" as the default.
    // A secure implementation would reject the request or require the user to set
    // an admin password through a proper flow.
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
