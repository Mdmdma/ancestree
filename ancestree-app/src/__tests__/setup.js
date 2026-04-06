import { webcrypto } from 'node:crypto';
import '@testing-library/jest-dom';

// Polyfill Web Crypto API for jsdom
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = webcrypto;
} else if (!globalThis.crypto.subtle) {
  Object.defineProperty(globalThis.crypto, 'subtle', {
    value: webcrypto.subtle,
    writable: false,
    configurable: true,
  });
}

// Stub URL.createObjectURL / revokeObjectURL
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn();
}

// Stub canvas context for thumbnailUtils
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8Array(4) })),
  putImageData: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  canvas: { width: 200, height: 200 },
}));

HTMLCanvasElement.prototype.toBlob = vi.fn(function(callback) {
  callback(new Blob(['fake-image'], { type: 'image/jpeg' }));
});

HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,fake');

// Clear storage between tests
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});
