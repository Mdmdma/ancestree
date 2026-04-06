const request = require('supertest');
const { app } = require('../../server');
const { createTestDatabases } = require('../helpers/testDb');
const { registerFamily, getAuthHeaders, createAuthenticatedAgent, defaultRegistration } = require('../helpers/authHelpers');

describe('Soft delete family', () => {
  let cleanup;
  let authToken;
  const familyName = 'SoftDeleteFamily';
  const adminPassword = defaultRegistration.adminPassword;

  beforeAll(async () => {
    const result = await createTestDatabases();
    cleanup = result.cleanup;

    const agent = await createAuthenticatedAgent(app, { familyName });
    authToken = agent.token;
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  describe('DELETE /api/auth/delete-family', () => {
    it('marks family for deletion with correct admin password', async () => {
      const res = await request(app)
        .delete('/api/auth/delete-family')
        .set(getAuthHeaders(authToken))
        .send({ adminPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deletedAt).toBeDefined();
      expect(res.body.permanentDeletionDate).toBeDefined();
      expect(res.body.gracePeriodDays).toBeDefined();
      expect(res.body.canCancel).toBe(true);
    });

    it('returns 400 when family is already marked for deletion', async () => {
      const res = await request(app)
        .delete('/api/auth/delete-family')
        .set(getAuthHeaders(authToken))
        .send({ adminPassword });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already marked/i);
    });

    it('returns 401 for wrong admin password', async () => {
      // Register a fresh family to test wrong password
      const freshAgent = await createAuthenticatedAgent(app, { familyName: 'WrongPwdDeleteFamily' });

      const res = await request(app)
        .delete('/api/auth/delete-family')
        .set(getAuthHeaders(freshAgent.token))
        .send({ adminPassword: 'wrongadminpwd' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid admin password/i);
    });

    it('returns 400 when adminPassword is missing', async () => {
      const freshAgent = await createAuthenticatedAgent(app, { familyName: 'MissingPwdDeleteFamily' });

      const res = await request(app)
        .delete('/api/auth/delete-family')
        .set(getAuthHeaders(freshAgent.token))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/admin password.*required/i);
    });

    it('returns 401 without JWT token', async () => {
      const res = await request(app)
        .delete('/api/auth/delete-family')
        .send({ adminPassword });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/cancel-deletion', () => {
    it('clears deleted_at when cancelling deletion', async () => {
      // The family from the top-level beforeAll was already deleted above.
      const res = await request(app)
        .post('/api/auth/cancel-deletion')
        .set(getAuthHeaders(authToken))
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/cancelled/i);
    });

    it('returns 400 when family is not marked for deletion', async () => {
      // The cancellation above already cleared deleted_at
      const res = await request(app)
        .post('/api/auth/cancel-deletion')
        .set(getAuthHeaders(authToken))
        .send();

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not marked for deletion/i);
    });

    it('returns 401 without JWT token', async () => {
      const res = await request(app)
        .post('/api/auth/cancel-deletion')
        .send();

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/deletion-status', () => {
    it('returns markedForDeletion: false when not deleted', async () => {
      const res = await request(app)
        .get('/api/auth/deletion-status')
        .set(getAuthHeaders(authToken));

      expect(res.status).toBe(200);
      expect(res.body.markedForDeletion).toBe(false);
    });

    it('returns correct deletion info when marked for deletion', async () => {
      // Mark family for deletion again
      await request(app)
        .delete('/api/auth/delete-family')
        .set(getAuthHeaders(authToken))
        .send({ adminPassword });

      const res = await request(app)
        .get('/api/auth/deletion-status')
        .set(getAuthHeaders(authToken));

      expect(res.status).toBe(200);
      expect(res.body.markedForDeletion).toBe(true);
      expect(res.body.deletedAt).toBeDefined();
      expect(res.body.deletionSource).toBe('user');
      expect(res.body.gracePeriodDays).toBeDefined();
      expect(res.body.permanentDeletionDate).toBeDefined();
      expect(res.body.daysRemaining).toBeGreaterThan(0);
      expect(res.body.canCancel).toBe(true);
    });

    it('returns 401 without JWT token', async () => {
      const res = await request(app)
        .get('/api/auth/deletion-status');

      expect(res.status).toBe(401);
    });
  });
});
