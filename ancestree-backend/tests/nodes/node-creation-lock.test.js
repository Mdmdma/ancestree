const request = require('supertest');
const { app } = require('../../server');
const { createTestDatabases } = require('../helpers/testDb');
const { createAuthenticatedAgent } = require('../helpers/authHelpers');
const { createNodeData } = require('../helpers/fixtures');

describe('Node creation lock — /api/family/node-creation-lock + /api/nodes', () => {
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

  it('enables node creation lock and returns 200', async () => {
    const res = await request(app)
      .post('/api/family/node-creation-lock')
      .set(auth.headers)
      .send({ nodeCreationLocked: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects POST /api/nodes with 403 when lock is ON', async () => {
    const node = createNodeData();
    const res = await request(app)
      .post('/api/nodes')
      .set(auth.headers)
      .send(node);

    expect(res.status).toBe(403);
    expect(res.body.locked).toBe(true);
  });

  it('disables node creation lock and returns 200', async () => {
    const res = await request(app)
      .post('/api/family/node-creation-lock')
      .set(auth.headers)
      .send({ nodeCreationLocked: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('allows POST /api/nodes after lock is disabled', async () => {
    const node = createNodeData();
    const res = await request(app)
      .post('/api/nodes')
      .set(auth.headers)
      .send(node);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
