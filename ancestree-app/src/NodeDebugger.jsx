import React, { useState, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';

export default function NodeDebugger({ nodes, edges, onUpdateNode }) {
  const { deleteElements } = useReactFlow();
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [editingNode, setEditingNode] = useState(null);
  const [formData, setFormData] = useState({});

  // Reset when selectedNodeId changes
  useEffect(() => {
    if (selectedNodeId) {
      const node = nodes.find(n => n.id === selectedNodeId);
      if (node) {
        setEditingNode(node);
        setFormData({
          id: node.id,
          name: node.data.name || '',
          surname: node.data.surname || '',
          birthDate: node.data.birthDate || '',
          deathDate: node.data.deathDate || '',
          street: node.data.street || '',
          city: node.data.city || '',
          zip: node.data.zip || '',
          country: node.data.country || '',
          phone: node.data.phone || '',
          bloodline: node.data.bloodline || false,
        });
      }
    } else {
      setEditingNode(null);
      setFormData({});
    }
  }, [selectedNodeId, nodes]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!editingNode) return;

    const updatedData = {
      name: formData.name,
      surname: formData.surname,
      birthDate: formData.birthDate,
      deathDate: formData.deathDate,
      street: formData.street,
      city: formData.city,
      zip: formData.zip,
      country: formData.country,
      phone: formData.phone,
      bloodline: formData.bloodline,
      isSelected: editingNode.data.isSelected
    };

    const updatedPosition = {
      x: parseFloat(formData.positionX) || 0,
      y: parseFloat(formData.positionY) || 0
    };

    try {
      await onUpdateNode(editingNode.id, updatedData, updatedPosition);
      // Update the editing node to reflect changes
      setEditingNode(prev => ({
        ...prev,
        data: updatedData,
        position: updatedPosition
      }));
    } catch (error) {
      console.error('Failed to update node:', error);
      alert('Failed to update node: ' + error.message);
    }
  };

  const handleDelete = async () => {
    if (!editingNode) return;
    
    if (window.confirm(`Are you sure you want to delete node "${formData.name} ${formData.surname}"?`)) {
      try {
        // Use React Flow's deleteElements method to trigger the same deletion as Delete key
        deleteElements({ nodes: [{ id: editingNode.id }] });
        setSelectedNodeId('');
      } catch (error) {
        console.error('Failed to delete node:', error);
        alert('Failed to delete node: ' + error.message);
      }
    }
  };

  // Get node connections info
  const getNodeConnections = (nodeId) => {
    const nodeEdges = edges.filter(edge => edge.source === nodeId || edge.target === nodeId);
    return {
      total: nodeEdges.length,
      byType: nodeEdges.reduce((acc, edge) => {
        acc[edge.type] = (acc[edge.type] || 0) + 1;
        return acc;
      }, {}),
      edges: nodeEdges
    };
  };

  const inputStyle = {
    width: '100%',
    padding: '6px',
    margin: '2px 0',
    borderRadius: '3px',
    border: '1px solid #555',
    backgroundColor: '#2a2a2a',
    color: 'white',
    fontSize: '0.8rem'
  };

  const labelStyle = {
    display: 'block',
    color: '#ccc',
    fontSize: '0.75rem',
    marginBottom: '2px',
    marginTop: '8px'
  };

  const buttonStyle = {
    padding: '8px 12px',
    margin: '5px 2px',
    borderRadius: '3px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 'bold'
  };

  return (
    <div style={{
      backgroundColor: '#1e1e1e',
      padding: '15px',
      borderRadius: '5px',
      marginBottom: '20px',
      fontSize: '0.8rem',
      maxHeight: '600px',
      overflowY: 'auto',
      border: '1px solid #444'
    }}>
      <h4 style={{ margin: '0 0 15px 0', color: '#FFF' }}>🔧 Node Debugger</h4>
      
      {/* Node Selection */}
      <div style={{ marginBottom: '15px' }}>
        <label style={labelStyle}>Select Node to Edit:</label>
        <select
          value={selectedNodeId}
          onChange={(e) => setSelectedNodeId(e.target.value)}
          style={{
            ...inputStyle,
            cursor: 'pointer'
          }}
        >
          <option value="">-- Choose a node --</option>
          {nodes.map(node => (
            <option key={node.id} value={node.id}>
              {node.id}: {node.data.name || 'Unnamed'} {node.data.surname || ''} ({node.data.bloodline ? 'Bloodline' : 'Partner'})
            </option>
          ))}
        </select>
      </div>

      {editingNode && (
        <div>
          {/* Basic Info */}
          <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#333', borderRadius: '5px' }}>
            <h5 style={{ margin: '0 0 10px 0', color: '#4CAF50' }}>Basic Information</h5>
            
            <label style={labelStyle}>ID (Read-only):</label>
            <input
              type="text"
              value={formData.id}
              readOnly
              style={{...inputStyle, backgroundColor: '#444', cursor: 'not-allowed'}}
            />

            <label style={labelStyle}>First Name:</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              style={inputStyle}
            />

            <label style={labelStyle}>Last Name:</label>
            <input
              type="text"
              value={formData.surname}
              onChange={(e) => handleInputChange('surname', e.target.value)}
              style={inputStyle}
            />

            <label style={labelStyle}>Bloodline:</label>
            <input
              type="checkbox"
              checked={formData.bloodline}
              onChange={(e) => handleInputChange('bloodline', e.target.checked)}
              style={{ margin: '5px 0' }}
            />
            <span style={{ color: '#ccc', marginLeft: '8px' }}>
              {formData.bloodline ? 'On bloodline' : 'Partner only'}
            </span>
          </div>

          {/* Dates */}
          <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#333', borderRadius: '5px' }}>
            <h5 style={{ margin: '0 0 10px 0', color: '#2196F3' }}>Dates</h5>
            
            <label style={labelStyle}>Birth Date:</label>
            <input
              type="date"
              value={formData.birthDate}
              onChange={(e) => handleInputChange('birthDate', e.target.value)}
              style={inputStyle}
            />

            <label style={labelStyle}>Death Date:</label>
            <input
              type="date"
              value={formData.deathDate}
              onChange={(e) => handleInputChange('deathDate', e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Address */}
          <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#333', borderRadius: '5px' }}>
            <h5 style={{ margin: '0 0 10px 0', color: '#FF9800' }}>Address</h5>
            
            <label style={labelStyle}>Street:</label>
            <input
              type="text"
              value={formData.street}
              onChange={(e) => handleInputChange('street', e.target.value)}
              style={inputStyle}
            />

            <label style={labelStyle}>City:</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              style={inputStyle}
            />

            <label style={labelStyle}>ZIP Code:</label>
            <input
              type="text"
              value={formData.zip}
              onChange={(e) => handleInputChange('zip', e.target.value)}
              style={inputStyle}
            />

            <label style={labelStyle}>Country:</label>
            <input
              type="text"
              value={formData.country}
              onChange={(e) => handleInputChange('country', e.target.value)}
              style={inputStyle}
            />

            <label style={labelStyle}>Phone:</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Position */}
          <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#333', borderRadius: '5px' }}>
            <h5 style={{ margin: '0 0 10px 0', color: '#9C27B0' }}>Position</h5>
            
            <label style={labelStyle}>X Position:</label>
            <input
              type="number"
              step="0.1"
              value={formData.positionX}
              onChange={(e) => handleInputChange('positionX', e.target.value)}
              style={inputStyle}
            />

            <label style={labelStyle}>Y Position:</label>
            <input
              type="number"
              step="0.1"
              value={formData.positionY}
              onChange={(e) => handleInputChange('positionY', e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Connections Info */}
          <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#333', borderRadius: '5px' }}>
            <h5 style={{ margin: '0 0 10px 0', color: '#FF5722' }}>Connections</h5>
            {(() => {
              const connections = getNodeConnections(editingNode.id);
              return (
                <div>
                  <div>Total Edges: {connections.total}</div>
                  {Object.entries(connections.byType).map(([type, count]) => (
                    <div key={type} style={{ marginLeft: '10px' }}>
                      {type}: {count}
                    </div>
                  ))}
                  {connections.edges.length > 0 && (
                    <details style={{ marginTop: '8px' }}>
                      <summary style={{ cursor: 'pointer', color: '#ccc' }}>Show Edge Details</summary>
                      {connections.edges.map(edge => (
                        <div key={edge.id} style={{ 
                          marginLeft: '15px', 
                          fontSize: '0.7rem', 
                          padding: '2px',
                          backgroundColor: '#2a2a2a',
                          margin: '2px 0',
                          borderRadius: '2px'
                        }}>
                          {edge.id}: {edge.source} → {edge.target} ({edge.type})
                        </div>
                      ))}
                    </details>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px' }}>
            <button
              onClick={handleSave}
              style={{
                ...buttonStyle,
                backgroundColor: '#4CAF50',
                color: 'white',
                flex: 1,
                marginRight: '5px'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#45a049'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#4CAF50'}
            >
              💾 Save Changes
            </button>
            
            <button
              onClick={handleDelete}
              style={{
                ...buttonStyle,
                backgroundColor: '#f44336',
                color: 'white',
                flex: 1,
                marginLeft: '5px'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#da190b'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#f44336'}
            >
              🗑️ Delete Node
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
