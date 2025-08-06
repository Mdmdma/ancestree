const API_BASE_URL = 'http://localhost:3001/api';

export const api = {
  // Load initial data
  async loadNodes() {
    const response = await fetch(`${API_BASE_URL}/nodes`);
    return response.json();
  },

  async loadEdges() {
    const response = await fetch(`${API_BASE_URL}/edges`);
    return response.json();
  },

  // Node operations
  async createNode(node) {
    const response = await fetch(`${API_BASE_URL}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(node)
    });
    return response.json();
  },

  async updateNode(id, updates) {
    const response = await fetch(`${API_BASE_URL}/nodes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return response.json();
  },

  async deleteNode(id) {
    const response = await fetch(`${API_BASE_URL}/nodes/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  },

  // Edge operations
  async createEdge(edge) {
    const response = await fetch(`${API_BASE_URL}/edges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edge)
    });
    return response.json();
  },

  async deleteEdge(id) {
    const response = await fetch(`${API_BASE_URL}/edges/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  },

  // Database operations
  async resetDatabase() {
    const response = await fetch(`${API_BASE_URL}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
  },

  async cleanupDatabase() {
    const response = await fetch(`${API_BASE_URL}/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
  }
};