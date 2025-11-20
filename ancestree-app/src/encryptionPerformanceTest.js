/**
 * Encryption Performance Testing Utility
 * Tests the feasibility of encrypting every field in the database
 * Simulates 10,000 field operations with padding across 10 folds
 */

import { generateSalt } from './encryptionUtils';

// Configuration
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256;
const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Convert string to ArrayBuffer
 */
const stringToArrayBuffer = (str) => {
  return new TextEncoder().encode(str);
};

/**
 * Convert ArrayBuffer to string
 */
const arrayBufferToString = (buffer) => {
  return new TextDecoder().decode(buffer);
};

/**
 * Convert ArrayBuffer to base64
 */
const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Convert base64 to ArrayBuffer
 */
const base64ToArrayBuffer = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Derive encryption key from password and salt using PBKDF2
 * This should only be called ONCE per session and the key reused
 */
const deriveKey = async (password, salt) => {
  const passwordBuffer = stringToArrayBuffer(password);
  const saltBuffer = base64ToArrayBuffer(salt);
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive AES key
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
  
  return key;
};

/**
 * Encrypt a value using a pre-derived key (OPTIMIZED VERSION)
 * This is much faster than deriving the key each time
 */
const encryptValueFast = async (value, cryptoKey) => {
  if (!value || value === null || value === undefined || value === '') {
    return value;
  }
  
  try {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const valueBuffer = stringToArrayBuffer(String(value));
    
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: iv
      },
      cryptoKey,
      valueBuffer
    );
    
    // Combine IV and encrypted data, then base64 encode
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);
    
    return 'enc:' + arrayBufferToBase64(combined.buffer);
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
};

/**
 * Decrypt a value using a pre-derived key (OPTIMIZED VERSION)
 */
const decryptValueFast = async (encryptedValue, cryptoKey) => {
  if (!encryptedValue || !encryptedValue.startsWith('enc:')) {
    return encryptedValue;
  }
  
  try {
    const combined = base64ToArrayBuffer(encryptedValue.substring(4));
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, IV_LENGTH);
    const encryptedData = combined.slice(IV_LENGTH);
    
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv
      },
      cryptoKey,
      encryptedData
    );
    
    return arrayBufferToString(decryptedBuffer);
  } catch (error) {
    console.error('Decryption error:', error);
    throw error;
  }
};

/**
 * Generate realistic test data representing various database field types
 */
const generateTestData = (count) => {
  const data = [];
  const sampleTexts = [
    'John',
    'Doe',
    'Smith',
    '1985-03-15',
    '123 Main Street, Anytown, USA',
    'john.doe@example.com',
    '+1-555-123-4567',
    'Software Engineer',
    'University of California',
    'American',
    'Some additional notes about this person with more text to simulate longer fields',
    'https://example.com/image.jpg',
    'Male',
    'Married',
    'PhD in Computer Science',
    'Notes about family history that are quite long and detailed with multiple sentences',
    '',  // Empty fields
    'A',  // Very short fields
    'This is a much longer text field that represents something like a biography or a detailed description of an event. It contains multiple sentences and provides comprehensive information about the subject matter. This helps us test performance with varying field lengths.',
  ];

  for (let i = 0; i < count; i++) {
    // Pick a random text to simulate variety
    const text = sampleTexts[i % sampleTexts.length];
    data.push({
      id: i,
      value: text,
      // Add padding to simulate worst-case scenario
      paddedValue: text + '\0'.repeat(Math.max(0, 256 - text.length))
    });
  }

  return data;
};

/**
 * Pad a value to a fixed length (in BYTES, not characters)
 */
const padValue = (value, targetBytes = 256) => {
  const str = String(value || '');
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  
  if (bytes.length >= targetBytes) {
    return str; // Already at or exceeds target
  }
  
  // Pad with null bytes
  const padded = new Uint8Array(targetBytes);
  padded.set(bytes);
  // Rest is automatically filled with zeros
  
  return new TextDecoder().decode(padded);
};

/**
 * Unpad a value
 */
const unpadValue = (paddedValue) => {
  if (!paddedValue) return paddedValue;
  // Remove null bytes from the end
  return paddedValue.replace(/\0+$/, '');
};

