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
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to create edge');
    }
    
    return result;
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
  },

  // Image operations
  async uploadImage(file, description = '', uploadedBy = 'anonymous') {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('description', description);
    formData.append('uploaded_by', uploadedBy);

    const response = await fetch(`${API_BASE_URL}/images/upload`, {
      method: 'POST',
      body: formData
    });
    return response.json();
  },

  async loadImages() {
    const response = await fetch(`${API_BASE_URL}/images`);
    return response.json();
  },

  async getImage(id) {
    const response = await fetch(`${API_BASE_URL}/images/${id}`);
    return response.json();
  },

  async updateImageDescription(id, description) {
    const response = await fetch(`${API_BASE_URL}/images/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description })
    });
    return response.json();
  },

  async deleteImage(id) {
    const response = await fetch(`${API_BASE_URL}/images/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  },

  // Image-person associations
  async tagPersonInImage(imageId, personId, positionX = null, positionY = null, width = null, height = null) {
    const response = await fetch(`${API_BASE_URL}/images/${imageId}/people`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        personId, 
        positionX, 
        positionY, 
        width, 
        height 
      })
    });
    return response.json();
  },

  async removePersonFromImage(imageId, personId) {
    const response = await fetch(`${API_BASE_URL}/images/${imageId}/people/${personId}`, {
      method: 'DELETE'
    });
    return response.json();
  },

  async updatePersonPositionInImage(imageId, personId, positionX, positionY, width, height) {
    const response = await fetch(`${API_BASE_URL}/images/${imageId}/people/${personId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        positionX, 
        positionY, 
        width, 
        height 
      })
    });
    return response.json();
  }
};