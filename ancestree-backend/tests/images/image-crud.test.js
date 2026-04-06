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

describe('Image CRUD — /api/images', () => {
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

  /** Helper: confirm an image upload and return the image object from the response. */
  async function confirmImage(overrides = {}) {
    const imageData = createImageData(overrides);
    const res = await request(app)
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
    expect(res.status).toBe(200);
    return res.body.image;
  }

  // ------------------------------------------------------------------
  // GET /api/images
  // ------------------------------------------------------------------
  describe('GET /api/images', () => {
    it('returns an empty array initially', async () => {
      const res = await request(app)
        .get('/api/images')
        .set(auth.headers);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('returns the image after confirm-upload', async () => {
      const image = await confirmImage();

      const res = await request(app)
        .get('/api/images')
        .set(auth.headers);

      expect(res.status).toBe(200);
      const ids = res.body.map((i) => i.id);
      expect(ids).toContain(image.id);
    });
  });

  // ------------------------------------------------------------------
  // GET /api/images/:id
  // ------------------------------------------------------------------
  describe('GET /api/images/:id', () => {
    it('returns a single image by id', async () => {
      const image = await confirmImage();

      const res = await request(app)
        .get(`/api/images/${image.id}`)
        .set(auth.headers);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(image.id);
      expect(res.body.originalFilename).toBeDefined();
    });

    it('returns 404 for nonexistent image', async () => {
      const res = await request(app)
        .get(`/api/images/${uuidv4()}`)
        .set(auth.headers);

      expect(res.status).toBe(404);
    });
  });

  // ------------------------------------------------------------------
  // PUT /api/images/:id — update description
  // ------------------------------------------------------------------
  describe('PUT /api/images/:id', () => {
    it('updates the description', async () => {
      const image = await confirmImage();

      const res = await request(app)
        .put(`/api/images/${image.id}`)
        .set(auth.headers)
        .send({ description: 'Updated description' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify via GET
      const getRes = await request(app)
        .get(`/api/images/${image.id}`)
        .set(auth.headers);

      expect(getRes.body.description).toBe('Updated description');
    });
  });

  // ------------------------------------------------------------------
  // PUT /api/images/:id/question — toggle has_open_questions
  // ------------------------------------------------------------------
  describe('PUT /api/images/:id/question', () => {
    it('toggles has_open_questions to true', async () => {
      const image = await confirmImage();

      const res = await request(app)
        .put(`/api/images/${image.id}/question`)
        .set(auth.headers)
        .send({ hasOpenQuestions: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.hasOpenQuestions).toBe(true);
    });

    it('returns 400 when hasOpenQuestions is not a boolean', async () => {
      const image = await confirmImage();

      const res = await request(app)
        .put(`/api/images/${image.id}/question`)
        .set(auth.headers)
        .send({ hasOpenQuestions: 'yes' });

      expect(res.status).toBe(400);
    });

    it('returns 404 for nonexistent image', async () => {
      const res = await request(app)
        .put(`/api/images/${uuidv4()}/question`)
        .set(auth.headers)
        .send({ hasOpenQuestions: true });

      expect(res.status).toBe(404);
    });
  });

  // ------------------------------------------------------------------
  // PUT /api/images/:id/thumbnail — update thumbnail key
  // ------------------------------------------------------------------
  describe('PUT /api/images/:id/thumbnail', () => {
    it('updates the thumbnail s3 key', async () => {
      const image = await confirmImage();
      const thumbKey = `images/TestFamily/thumbnails/${uuidv4()}.jpg`;

      const res = await request(app)
        .put(`/api/images/${image.id}/thumbnail`)
        .set(auth.headers)
        .send({ thumbnailS3Key: thumbKey });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.thumbnailS3Key).toBe(thumbKey);
    });

    it('returns 400 when thumbnailS3Key is missing', async () => {
      const image = await confirmImage();

      const res = await request(app)
        .put(`/api/images/${image.id}/thumbnail`)
        .set(auth.headers)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 404 for nonexistent image', async () => {
      const res = await request(app)
        .put(`/api/images/${uuidv4()}/thumbnail`)
        .set(auth.headers)
        .send({ thumbnailS3Key: 'images/TestFamily/thumbnails/nope.jpg' });

      expect(res.status).toBe(404);
    });
  });

  // ------------------------------------------------------------------
  // DELETE /api/images/:id
  // ------------------------------------------------------------------
  describe('DELETE /api/images/:id', () => {
    it('removes the image', async () => {
      const image = await confirmImage();

      const res = await request(app)
        .delete(`/api/images/${image.id}`)
        .set(auth.headers);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it is gone
      const getRes = await request(app)
        .get(`/api/images/${image.id}`)
        .set(auth.headers);

      expect(getRes.status).toBe(404);
    });

    it('returns 404 for nonexistent image', async () => {
      const res = await request(app)
        .delete(`/api/images/${uuidv4()}`)
        .set(auth.headers);

      expect(res.status).toBe(404);
    });
  });
});
