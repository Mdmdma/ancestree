const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const { app } = require('../../server');
const { createTestDatabases } = require('../helpers/testDb');
const { createAuthenticatedAgent } = require('../helpers/authHelpers');
const { createNodeData, createEdgeData } = require('../helpers/fixtures');

describe('Edges CRUD — /api/edges', () => {
  let cleanup;
  let auth;
  let nodeA;
  let nodeB;

  beforeAll(async () => {
    const result = await createTestDatabases();
    cleanup = result.cleanup;
    auth = await createAuthenticatedAgent(app);

    // Create two nodes to use as edge endpoints
    nodeA = createNodeData();
    nodeB = createNodeData();
    await request(app).post('/api/nodes').set(auth.headers).send(nodeA);
    await request(app).post('/api/nodes').set(auth.headers).send(nodeB);
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  // ------------------------------------------------------------------
  // GET /api/edges
  // ------------------------------------------------------------------
  describe('GET /api/edges', () => {
    it('returns an array (may be empty if no edges created yet)', async () => {
      const res = await request(app)
        .get('/api/edges')
        .set(auth.headers);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/edges');

      expect(res.status).toBe(401);
    });
  });

  // ------------------------------------------------------------------
  // POST /api/edges
  // ------------------------------------------------------------------
  describe('POST /api/edges', () => {
    it('creates an edge between two nodes and returns 200', async () => {
      const edge = createEdgeData({ source: nodeA.id, target: nodeB.id });

      const res = await request(app)
        .post('/api/edges')
        .set(auth.headers)
        .send(edge);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.edgeId).toBe(edge.id);
    });

    it('newly created edge appears in GET /api/edges', async () => {
      const edge = createEdgeData({ source: nodeA.id, target: nodeB.id });
      await request(app).post('/api/edges').set(auth.headers).send(edge);

      const res = await request(app)
        .get('/api/edges')
        .set(auth.headers);

      const ids = res.body.map((e) => e.id);
      expect(ids).toContain(edge.id);
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/edges')
        .set(auth.headers)
        .send({ id: uuidv4() }); // missing source, target, type

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/edges')
        .send(createEdgeData({ source: nodeA.id, target: nodeB.id }));

      expect(res.status).toBe(401);
    });

    // BUG: POST /api/edges accepts self-loop edges (source === target).
    // The server should reject an edge where source and target are the same node.
    it.fails('rejects self-loop edge where source === target (BUG: server accepts it)', async () => {
      const edge = createEdgeData({ source: nodeA.id, target: nodeA.id });

      const res = await request(app)
        .post('/api/edges')
        .set(auth.headers)
        .send(edge);

      // Expected: 400 (self-loop not allowed)
      // BUG: returns 200 because there is no self-loop validation
      expect(res.status).toBe(400);
    });
  });

  // ------------------------------------------------------------------
  // PUT /api/edges/:id
  // ------------------------------------------------------------------
  describe('PUT /api/edges/:id', () => {
    let existingEdgeId;

    beforeAll(async () => {
      const edge = createEdgeData({ source: nodeA.id, target: nodeB.id });
      existingEdgeId = edge.id;
      await request(app).post('/api/edges').set(auth.headers).send(edge);
    });

    it('updates the edge type and returns 200', async () => {
      const res = await request(app)
        .put(`/api/edges/${existingEdgeId}`)
        .set(auth.headers)
        .send({ type: 'partner' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.edge).toBeDefined();
      expect(res.body.edge.type).toBe('partner');
    });

    it('returns 404 for nonexistent edge', async () => {
      const res = await request(app)
        .put(`/api/edges/${uuidv4()}`)
        .set(auth.headers)
        .send({ type: 'bloodline' });

      expect(res.status).toBe(404);
    });

    it('returns 400 when no fields are provided', async () => {
      const res = await request(app)
        .put(`/api/edges/${existingEdgeId}`)
        .set(auth.headers)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .put(`/api/edges/${existingEdgeId}`)
        .send({ type: 'partner' });

      expect(res.status).toBe(401);
    });
  });

  // ------------------------------------------------------------------
  // DELETE /api/edges/:id
  // ------------------------------------------------------------------
  describe('DELETE /api/edges/:id', () => {
    it('deletes an existing edge and returns 200', async () => {
      const edge = createEdgeData({ source: nodeA.id, target: nodeB.id });
      await request(app).post('/api/edges').set(auth.headers).send(edge);

      const res = await request(app)
        .delete(`/api/edges/${edge.id}`)
        .set(auth.headers);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it is gone
      const edgesRes = await request(app).get('/api/edges').set(auth.headers);
      const ids = edgesRes.body.map((e) => e.id);
      expect(ids).not.toContain(edge.id);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).delete(`/api/edges/${uuidv4()}`);

      expect(res.status).toBe(401);
    });

    // BUG: DELETE /api/edges/:id returns 200 with changes:0 for a nonexistent edge.
    // The server should return 404 when the edge does not exist, but it always
    // returns 200 because it never checks this.changes.
    it.fails('returns 404 for nonexistent edge (BUG: returns 200 with changes:0)', async () => {
      const res = await request(app)
        .delete(`/api/edges/${uuidv4()}`)
        .set(auth.headers);

      // Expected: 404 (edge not found)
      // BUG: returns 200 with { success: true, changes: 0 }
      expect(res.status).toBe(404);
    });
  });
});
