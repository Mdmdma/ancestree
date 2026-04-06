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

describe('Image Upload — presigned upload flow', () => {
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

  // ------------------------------------------------------------------
  // POST /api/images/presigned-upload
  // ------------------------------------------------------------------
  describe('POST /api/images/presigned-upload', () => {
    it('returns uploadUrl and s3Key with valid data', async () => {
      const res = await request(app)
        .post('/api/images/presigned-upload')
        .set(auth.headers)
        .send({
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
          fileSize: 1024
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.uploadUrl).toBeDefined();
      expect(res.body.s3Key).toBeDefined();
      expect(res.body.s3Key).toContain('images/');
      expect(res.body.s3Key).toContain('.jpg');
    });

    it('returns 400 for invalid MIME type', async () => {
      const res = await request(app)
        .post('/api/images/presigned-upload')
        .set(auth.headers)
        .send({
          filename: 'document.pdf',
          contentType: 'application/pdf',
          fileSize: 1024
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_FILE_TYPE');
    });

    it('returns 400 when file exceeds 25MB', async () => {
      const res = await request(app)
        .post('/api/images/presigned-upload')
        .set(auth.headers)
        .send({
          filename: 'huge.jpg',
          contentType: 'image/jpeg',
          fileSize: 26 * 1024 * 1024 // 26 MB
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('FILE_TOO_LARGE');
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/images/presigned-upload')
        .send({
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
          fileSize: 1024
        });

      expect(res.status).toBe(401);
    });
  });

  // ------------------------------------------------------------------
  // POST /api/images/confirm-upload
  // ------------------------------------------------------------------
  describe('POST /api/images/confirm-upload', () => {
    it('saves image metadata after upload confirmation', async () => {
      // Create a node first (images are associated with nodes via people tagging)
      const node = createNodeData();
      await request(app)
        .post('/api/nodes')
        .set(auth.headers)
        .send(node);

      const imageData = createImageData();
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
      expect(res.body.success).toBe(true);
      expect(res.body.image).toBeDefined();
      expect(res.body.image.id).toBeDefined();
      expect(res.body.image.original_filename).toBe(imageData.originalFilename);
      expect(res.body.image.description).toBe(imageData.description);
    });

    it('returns 400 when s3Key is missing', async () => {
      const res = await request(app)
        .post('/api/images/confirm-upload')
        .set(auth.headers)
        .send({
          originalFilename: 'test.jpg'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_FIELDS');
    });

    it('returns 400 when originalFilename is missing', async () => {
      const res = await request(app)
        .post('/api/images/confirm-upload')
        .set(auth.headers)
        .send({
          s3Key: 'images/TestFamily/test.jpg'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_FIELDS');
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/images/confirm-upload')
        .send({
          s3Key: 'images/TestFamily/test.jpg',
          originalFilename: 'test.jpg'
        });

      expect(res.status).toBe(401);
    });
  });
});
