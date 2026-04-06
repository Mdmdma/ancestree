// Set environment variables BEFORE any other imports
process.env.NODE_ENV = 'test';
process.env.VITEST = '1';
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.AWS_ACCESS_KEY_ID = 'test-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
process.env.AWS_REGION = 'us-east-1';
process.env.S3_BUCKET_NAME = 'test-bucket';
process.env.PORT = '0';
process.env.BETA_ACCESS_PASSWORD = '';
