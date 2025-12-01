import React, { useState, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import TextInput from './components/TextInput';
import DateInput from './components/DateInput';
import Button from './components/Button';
import { appConfig } from './config';

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
          maidenName: node.data.maidenName || '',
          birthDate: node.data.birthDate || '',
          deathDate: node.data.deathDate || '',
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
      maidenName: formData.maidenName,
      birthDate: formData.birthDate,
      deathDate: formData.deathDate,
      city: formData.city,
      zip: formData.zip,
      country: formData.country,
      phone: formData.phone,
      bloodline: formData.bloodline
      // isSelected removed - managed by App.jsx and React Flow (Strategy 3)
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
    
    // Check if this is the last bloodline node
    if (editingNode.type === 'person' && editingNode.data.bloodline) {
      const bloodlineNodes = nodes.filter(n => 
        n.type === 'person' && n.data.bloodline === true
      );
      
      if (bloodlineNodes.length <= 1) {
        alert(`${appConfig.ui.alerts.lastBloodlineNodeDelete.title}\n\n${appConfig.ui.alerts.lastBloodlineNodeDelete.message}`);
        return; // Prevent deletion
      }
    }
    
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

  return (
    <div style={{
      backgroundColor: 'var(--debug-panel-bg)',
      padding: '15px',
      borderRadius: '5px',
      marginBottom: '20px',
      fontSize: '0.8rem',
      maxHeight: '600px',
      overflowY: 'auto',
      border: '1px solid #444'
    }}>
      <h4 style={{ margin: '0 0 15px 0', color: 'var(--debug-text)' }}>🔧 Node Debugger</h4>
      
      {/* Node Selection */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{
          display: 'block',
          color: 'var(--debug-text-muted)',
          fontSize: '0.75rem',
          marginBottom: '2px',
          marginTop: '8px'
        }}>Select Node to Edit:</label>
        <select
          value={selectedNodeId}
          onChange={(e) => setSelectedNodeId(e.target.value)}
          style={{
            width: '100%',
            padding: '6px',
            margin: '2px 0',
            borderRadius: '3px',
            border: '1px solid #555',
            backgroundColor: 'var(--debug-bg)',
            color: 'white',
            fontSize: '0.8rem',
            height: '30px',
            boxSizing: 'border-box',
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
          <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: 'var(--debug-section-bg)', borderRadius: '5px' }}>
            <h5 style={{ margin: '0 0 10px 0', color: 'var(--debug-section-basic)' }}>Basic Information</h5>
            
            <TextInput
              label="ID (Read-only):"
              value={formData.id}
              readOnly={true}
              className="text-white"
            />

            <TextInput
              label="First Name:"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="text-white"
            />

            <TextInput
              label="Last Name:"
              value={formData.surname}
              onChange={(e) => handleInputChange('surname', e.target.value)}
              className="text-white"
            />

            <TextInput
              label="Maiden Name:"
              value={formData.maidenName}
              onChange={(e) => handleInputChange('maidenName', e.target.value)}
              className="text-white"
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
          <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: 'var(--debug-section-bg)', borderRadius: '5px' }}>
            <h5 style={{ margin: '0 0 10px 0', color: 'var(--debug-section-dates)' }}>Dates</h5>
            
            <DateInput
              label="Birth Date:"
              value={formData.birthDate}
              onChange={(e) => handleInputChange('birthDate', e.target.value)}
              className="text-white"
            />

            <DateInput
              label="Death Date:"
              value={formData.deathDate}
              onChange={(e) => handleInputChange('deathDate', e.target.value)}
              showClearButton={true}
              onClear={() => handleInputChange('deathDate', '')}
              className="text-white"
            />
          </div>

          {/* Address */}
          <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: 'var(--debug-section-bg)', borderRadius: '5px' }}>
            <h5 style={{ margin: '0 0 10px 0', color: 'var(--debug-section-address)' }}>Address</h5>
            
            <TextInput
              label="Street:"
              value={formData.street}
              onChange={(e) => handleInputChange('street', e.target.value)}
              className="text-white"
            />

            <TextInput
              label="City:"
              value={formData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              className="text-white"
            />

            <TextInput
              label="ZIP Code:"
              value={formData.zip}
              onChange={(e) => handleInputChange('zip', e.target.value)}
              className="text-white"
            />

            <TextInput
              label="Country:"
              value={formData.country}
              onChange={(e) => handleInputChange('country', e.target.value)}
              className="text-white"
            />

            <TextInput
              label="Phone:"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="text-white"
            />
          </div>

          {/* Position */}
          <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: 'var(--debug-section-bg)', borderRadius: '5px' }}>
            <h5 style={{ margin: '0 0 10px 0', color: 'var(--debug-section-position)' }}>Position</h5>
            
            <TextInput
              label="X Position:"
              type="number"
              step="0.1"
              value={formData.positionX}
              onChange={(e) => handleInputChange('positionX', e.target.value)}
              className="text-white"
            />

            <TextInput
              label="Y Position:"
              type="number"
              step="0.1"
              value={formData.positionY}
              onChange={(e) => handleInputChange('positionY', e.target.value)}
              className="text-white"
            />
          </div>

          {/* Connections */}
          <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: 'var(--debug-section-bg)', borderRadius: '5px' }}>
            <h5 style={{ margin: '0 0 10px 0', color: 'var(--debug-section-connections)' }}>Connections</h5>
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
            <Button
              onClick={handleSave}
              variant="primary"
              size="medium"
              icon="💾"
              className="flex-1 mr-1.5"
            >
              Save Changes
            </Button>
            
            <Button
              onClick={handleDelete}
              variant="danger"
              size="medium"
              icon="🗑️"
              className="flex-1 ml-1.5"
            >
              Delete Node
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