/**
 * Run a single fold of the performance test
 * OPTIMIZED: Derives key once, then reuses it for all encryptions
 */
const runSingleFold = async (testData, password, salt, withPadding) => {
  const startTime = performance.now();
  const metrics = {
    keyDerivationTime: 0,
    encryptionTimes: [],
    decryptionTimes: [],
    dataSizes: {
      original: 0,
      encrypted: 0
    }
  };

  // Derive key ONCE at the start (this is the expensive operation)
  const keyDerivationStart = performance.now();
  const cryptoKey = await deriveKey(password, salt);
  const keyDerivationEnd = performance.now();
  metrics.keyDerivationTime = keyDerivationEnd - keyDerivationStart;

  // Encryption phase - now much faster with pre-derived key
  const encryptedData = [];
  for (let i = 0; i < testData.length; i++) {
    const item = testData[i];
    const valueToEncrypt = withPadding ? item.paddedValue : item.value;
    
    const encStartTime = performance.now();
    const encrypted = await encryptValueFast(valueToEncrypt, cryptoKey);
    const encEndTime = performance.now();
    
    metrics.encryptionTimes.push(encEndTime - encStartTime);
    metrics.dataSizes.original += (item.value?.length || 0);
    metrics.dataSizes.encrypted += (encrypted?.length || 0);
    
    encryptedData.push(encrypted);
  }

  // Decryption phase - also much faster with pre-derived key
  for (let i = 0; i < encryptedData.length; i++) {
    const encrypted = encryptedData[i];
    
    const decStartTime = performance.now();
    const decrypted = await decryptValueFast(encrypted, cryptoKey);
    const decEndTime = performance.now();
    
    metrics.decryptionTimes.push(decEndTime - decStartTime);
    
    // Verify correctness
    const originalValue = testData[i].value;
    const recoveredValue = withPadding ? unpadValue(decrypted) : decrypted;
    if (recoveredValue !== originalValue) {
      throw new Error(`Decryption mismatch at index ${i}`);
    }
  }

  const endTime = performance.now();
  metrics.totalTime = endTime - startTime;

  return metrics;
};

/**
 * Calculate statistics from an array of numbers
 */
const calculateStats = (numbers) => {
  if (numbers.length === 0) return { mean: 0, median: 0, min: 0, max: 0, total: 0 };
  
  const sorted = [...numbers].sort((a, b) => a - b);
  const sum = numbers.reduce((a, b) => a + b, 0);
  
  return {
    mean: sum / numbers.length,
    median: sorted[Math.floor(sorted.length / 2)],
    min: sorted[0],
    max: sorted[sorted.length - 1],
    total: sum
  };
};

/**
 * Run the complete performance test
 */
