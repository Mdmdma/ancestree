const fs = require('fs');
const os = require('os');
const path = require('path');
const { setDatabaseDir, resetAuthDb, initializeAuthDb, closeAllFamilyDatabases, getAuthDb } = require('../../database');

function createTestDatabases() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ancestree-test-'));

  // Point database module to temp directory
  setDatabaseDir(tmpDir);
  resetAuthDb();

  // Initialize auth DB schema - returns a promise that resolves when DB is ready
  return new Promise((resolve, reject) => {
    initializeAuthDb();
    // Give SQLite time to create tables (serialize ensures order but callbacks are async)
    const db = getAuthDb();
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", [], function check(err, row) {
      if (err) return reject(err);
      if (row) {
        resolve({ tmpDir, cleanup });
      } else {
        setTimeout(() => {
          db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", [], check);
        }, 50);
      }
    });
  });

  function cleanup() {
    return new Promise((resolve) => {
      closeAllFamilyDatabases();
      const db = getAuthDb();
      db.close(() => {
        resetAuthDb();
        // Remove temp directory
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (e) {
          // Ignore cleanup errors
        }
        resolve();
      });
    });
  }
}

module.exports = { createTestDatabases };
