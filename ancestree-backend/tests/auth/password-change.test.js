const request = require('supertest');
const { app } = require('../../server');
const { createTestDatabases } = require('../helpers/testDb');
const { registerFamily, loginFamily, getAuthHeaders, createAuthenticatedAgent, defaultRegistration } = require('../helpers/authHelpers');

describe('POST /api/auth/change-family-password', () => {
  let cleanup;
  let authToken;
  const familyName = 'PwdChangeFamily';
  const originalPassword = 'originalpass123';
  const newPassword = 'newpassword456';

  beforeAll(async () => {
    const result = await createTestDatabases();
    cleanup = result.cleanup;

    // Register a family for password change tests
    const agent = await createAuthenticatedAgent(app, {
      familyName,
      password: originalPassword,
    });
    authToken = agent.token;
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  it('changes family password successfully', async () => {
    const res = await request(app)
      .post('/api/auth/change-family-password')
      .set(getAuthHeaders(authToken))
      .send({ newPassword });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/password updated/i);
  });

  it('allows login with the new password after change', async () => {
    const res = await loginFamily(app, familyName, newPassword);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  it('rejects login with the old password after change', async () => {
    const res = await loginFamily(app, familyName, originalPassword);

    expect(res.status).toBe(401);
  });

  it('returns 400 when newPassword is missing', async () => {
    // Get a fresh token since the password was changed
    const loginRes = await loginFamily(app, familyName, newPassword);
    const freshToken = loginRes.body.token;

    const res = await request(app)
      .post('/api/auth/change-family-password')
      .set(getAuthHeaders(freshToken))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/new password.*required/i);
  });

  it('returns 400 when newPassword is shorter than 6 characters', async () => {
    const loginRes = await loginFamily(app, familyName, newPassword);
    const freshToken = loginRes.body.token;

    const res = await request(app)
      .post('/api/auth/change-family-password')
      .set(getAuthHeaders(freshToken))
      .send({ newPassword: '12345' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/6 characters/i);
  });

  it('returns 401 without JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/change-family-password')
      .send({ newPassword: 'anotherpassword' });

    expect(res.status).toBe(401);
  });

  // BUG: The change-family-password endpoint only requires a valid JWT token.
  // It does NOT require admin password verification. This means any authenticated
  // user (including those who only know the family password) can change the
  // family password without admin authorization.
  //
  // A secure implementation should require the admin password before allowing
  // a family password change — similar to how delete-family requires it.
  it.fails('requires admin password to change family password (BUG: no admin verification)', async () => {
    // Register a fresh family for this isolated test
    const bugFamilyName = 'BugPwdFamily';
    const agent = await createAuthenticatedAgent(app, {
      familyName: bugFamilyName,
      password: 'testpass123',
    });

    // Try to change the family password WITHOUT providing an admin password.
    // This should fail (require admin password), but the current implementation
    // allows it with just a JWT.
    const res = await request(app)
      .post('/api/auth/change-family-password')
      .set(getAuthHeaders(agent.token))
      .send({ newPassword: 'hackedpassword' });

    // Expected secure behavior: should return 400 or 401 requiring admin password.
    // Actual behavior: returns 200 because no admin password check exists.
    expect(res.status).toBe(401);
  });
});
