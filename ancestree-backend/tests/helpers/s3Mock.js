const { vi } = require('vitest');

function createS3Mock() {
  const mockS3Instance = {
    getSignedUrl: vi.fn((operation, params) => {
      if (operation === 'putObject') {
        return `https://test-bucket.s3.amazonaws.com/${params.Key}?upload=true`;
      }
      return `https://test-bucket.s3.amazonaws.com/${params.Key}?signed=true`;
    }),
    getObject: vi.fn().mockReturnValue({
      promise: () => Promise.resolve({
        Body: Buffer.from('fake-image-data'),
        ContentType: 'image/jpeg',
        ContentLength: 15
      })
    }),
    putObject: vi.fn().mockReturnValue({
      promise: () => Promise.resolve()
    }),
    deleteObject: vi.fn().mockReturnValue({
      promise: () => Promise.resolve()
    }),
    deleteObjects: vi.fn().mockReturnValue({
      promise: () => Promise.resolve({ Deleted: [], Errors: [] })
    }),
    listObjectsV2: vi.fn().mockReturnValue({
      promise: () => Promise.resolve({ Contents: [], IsTruncated: false })
    }),
    copyObject: vi.fn().mockReturnValue({
      promise: () => Promise.resolve()
    }),
    headObject: vi.fn().mockReturnValue({
      promise: () => Promise.resolve({ ContentLength: 1024, ContentType: 'image/jpeg' })
    })
  };

  return mockS3Instance;
}

module.exports = { createS3Mock };
