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
const { createNodeData, createImageData } = require('../helpers/fixtures');

describe('Image People — tagging persons in images', () => {
  let cleanup;
  let auth;
  let nodeId;
  let imageId;

  beforeAll(async () => {
    const result = await createTestDatabases();
    cleanup = result.cleanup;
    auth = await createAuthenticatedAgent(app);

    // Create a person node
    const node = createNodeData();
    nodeId = node.id;
    await request(app)
      .post('/api/nodes')
      .set(auth.headers)
      .send(node);

    // Confirm an image upload
    const imageData = createImageData();
    const imgRes = await request(app)
      .post('/api/images/confirm-upload')
      .set(auth.headers)
      .send({
        s3Key: imageData.s3Key,
        originalFilename: imageData.originalFilename,
        description: imageData.description,
        fileSize: imageData.fileSize,
        mimeType: imageData.mimeType,
        uploadedBy: imageData.uploadedBy
      });
    imageId = imgRes.body.image.id;
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  // ------------------------------------------------------------------
  // POST /api/images/:imageId/people — tag a person
  // ------------------------------------------------------------------
  describe('POST /api/images/:imageId/people', () => {
    it('tags a person in an image', async () => {
      const res = await request(app)
        .post(`/api/images/${imageId}/people`)
        .set(auth.headers)
        .send({
          personId: nodeId,
          positionX: 0.25,
          positionY: 0.35,
          width: 0.1,
          height: 0.15
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.personId).toBe(nodeId);
      expect(res.body.imageId).toBe(imageId);
    });

    it('returns error for duplicate tag (UNIQUE constraint)', async () => {
      // The person was already tagged in the test above
      const res = await request(app)
        .post(`/api/images/${imageId}/people`)
        .set(auth.headers)
        .send({
          personId: nodeId,
          positionX: 0.5,
          positionY: 0.5,
          width: 0.1,
          height: 0.1
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already tagged');
    });

    it('returns 400 when personId is missing', async () => {
      const res = await request(app)
        .post(`/api/images/${imageId}/people`)
        .set(auth.headers)
        .send({
          positionX: 0.5,
          positionY: 0.5
        });

      expect(res.status).toBe(400);
    });
  });

  // ------------------------------------------------------------------
  // Verify hasTaggedImage flag on the node
  // ------------------------------------------------------------------
  describe('Node hasTaggedImage flag', () => {
    it('node has hasTaggedImage = true after being tagged in an image', async () => {
      // The updateHasTaggedImage call is asynchronous (fire-and-forget after response)
      // so we wait briefly for it to complete before checking
      await new Promise((resolve) => setTimeout(resolve, 200));

      const res = await request(app)
        .get('/api/nodes')
        .set(auth.headers);

      expect(res.status).toBe(200);
      const taggedNode = res.body.find((n) => n.id === nodeId);
      expect(taggedNode).toBeDefined();
      expect(taggedNode.data.hasTaggedImage).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // PUT /api/images/:imageId/people/:personId — update position
  // ------------------------------------------------------------------
  describe('PUT /api/images/:imageId/people/:personId', () => {
    it('updates the tag position', async () => {
      const res = await request(app)
        .put(`/api/images/${imageId}/people/${nodeId}`)
        .set(auth.headers)
        .send({
          positionX: 0.6,
          positionY: 0.7,
          width: 0.2,
          height: 0.25
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.positionX).toBe(0.6);
      expect(res.body.positionY).toBe(0.7);
    });

    it('returns 404 for a non-tagged person', async () => {
      const otherNode = createNodeData();
      await request(app)
        .post('/api/nodes')
        .set(auth.headers)
        .send(otherNode);

      const res = await request(app)
        .put(`/api/images/${imageId}/people/${otherNode.id}`)
        .set(auth.headers)
        .send({
          positionX: 0.5,
          positionY: 0.5,
          width: 0.1,
          height: 0.1
        });

      expect(res.status).toBe(404);
    });
  });

  // ------------------------------------------------------------------
  // GET /api/people/:personId/images — tagged images for a person
  // ------------------------------------------------------------------
  describe('GET /api/people/:personId/images', () => {
    it('returns images that the person is tagged in', async () => {
      const res = await request(app)
        .get(`/api/people/${nodeId}/images`)
        .set(auth.headers);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const imageIds = res.body.map((img) => img.id);
      expect(imageIds).toContain(imageId);
    });

    it('returns empty array for a person with no tagged images', async () => {
      const untaggedNode = createNodeData();
      await request(app)
        .post('/api/nodes')
        .set(auth.headers)
        .send(untaggedNode);

      const res = await request(app)
        .get(`/api/people/${untaggedNode.id}/images`)
        .set(auth.headers);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ------------------------------------------------------------------
  // DELETE /api/images/:imageId/people/:personId — remove tag
  // ------------------------------------------------------------------
  describe('DELETE /api/images/:imageId/people/:personId', () => {
    it('removes the person tag from the image', async () => {
      const res = await request(app)
        .delete(`/api/images/${imageId}/people/${nodeId}`)
        .set(auth.headers);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify the person is no longer tagged
      const imgRes = await request(app)
        .get(`/api/images/${imageId}`)
        .set(auth.headers);

      const taggedIds = imgRes.body.people.map((p) => p.personId);
      expect(taggedIds).not.toContain(nodeId);
    });

    it('returns 404 when tag does not exist', async () => {
      // Already deleted above
      const res = await request(app)
        .delete(`/api/images/${imageId}/people/${nodeId}`)
        .set(auth.headers);

      expect(res.status).toBe(404);
    });
  });
});
