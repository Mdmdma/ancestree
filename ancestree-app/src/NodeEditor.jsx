import React, { useState, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import PersonPictureSlideshow from './PersonPictureSlideshow';
import { appConfig } from './config';

function NodeEditor({ node, onUpdate, onDelete, hasConnections, isDebugMode = false, edges = [] }) {
  const { deleteElements } = useReactFlow();
  
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    birthDate: '',
    deathDate: '',
    street: '',
    city: '',
    zip: '',
    country: '',
    phone: '',
    gender: 'male',
    bloodline: false,
    positionX: 0,
    positionY: 0
  });

  const [showSlideshow, setShowSlideshow] = useState(false);

  useEffect(() => {
    if (node) {
      setFormData({
        name: node.data.name || '',
        surname: node.data.surname || '',
        birthDate: node.data.birthDate || '',
        deathDate: node.data.deathDate || '',
        street: node.data.street || '',
        city: node.data.city || '',
        zip: node.data.zip || '',
        country: node.data.country || '',
        phone: node.data.phone || '',
        gender: node.data.gender || 'male',
        bloodline: node.data.bloodline || false,
        preferredImageId: node.data.preferredImageId || null,
        positionX: node.position?.x || 0,
        positionY: node.position?.y || 0
      });
    }
  }, [node]);

  const handleInputChange = (field, value) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    
    if (isDebugMode && (field === 'positionX' || field === 'positionY')) {
      // For debug mode, handle position updates separately
      const newPosition = {
        x: field === 'positionX' ? parseFloat(value) || 0 : formData.positionX,
        y: field === 'positionY' ? parseFloat(value) || 0 : formData.positionY
      };
      const dataWithoutPosition = { ...newData };
      delete dataWithoutPosition.positionX;
      delete dataWithoutPosition.positionY;
      onUpdate(node.id, dataWithoutPosition, newPosition);
    } else {
      // Regular data update (exclude position fields)
      const dataWithoutPosition = { ...newData };
      delete dataWithoutPosition.positionX;
      delete dataWithoutPosition.positionY;
      onUpdate(node.id, dataWithoutPosition);
    }
  };

  const handleDelete = () => {
    if (hasConnections) {
      alert(appConfig.ui.nodeEditor.messages.deleteWithConnections);
      return;
    }
    
    if (window.confirm(`${appConfig.ui.nodeEditor.messages.confirmDeletePrefix}${formData.name} ${formData.surname}${appConfig.ui.nodeEditor.messages.confirmDeleteSuffix}${appConfig.ui.nodeEditor.messages.confirmDelete}`)) {
      // Use React Flow's deleteElements method to trigger the same deletion as Delete key
      deleteElements({ nodes: [{ id: node.id }] });
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '8px',
    marginBottom: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '5px',
    fontWeight: 'bold',
    fontSize: '14px',
    color: 'white'
  };

  const addressRowStyle = {
    display: 'flex',
    gap: '8px'
  };

  return (
    <div>
      <h3 style={{ color: 'white' }}>{appConfig.ui.nodeEditor.title}</h3>
      
      <label style={labelStyle}>{appConfig.ui.nodeEditor.labels.name}</label>
      <input
        type="text"
        value={formData.name}
        onChange={(e) => handleInputChange('name', e.target.value)}
        style={inputStyle}
      />

      <label style={labelStyle}>{appConfig.ui.nodeEditor.labels.surname}</label>
      <input
        type="text"
        value={formData.surname}
        onChange={(e) => handleInputChange('surname', e.target.value)}
        style={inputStyle}
      />

      <label style={labelStyle}>{appConfig.ui.nodeEditor.labels.birthDate}</label>
      <input
        type="date"
        value={formData.birthDate}
        onChange={(e) => handleInputChange('birthDate', e.target.value)}
        style={inputStyle}
      />

      <label style={labelStyle}>{appConfig.ui.nodeEditor.labels.deathDate}</label>
      <input
        type="date"
        value={formData.deathDate}
        onChange={(e) => handleInputChange('deathDate', e.target.value || null)}
        style={inputStyle}
      />

      <label style={labelStyle}>{appConfig.ui.nodeEditor.labels.phone}</label>
      <input
        type="tel"
        value={formData.phone}
        onChange={(e) => handleInputChange('phone', e.target.value)}
        style={inputStyle}
        placeholder={appConfig.ui.nodeEditor.placeholders.phone}
      />

      <label style={labelStyle}>{appConfig.ui.nodeEditor.labels.street}</label>
      <input
        type="text"
        value={formData.street}
        onChange={(e) => handleInputChange('street', e.target.value)}
        style={inputStyle}
        placeholder={appConfig.ui.nodeEditor.placeholders.street}
      />

      <div style={addressRowStyle}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>{appConfig.ui.nodeEditor.labels.city}</label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => handleInputChange('city', e.target.value)}
            style={inputStyle}
            placeholder={appConfig.ui.nodeEditor.placeholders.city}
          />
        </div>
        <div style={{ width: '80px' }}>
          <label style={labelStyle}>{appConfig.ui.nodeEditor.labels.zip}</label>
          <input
            type="text"
            value={formData.zip}
            onChange={(e) => handleInputChange('zip', e.target.value)}
            style={inputStyle}
            placeholder={appConfig.ui.nodeEditor.placeholders.zip}
          />
        </div>
      </div>

      <label style={labelStyle}>{appConfig.ui.nodeEditor.labels.country}</label>
      <input
        type="text"
        value={formData.country}
        onChange={(e) => handleInputChange('country', e.target.value.toUpperCase())}
        style={inputStyle}
        placeholder={appConfig.ui.nodeEditor.placeholders.country}
        maxLength="2"
      />

      <label style={labelStyle}>{appConfig.ui.nodeEditor.labels.gender}</label>
      <select
        value={formData.gender}
        onChange={(e) => handleInputChange('gender', e.target.value)}
        style={inputStyle}
      >
        <option value="male">{appConfig.ui.nodeEditor.genderOptions.male}</option>
        <option value="female">{appConfig.ui.nodeEditor.genderOptions.female}</option>
      </select>

      {isDebugMode && (
        <div style={{ marginTop: '20px', borderTop: '1px solid #444', paddingTop: '15px' }}>
          <h4 style={{ color: '#FFF', margin: '0 0 15px 0', fontSize: '16px' }}>{appConfig.ui.nodeEditor.debug.title}</h4>
          
          <label style={labelStyle}>{appConfig.ui.nodeEditor.debug.nodeId}</label>
          <input
            type="text"
            value={node.id}
            readOnly
            style={{...inputStyle, backgroundColor: '#444', cursor: 'not-allowed'}}
          />

          <label style={labelStyle}>{appConfig.ui.nodeEditor.debug.bloodlineStatus}</label>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <input
              type="checkbox"
              checked={formData.bloodline}
              onChange={(e) => handleInputChange('bloodline', e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            <span style={{ color: 'white' }}>
              {formData.bloodline ? appConfig.ui.nodeEditor.debug.bloodlineOnStatus : appConfig.ui.nodeEditor.debug.bloodlineOffStatus}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{appConfig.ui.nodeEditor.debug.xPosition}</label>
              <input
                type="number"
                step="0.1"
                value={formData.positionX}
                onChange={(e) => handleInputChange('positionX', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{appConfig.ui.nodeEditor.debug.yPosition}</label>
              <input
                type="number"
                step="0.1"
                value={formData.positionY}
                onChange={(e) => handleInputChange('positionY', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Connection Info */}
          <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#333', borderRadius: '5px' }}>
            <h5 style={{ margin: '0 0 10px 0', color: '#FF5722' }}>{appConfig.ui.nodeEditor.debug.connections}</h5>
            {(() => {
              const nodeEdges = edges.filter(edge => edge.source === node.id || edge.target === node.id);
              const connectionsByType = nodeEdges.reduce((acc, edge) => {
                acc[edge.type] = (acc[edge.type] || 0) + 1;
                return acc;
              }, {});
              
              return (
                <div style={{ fontSize: '12px', color: '#ccc' }}>
                  <div>{appConfig.ui.nodeEditor.debug.totalConnections} {nodeEdges.length}</div>
                  {Object.entries(connectionsByType).map(([type, count]) => (
                    <div key={type} style={{ marginLeft: '10px' }}>
                      {type}: {count}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Pictures Button */}
      <div style={{ marginTop: '20px', borderTop: '1px solid #666', paddingTop: '20px' }}>
        <button
          onClick={() => setShowSlideshow(true)}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            fontSize: '16px',
            cursor: 'pointer',
            marginBottom: '10px'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#45a049'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#4CAF50'}
        >
          {appConfig.ui.nodeEditor.buttons.pictures}
        </button>
      </div>

      {!hasConnections && (
        <div style={{ marginTop: '30px', borderTop: '1px solid #666', paddingTop: '20px' }}>
          <button
            onClick={handleDelete}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#c82333'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#dc3545'}
          >
            {appConfig.ui.nodeEditor.buttons.delete}
          </button>
        </div>
      )}

      {showSlideshow && (
        <PersonPictureSlideshow
          personId={node.id}
          personName={`${formData.name} ${formData.surname}`}
          preferredImageId={formData.preferredImageId}
          onPreferredImageChange={(imageId) => {
            setFormData(prev => ({ ...prev, preferredImageId: imageId }));
            onUpdate(node.id, { ...formData, preferredImageId: imageId });
          }}
          onClose={() => setShowSlideshow(false)}
        />
      )}

      
    </div>
  );
}

export default NodeEditor;