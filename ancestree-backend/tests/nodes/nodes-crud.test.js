const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const { app } = require('../../server');
const { createTestDatabases } = require('../helpers/testDb');
const { registerFamily, loginFamily, getAuthHeaders, createAuthenticatedAgent, defaultRegistration } = require('../helpers/authHelpers');
const { createNodeData, createEdgeData } = require('../helpers/fixtures');

describe('Nodes CRUD — /api/nodes', () => {
  let cleanup;
  let auth; // { token, headers, user, body }

  beforeAll(async () => {
    const result = await createTestDatabases();
    cleanup = result.cleanup;
    auth = await createAuthenticatedAgent(app);
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  // ------------------------------------------------------------------
  // GET /api/nodes
  // ------------------------------------------------------------------
  describe('GET /api/nodes', () => {
    it('returns at least the default node after registration', async () => {
      const res = await request(app)
        .get('/api/nodes')
        .set(auth.headers);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/nodes');

      expect(res.status).toBe(401);
    });
  });

  // ------------------------------------------------------------------
  // POST /api/nodes
  // ------------------------------------------------------------------
  describe('POST /api/nodes', () => {
    it('creates a node with valid data and returns 200', async () => {
      const node = createNodeData();
      const res = await request(app)
        .post('/api/nodes')
        .set(auth.headers)
        .send(node);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('newly created node appears in GET /api/nodes', async () => {
      const node = createNodeData();
      await request(app)
        .post('/api/nodes')
        .set(auth.headers)
        .send(node);

      const res = await request(app)
        .get('/api/nodes')
        .set(auth.headers);

      const ids = res.body.map((n) => n.id);
      expect(ids).toContain(node.id);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/nodes')
        .send(createNodeData());

      expect(res.status).toBe(401);
    });

    // BUG: POST /api/nodes with missing `position` object crashes because
    // the handler accesses position.x / position.y without null-checking.
    // The server returns 500 instead of a graceful 400.
    it('returns 500 when position is missing (BUG: should be 400)', async () => {
      const node = createNodeData();
      delete node.position;

      const res = await request(app)
        .post('/api/nodes')
        .set(auth.headers)
        .send(node);

      // Current behavior: server crashes with TypeError and returns 500
      expect(res.status).toBe(500);
    });

    // BUG: POST response returns numeric `this.lastID` (SQLite rowid) instead
    // of the UUID text id that was sent in the request body.
    it.fails('returns the UUID id in the response, not a numeric rowid (BUG: returns this.lastID)', async () => {
      const nodeId = uuidv4();
      const node = createNodeData({ id: nodeId });

      const res = await request(app)
        .post('/api/nodes')
        .set(auth.headers)
        .send(node);

      expect(res.status).toBe(200);
      // The response should contain the UUID that was sent
      // BUG: res.body.id is a numeric rowid (e.g. 3) instead of the UUID string
      expect(res.body.id).toBe(nodeId);
    });
  });

  // ------------------------------------------------------------------
  // PUT /api/nodes/:id
  // ------------------------------------------------------------------
  describe('PUT /api/nodes/:id', () => {
    let existingNodeId;

    beforeAll(async () => {
      const node = createNodeData();
      existingNodeId = node.id;
      await request(app)
        .post('/api/nodes')
        .set(auth.headers)
        .send(node);
    });

    it('full update returns 200', async () => {
      const res = await request(app)
        .put(`/api/nodes/${existingNodeId}`)
        .set(auth.headers)
        .send({
          position: { x: 300, y: 400 },
          data: {
            name: 'Jane',
            surname: 'Smith',
            maidenName: null,
            birthDate: '1985-06-20',
            deathDate: null,
            street: null,
            housenumber: null,
            city: 'Bern',
            zip: '3000',
            country: 'Switzerland',
            phone: null,
            email: null,
            latitude: null,
            longitude: null,
            addressHash: null,
            lastGeocoded: null,
            bloodline: true,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('partial update (position only) returns 200', async () => {
      const res = await request(app)
        .put(`/api/nodes/${existingNodeId}`)
        .set(auth.headers)
        .send({ position: { x: 500, y: 600 } });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 for nonexistent node', async () => {
      const res = await request(app)
        .put(`/api/nodes/${uuidv4()}`)
        .set(auth.headers)
        .send({
          position: { x: 0, y: 0 },
          data: {
            name: 'Nobody',
            surname: 'None',
            maidenName: null,
            birthDate: null,
            deathDate: null,
            street: null,
            housenumber: null,
            city: null,
            zip: null,
            country: null,
            phone: null,
            email: null,
            latitude: null,
            longitude: null,
            addressHash: null,
            lastGeocoded: null,
            bloodline: false,
          },
        });

      expect(res.status).toBe(404);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .put(`/api/nodes/${existingNodeId}`)
        .send({ position: { x: 0, y: 0 } });

      expect(res.status).toBe(401);
    });
  });

  // ------------------------------------------------------------------
  // DELETE /api/nodes/:id
  // ------------------------------------------------------------------
  describe('DELETE /api/nodes/:id', () => {
    it('removes a node and returns 200', async () => {
      const node = createNodeData();
      await request(app)
        .post('/api/nodes')
        .set(auth.headers)
        .send(node);

      const res = await request(app)
        .delete(`/api/nodes/${node.id}`)
        .set(auth.headers);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify the node is gone
      const getRes = await request(app)
        .get('/api/nodes')
        .set(auth.headers);

      const ids = getRes.body.map((n) => n.id);
      expect(ids).not.toContain(node.id);
    });

    it('cascades deletion to connected edges', async () => {
      // Create two new nodes
      const nodeA = createNodeData();
      const nodeB = createNodeData();
      await request(app).post('/api/nodes').set(auth.headers).send(nodeA);
      await request(app).post('/api/nodes').set(auth.headers).send(nodeB);

      // Create an edge between them
      const edge = createEdgeData({ source: nodeA.id, target: nodeB.id });
      await request(app).post('/api/edges').set(auth.headers).send(edge);

      // Delete nodeA
      await request(app).delete(`/api/nodes/${nodeA.id}`).set(auth.headers);

      // Verify the edge is also gone
      const edgesRes = await request(app).get('/api/edges').set(auth.headers);
      const edgeIds = edgesRes.body.map((e) => e.id);
      expect(edgeIds).not.toContain(edge.id);
    });

    it('returns 400 when trying to delete the last remaining node', async () => {
      // Get current nodes
      const nodesRes = await request(app).get('/api/nodes').set(auth.headers);
      const nodeIds = nodesRes.body.map((n) => n.id);

      // Delete all but one
      for (let i = 1; i < nodeIds.length; i++) {
        await request(app).delete(`/api/nodes/${nodeIds[i]}`).set(auth.headers);
      }

      // Try to delete the last one
      const res = await request(app)
        .delete(`/api/nodes/${nodeIds[0]}`)
        .set(auth.headers);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 404 for nonexistent node', async () => {
      // Ensure there are at least 2 nodes so the "last node" guard doesn't trigger
      const extra = createNodeData();
      await request(app).post('/api/nodes').set(auth.headers).send(extra);

      const res = await request(app)
        .delete(`/api/nodes/${uuidv4()}`)
        .set(auth.headers);

      expect(res.status).toBe(404);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).delete(`/api/nodes/${uuidv4()}`);

      expect(res.status).toBe(401);
    });
  });
});
