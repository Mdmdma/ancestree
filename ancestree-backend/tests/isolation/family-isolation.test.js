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
const { createNodeData, createEdgeData } = require('../helpers/fixtures');

describe('Family Isolation — cross-family data separation', () => {
  let cleanup;
  let authA; // Family A credentials
  let authB; // Family B credentials

  beforeAll(async () => {
    const result = await createTestDatabases();
    cleanup = result.cleanup;

    // Register two separate families
    authA = await createAuthenticatedAgent(app, {
      familyName: 'FamilyAlpha',
      password: 'alphapass123',
      adminPassword: 'alphaadmin123',
      displayName: 'Alpha Family'
    });
    authB = await createAuthenticatedAgent(app, {
      familyName: 'FamilyBeta',
      password: 'betapass123',
      adminPassword: 'betaadmin123',
      displayName: 'Beta Family'
    });
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  // ------------------------------------------------------------------
  // Nodes are isolated per family
  // ------------------------------------------------------------------
  describe('Node isolation', () => {
    let nodeA;

    beforeAll(async () => {
      // Create a node in family A
      nodeA = createNodeData();
      await request(app)
        .post('/api/nodes')
        .set(authA.headers)
        .send(nodeA);
    });

    it('family A can see its own node', async () => {
      const res = await request(app)
        .get('/api/nodes')
        .set(authA.headers);

      expect(res.status).toBe(200);
      const ids = res.body.map((n) => n.id);
      expect(ids).toContain(nodeA.id);
    });

    it('family B cannot see family A\'s node', async () => {
      const res = await request(app)
        .get('/api/nodes')
        .set(authB.headers);

      expect(res.status).toBe(200);
      const ids = res.body.map((n) => n.id);
      expect(ids).not.toContain(nodeA.id);
    });
  });

  // ------------------------------------------------------------------
  // Edges are isolated per family
  // ------------------------------------------------------------------
  describe('Edge isolation', () => {
    let edgeA;

    beforeAll(async () => {
      // Create two more nodes in family A for the edge
      const nodeA1 = createNodeData();
      const nodeA2 = createNodeData();
      await request(app).post('/api/nodes').set(authA.headers).send(nodeA1);
      await request(app).post('/api/nodes').set(authA.headers).send(nodeA2);

      // Create an edge in family A
      edgeA = createEdgeData({ source: nodeA1.id, target: nodeA2.id });
      await request(app)
        .post('/api/edges')
        .set(authA.headers)
        .send(edgeA);
    });

    it('family A can see its own edge', async () => {
      const res = await request(app)
        .get('/api/edges')
        .set(authA.headers);

      expect(res.status).toBe(200);
      const ids = res.body.map((e) => e.id);
      expect(ids).toContain(edgeA.id);
    });

    it('family B cannot see family A\'s edge', async () => {
      const res = await request(app)
        .get('/api/edges')
        .set(authB.headers);

      expect(res.status).toBe(200);
      const ids = res.body.map((e) => e.id);
      expect(ids).not.toContain(edgeA.id);
    });
  });

  // ------------------------------------------------------------------
  // Images are isolated per family
  // ------------------------------------------------------------------
  describe('Image isolation', () => {
    let imageIdA;

    beforeAll(async () => {
      // Confirm an image in family A
      const imgRes = await request(app)
        .post('/api/images/confirm-upload')
        .set(authA.headers)
        .send({
          s3Key: 'images/FamilyAlpha/isolated.jpg',
          originalFilename: 'isolated.jpg',
          description: 'Family A only',
          fileSize: 512,
          mimeType: 'image/jpeg',
          uploadedBy: 'AlphaUser'
        });
      imageIdA = imgRes.body.image.id;
    });

    it('family A can see its own images', async () => {
      const res = await request(app)
        .get('/api/images')
        .set(authA.headers);

      expect(res.status).toBe(200);
      const ids = res.body.map((i) => i.id);
      expect(ids).toContain(imageIdA);
    });

    it('family B cannot see family A\'s images', async () => {
      const res = await request(app)
        .get('/api/images')
        .set(authB.headers);

      expect(res.status).toBe(200);
      const ids = res.body.map((i) => i.id);
      expect(ids).not.toContain(imageIdA);
    });
  });

  // ------------------------------------------------------------------
  // Completely separate data stores
  // ------------------------------------------------------------------
  describe('Complete data separation', () => {
    it('family B creates its own node that family A cannot see', async () => {
      const nodeB = createNodeData();
      await request(app)
        .post('/api/nodes')
        .set(authB.headers)
        .send(nodeB);

      // Family B sees it
      const resB = await request(app)
        .get('/api/nodes')
        .set(authB.headers);
      const idsB = resB.body.map((n) => n.id);
      expect(idsB).toContain(nodeB.id);

      // Family A does not
      const resA = await request(app)
        .get('/api/nodes')
        .set(authA.headers);
      const idsA = resA.body.map((n) => n.id);
      expect(idsA).not.toContain(nodeB.id);
    });
  });
});
