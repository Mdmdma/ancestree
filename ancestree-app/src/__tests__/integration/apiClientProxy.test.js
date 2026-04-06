import { api, setAuthToken, getAuthToken } from '../../apiClient';

describe('apiClient proxy', () => {
  it('exposes expected methods', () => {
    // Auth methods
    expect(typeof api.login).toBe('function');
    expect(typeof api.register).toBe('function');
    expect(typeof api.verifyToken).toBe('function');
    expect(typeof api.logout).toBe('function');
    expect(typeof api.adminLogin).toBe('function');

    // Node CRUD
    expect(typeof api.loadNodes).toBe('function');
    expect(typeof api.createNode).toBe('function');
    expect(typeof api.updateNode).toBe('function');
    expect(typeof api.deleteNode).toBe('function');

    // Edge CRUD
    expect(typeof api.loadEdges).toBe('function');
    expect(typeof api.createEdge).toBe('function');
    expect(typeof api.deleteEdge).toBe('function');
    expect(typeof api.updateEdge).toBe('function');

    // Image operations
    expect(typeof api.loadImages).toBe('function');
    expect(typeof api.uploadImage).toBe('function');
    expect(typeof api.deleteImage).toBe('function');

    // Settings
    expect(typeof api.getFamilySettings).toBe('function');
    expect(typeof api.getCompletionSettings).toBe('function');
  });

  it('re-exports setAuthToken', () => {
    expect(typeof setAuthToken).toBe('function');
  });

  it('re-exports getAuthToken', () => {
    expect(typeof getAuthToken).toBe('function');
  });

  it('setAuthToken and getAuthToken work together', () => {
    setAuthToken('test-token-123');
    expect(getAuthToken()).toBe('test-token-123');

    // Clean up
    setAuthToken(null);
    expect(getAuthToken()).toBeNull();
  });
});
