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
const { v4: uuidv4 } = require('uuid');
const { app } = require('../../server');
const { createTestDatabases } = require('../helpers/testDb');
const { createAuthenticatedAgent } = require('../helpers/authHelpers');
const { createImageData } = require('../helpers/fixtures');

describe('Chat Messages — /api/images/:imageId/chat & /api/chat-messages', () => {
  let cleanup;
  let auth;
  let imageId;

  beforeAll(async () => {
    const result = await createTestDatabases();
    cleanup = result.cleanup;
    auth = await createAuthenticatedAgent(app);

    // Wait for DB migrations to complete (thumbnail_s3_key column is added via async ALTER TABLE)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Confirm an image to attach chat messages to
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
    expect(imgRes.status).toBe(200);
    imageId = imgRes.body.image.id;
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  // ------------------------------------------------------------------
  // GET /api/images/:imageId/chat — empty initially
  // ------------------------------------------------------------------
  describe('GET /api/images/:imageId/chat', () => {
    it('returns empty array when no messages exist', async () => {
      const res = await request(app)
        .get(`/api/images/${imageId}/chat`)
        .set(auth.headers);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // POST /api/images/:imageId/chat — post a message
  // ------------------------------------------------------------------
  describe('POST /api/images/:imageId/chat', () => {
    it('posts a chat message and returns it', async () => {
      const res = await request(app)
        .post(`/api/images/${imageId}/chat`)
        .set(auth.headers)
        .send({
          userName: 'Alice',
          message: 'Great photo!'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBeDefined();
      expect(res.body.message.userName).toBe('Alice');
      expect(res.body.message.message).toBe('Great photo!');
      expect(res.body.message.id).toBeDefined();
    });

    it('returns 400 when userName is missing', async () => {
      const res = await request(app)
        .post(`/api/images/${imageId}/chat`)
        .set(auth.headers)
        .send({
          message: 'No name here'
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 when message is missing', async () => {
      const res = await request(app)
        .post(`/api/images/${imageId}/chat`)
        .set(auth.headers)
        .send({
          userName: 'Alice'
        });

      expect(res.status).toBe(400);
    });

    it('returns 404 when image does not exist', async () => {
      const res = await request(app)
        .post(`/api/images/${uuidv4()}/chat`)
        .set(auth.headers)
        .send({
          userName: 'Alice',
          message: 'Ghost image'
        });

      expect(res.status).toBe(404);
    });
  });

  // ------------------------------------------------------------------
  // GET /api/images/:imageId/chat — after posting
  // ------------------------------------------------------------------
  describe('GET /api/images/:imageId/chat (after posting)', () => {
    it('returns the previously posted message', async () => {
      const res = await request(app)
        .get(`/api/images/${imageId}/chat`)
        .set(auth.headers);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const msg = res.body.find((m) => m.message === 'Great photo!');
      expect(msg).toBeDefined();
      expect(msg.userName).toBe('Alice');
    });
  });

  // ------------------------------------------------------------------
  // GET /api/chat-messages — all messages across all images
  // ------------------------------------------------------------------
  describe('GET /api/chat-messages', () => {
    it('returns all chat messages', async () => {
      const res = await request(app)
        .get('/api/chat-messages')
        .set(auth.headers);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      // Each message should have imageId
      const msg = res.body[0];
      expect(msg.imageId).toBeDefined();
      expect(msg.userName).toBeDefined();
      expect(msg.message).toBeDefined();
    });
  });

  // ------------------------------------------------------------------
  // PUT /api/chat-messages/:id — update a message
  // ------------------------------------------------------------------
  describe('PUT /api/chat-messages/:id', () => {
    it('updates a chat message', async () => {
      // Get existing messages to find an id
      const listRes = await request(app)
        .get(`/api/images/${imageId}/chat`)
        .set(auth.headers);
      const msgId = listRes.body[0].id;

      const res = await request(app)
        .put(`/api/chat-messages/${msgId}`)
        .set(auth.headers)
        .send({ message: 'Updated message text' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify via GET
      const verifyRes = await request(app)
        .get(`/api/images/${imageId}/chat`)
        .set(auth.headers);

      const updated = verifyRes.body.find((m) => m.id === msgId);
      expect(updated.message).toBe('Updated message text');
    });

    it('returns 400 when no fields are provided', async () => {
      const listRes = await request(app)
        .get(`/api/images/${imageId}/chat`)
        .set(auth.headers);
      const msgId = listRes.body[0].id;

      const res = await request(app)
        .put(`/api/chat-messages/${msgId}`)
        .set(auth.headers)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 404 for nonexistent message', async () => {
      const res = await request(app)
        .put('/api/chat-messages/999999')
        .set(auth.headers)
        .send({ message: 'nope' });

      expect(res.status).toBe(404);
    });
  });

  // ------------------------------------------------------------------
  // DELETE /api/images/:imageId/chat/:messageId — remove a message
  // ------------------------------------------------------------------
  describe('DELETE /api/images/:imageId/chat/:messageId', () => {
    it('deletes a chat message', async () => {
      // Post a disposable message
      const postRes = await request(app)
        .post(`/api/images/${imageId}/chat`)
        .set(auth.headers)
        .send({ userName: 'Bob', message: 'To be deleted' });
      const msgId = postRes.body.message.id;

      const res = await request(app)
        .delete(`/api/images/${imageId}/chat/${msgId}`)
        .set(auth.headers);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it is gone
      const listRes = await request(app)
        .get(`/api/images/${imageId}/chat`)
        .set(auth.headers);
      const ids = listRes.body.map((m) => m.id);
      expect(ids).not.toContain(msgId);
    });

    it('returns 404 for nonexistent message', async () => {
      const res = await request(app)
        .delete(`/api/images/${imageId}/chat/999999`)
        .set(auth.headers);

      expect(res.status).toBe(404);
    });
  });
});