export const runEncryptionPerformanceTest = async (options = {}) => {
  const {
    fieldCount = 10000,
    folds = 10,
    withPadding = true,
    onProgress = null
  } = options;

  const results = {
    config: {
      fieldCount,
      folds,
      withPadding,
      paddingLength: withPadding ? 256 : 0
    },
    foldResults: [],
    summary: null
  };

  // Generate test data once
  if (onProgress) onProgress({ phase: 'generating', percent: 0, message: 'Generating test data...' });
  const testData = generateTestData(fieldCount);
  
  // Generate password and salt
  const password = 'test-password-' + Math.random();
  const salt = generateSalt();

  // Run folds
  for (let fold = 0; fold < folds; fold++) {
    if (onProgress) {
      onProgress({
        phase: 'testing',
        fold: fold + 1,
        totalFolds: folds,
        percent: ((fold + 1) / folds) * 100,
        message: `Running fold ${fold + 1} of ${folds}...`
      });
    }

    const foldMetrics = await runSingleFold(testData, password, salt, withPadding);
    results.foldResults.push({
      fold: fold + 1,
      totalTime: foldMetrics.totalTime,
      keyDerivationTime: foldMetrics.keyDerivationTime,
      encryptionStats: calculateStats(foldMetrics.encryptionTimes),
      decryptionStats: calculateStats(foldMetrics.decryptionTimes),
      dataSizes: foldMetrics.dataSizes
    });
  }

  // Calculate summary statistics across all folds
  const allTotalTimes = results.foldResults.map(r => r.totalTime);
  const allEncryptionTotals = results.foldResults.map(r => r.encryptionStats.total);
  const allDecryptionTotals = results.foldResults.map(r => r.decryptionStats.total);
  const allKeyDerivationTimes = results.foldResults.map(r => r.keyDerivationTime);
  
  const avgDataSizes = {
    original: results.foldResults.reduce((sum, r) => sum + r.dataSizes.original, 0) / folds,
    encrypted: results.foldResults.reduce((sum, r) => sum + r.dataSizes.encrypted, 0) / folds
  };

  results.summary = {
    totalTimeStats: calculateStats(allTotalTimes),
    encryptionTimeStats: calculateStats(allEncryptionTotals),
    decryptionTimeStats: calculateStats(allDecryptionTotals),
    keyDerivationTimeStats: calculateStats(allKeyDerivationTimes),
    averageDataSizes: avgDataSizes,
    dataOverhead: ((avgDataSizes.encrypted - avgDataSizes.original) / avgDataSizes.original * 100).toFixed(2) + '%',
    throughput: {
      encryptionsPerSecond: (fieldCount * folds / (calculateStats(allTotalTimes).total / 1000)).toFixed(2),
      fieldsPerSecondEncryption: (fieldCount / (calculateStats(allEncryptionTotals).mean / 1000)).toFixed(2),
      fieldsPerSecondDecryption: (fieldCount / (calculateStats(allDecryptionTotals).mean / 1000)).toFixed(2)
    }
  };

  if (onProgress) {
    onProgress({
      phase: 'complete',
      percent: 100,
      message: 'Test complete!'
    });
  }

  return results;
};

/**
 * Format test results for display
 */
