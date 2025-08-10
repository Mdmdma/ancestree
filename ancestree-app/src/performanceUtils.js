// Performance utilities for the Ancestree app

// Debounced function creator
export function createDebouncer(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// Throttled function creator
export function createThrottle(func, delay) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return func.apply(this, args);
    }
  };
}

// Async function with requestAnimationFrame for better performance
export function deferToNextFrame(callback) {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      callback();
      resolve();
    });
  });
}

// Batch operation processor
export async function processBatch(items, batchSize, processor, delay = 10) {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  
  for (const batch of batches) {
    await Promise.all(batch.map(processor));
    if (delay > 0 && batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Memoization utility for expensive calculations
export function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}
