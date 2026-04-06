const { v4: uuidv4 } = require('uuid');

function createNodeData(overrides = {}) {
  return {
    id: overrides.id || uuidv4(),
    type: 'person',
    position: { x: 100, y: 200 },
    data: {
      name: 'John',
      surname: 'Doe',
      maidenName: null,
      birthDate: '1990-01-15',
      deathDate: null,
      street: null,
      housenumber: null,
      city: 'Zurich',
      zip: '8000',
      country: 'Switzerland',
      phone: null,
      email: null,
      latitude: null,
      longitude: null,
      addressHash: null,
      lastGeocoded: null,
      bloodline: true,
      ...overrides.data
    },
    ...overrides
  };
}

function createEdgeData(overrides = {}) {
  return {
    id: overrides.id || uuidv4(),
    source: overrides.source || 'source-node-id',
    target: overrides.target || 'target-node-id',
    sourceHandle: 'child',
    targetHandle: 'parentconnection',
    type: 'bloodline',
    ...overrides
  };
}

function createImageData(overrides = {}) {
  return {
    s3Key: overrides.s3Key || `images/TestFamily/${uuidv4()}.jpg`,
    s3Url: overrides.s3Url || 'https://test-bucket.s3.amazonaws.com/test.jpg',
    filename: 'test-image.jpg',
    originalFilename: 'test-image.jpg',
    description: 'A test image',
    fileSize: 1024,
    mimeType: 'image/jpeg',
    uploadedBy: 'TestUser',
    ...overrides
  };
}

module.exports = { createNodeData, createEdgeData, createImageData };