export const formatTestResults = (results) => {
  if (!results || !results.summary) return 'No results available';

  const { config, summary, foldResults } = results;
  
  let output = '=== Encryption Performance Test Results ===\n\n';
  
  output += '📋 Configuration:\n';
  output += `  • Total Fields: ${config.fieldCount.toLocaleString()}\n`;
  output += `  • Test Folds: ${config.folds}\n`;
  output += `  • With Padding: ${config.withPadding ? 'Yes' : 'No'}`;
  if (config.withPadding) {
    output += ` (${config.paddingLength} chars)\n`;
  } else {
    output += '\n';
  }
  output += '\n';

  output += '⏱️  Overall Performance:\n';
  output += `  • Mean Total Time: ${summary.totalTimeStats.mean.toFixed(2)}ms per fold\n`;
  output += `  • Min Total Time: ${summary.totalTimeStats.min.toFixed(2)}ms\n`;
  output += `  • Max Total Time: ${summary.totalTimeStats.max.toFixed(2)}ms\n`;
  output += `  • Total Test Time: ${summary.totalTimeStats.total.toFixed(2)}ms\n`;
  output += '\n';

  output += '� Key Derivation Performance:\n';
  output += `  • Mean Time: ${summary.keyDerivationTimeStats.mean.toFixed(2)}ms per fold\n`;
  output += `  • Note: Key derived ONCE per session, then reused\n`;
  output += `  • Amortized cost: ~0ms per field encryption\n`;
  output += '\n';

  output += '�🔒 Encryption Performance (excluding key derivation):\n';
  output += `  • Mean Time: ${summary.encryptionTimeStats.mean.toFixed(2)}ms per fold\n`;
  output += `  • Avg per Field: ${(summary.encryptionTimeStats.mean / config.fieldCount).toFixed(4)}ms\n`;
  output += `  • Throughput: ${summary.throughput.fieldsPerSecondEncryption} fields/sec\n`;
  output += '\n';

  output += '🔓 Decryption Performance (excluding key derivation):\n';
  output += `  • Mean Time: ${summary.decryptionTimeStats.mean.toFixed(2)}ms per fold\n`;
  output += `  • Avg per Field: ${(summary.decryptionTimeStats.mean / config.fieldCount).toFixed(4)}ms\n`;
  output += `  • Throughput: ${summary.throughput.fieldsPerSecondDecryption} fields/sec\n`;
  output += '\n';

  output += '💾 Data Size Impact:\n';
  output += `  • Original Data: ${(summary.averageDataSizes.original / 1024).toFixed(2)} KB\n`;
  output += `  • Encrypted Data: ${(summary.averageDataSizes.encrypted / 1024).toFixed(2)} KB\n`;
  output += `  • Overhead: ${summary.dataOverhead}\n`;
  output += '\n';

  output += '📊 Per-Fold Results:\n';
  foldResults.forEach((fold, index) => {
    output += `  Fold ${fold.fold}: ${fold.totalTime.toFixed(2)}ms total `;
    output += `(Key: ${fold.keyDerivationTime.toFixed(2)}ms, `;
    output += `Enc: ${fold.encryptionStats.total.toFixed(2)}ms, `;
    output += `Dec: ${fold.decryptionStats.total.toFixed(2)}ms)\n`;
  });
  output += '\n';

  output += '✅ Feasibility Assessment:\n';
  const avgFieldTime = (summary.encryptionTimeStats.mean / config.fieldCount);
  const estimatedTreeTime = avgFieldTime * 100; // Assume 100 fields per typical tree load
  
  output += `  • Avg encryption time per field: ${avgFieldTime.toFixed(4)}ms\n`;
  output += `  • Key derivation (one-time): ${summary.keyDerivationTimeStats.mean.toFixed(2)}ms\n`;
  output += `  • Estimated time for 100 fields: ${(summary.keyDerivationTimeStats.mean + estimatedTreeTime).toFixed(2)}ms\n`;
  output += '\n';
  
  if (estimatedTreeTime < 100) {
    output += `  ✓ HIGHLY FEASIBLE: ~${estimatedTreeTime.toFixed(2)}ms for typical tree load\n`;
    output += `    (Plus ${summary.keyDerivationTimeStats.mean.toFixed(2)}ms one-time key derivation)\n`;
  } else if (estimatedTreeTime < 500) {
    output += `  ⚠ FEASIBLE: ~${estimatedTreeTime.toFixed(2)}ms for typical tree load\n`;
    output += `    (Users may notice slight delay)\n`;
  } else if (estimatedTreeTime < 2000) {
    output += `  ⚠ MARGINALLY FEASIBLE: ~${estimatedTreeTime.toFixed(2)}ms for typical tree load\n`;
    output += `    (Noticeable delay, consider optimization)\n`;
  } else {
    output += `  ✗ NOT RECOMMENDED: ~${estimatedTreeTime.toFixed(2)}ms for typical tree load\n`;
    output += `    (Significant performance impact)\n`;
  }
  
  output += '\n';
  output += '💡 Optimization Notes:\n';
  output += '  • This test uses OPTIMIZED encryption (key derived once, reused)\n';
  output += '  • Key derivation takes ~' + summary.keyDerivationTimeStats.mean.toFixed(0) + 'ms but only happens ONCE per session\n';
  output += '  • Each encryption/decryption is then very fast (<1ms typical)\n';
  output += '  • For production: derive key on login, cache it in memory\n';

  return output;
};

/**
 * Get database field count estimates for context
 */
export const getDatabaseFieldEstimates = () => {
  return {
    nodes: {
      recordCount: '50-200 typical',
      fieldsPerRecord: 15,
      encryptableFields: [
        'name', 'surname', 'maiden_name', 'birth_date', 'death_date',
        'birth_location', 'death_location', 'biography', 'occupation',
        'education', 'nationality', 'email', 'phone', 'address', 'notes'
      ]
    },
    edges: {
      recordCount: '50-300 typical',
      fieldsPerRecord: 2,
      encryptableFields: ['label', 'notes']
    },
    images: {
      recordCount: '0-500 typical',
      fieldsPerRecord: 4,
      encryptableFields: ['title', 'description', 'location', 'date']
    },
    estimatedTotal: '750-3000 fields for typical family tree',
    largeTree: '5000-15000 fields for large/detailed tree'
  };
};
