const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/setup.js'],
    testTimeout: 15000,
    hookTimeout: 20000,
    pool: 'forks',
    singleFork: true,
    sequence: {
      concurrent: false
    }
  }
});
