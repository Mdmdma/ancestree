import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import PictureSlideshow from './PictureSlideshow';
import AddressAutocomplete from './components/AddressAutocomplete';
import { appConfig } from './config';
import { queueGeocoding } from './geocodingService';
import { api } from './api';

function NodeEditor({ node, onUpdate, setSelectedNode, isDebugMode = false, edges = [], socket }) {
  const { deleteElements } = useReactFlow();
  
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    maidenName: '',
    birthDate: '',
    deathDate: '',
    street: '',
    housenumber: '',
    city: '',
    zip: '',
    country: '',
    phone: '',
    email: '',
    bloodline: false,
    positionX: 0,
    positionY: 0
  });

  const [showSlideshow, setShowSlideshow] = useState(false);
  const [showStreetFields, setShowStreetFields] = useState(true);
  const [showPhoneField, setShowPhoneField] = useState(true);
  const [showEmailField, setShowEmailField] = useState(true);
  const [addressAutocompleteValue, setAddressAutocompleteValue] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const updateTimeoutRef = useRef(null);
  const nameInputRef = useRef(null);
  const previousNodeIdRef = useRef(null);

  // Debounced update function
  const debouncedUpdate = useCallback((nodeId, data, position) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      if (position) {
        onUpdate(nodeId, data, position);
      } else {
        onUpdate(nodeId, data);
      }
      
      // After update, check if we need to geocode
      // This happens when any address field changes
      const addressFields = ['street', 'housenumber', 'city', 'zip', 'country'];
      const addressChanged = addressFields.some(field => field in data);
      
      if (addressChanged && node) {
        console.log('[NodeEditor] Address field changed, queuing geocoding for node:', nodeId);
        // Queue geocoding with updated data
        const updatedNode = {
          ...node,
          data: { ...node.data, ...data }
        };
        queueGeocoding(updatedNode);
      }
    }, 2000); // 2000ms debounce
  }, [onUpdate, node]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Fetch visibility settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await api.getFamilySettings();
        setShowStreetFields(settings.showStreetFields !== undefined ? Boolean(settings.showStreetFields) : true);
        setShowPhoneField(settings.showPhoneField !== undefined ? Boolean(settings.showPhoneField) : true);
        setShowEmailField(settings.showEmailField !== undefined ? Boolean(settings.showEmailField) : true);
      } catch (err) {
        // If fetch fails, default to showing fields
        console.error('Failed to fetch field visibility settings:', err);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    // Apply any pending updates from the previous node before switching
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }

    if (node) {
      // Check if this is a newly selected node (different from previous)
      const isNewlySelected = node.id !== previousNodeIdRef.current;
      
      // Ensure phone number has + prefix if it has content
      let phoneValue = node.data.phone || '';
      if (phoneValue && !phoneValue.startsWith('+')) {
        phoneValue = '+' + phoneValue;
      }
      
      setFormData({
        name: node.data.name || '',
        surname: node.data.surname || '',
        maidenName: node.data.maidenName || '',
        birthDate: node.data.birthDate || '',
        deathDate: node.data.deathDate || '',
        street: node.data.street || '',
        housenumber: node.data.housenumber || '',
        city: node.data.city || '',
        zip: node.data.zip || '',
        country: node.data.country || '',
        phone: phoneValue,
        email: node.data.email || '',
        bloodline: node.data.bloodline || false,
        preferredImageId: node.data.preferredImageId || null,
        positionX: node.position?.x || 0,
        positionY: node.position?.y || 0
      });
      
      // Clear validation errors when switching nodes
      setEmailError('');
      setPhoneError('');
      
      // Keep autocomplete field empty - it's only for searching
      setAddressAutocompleteValue('');
      
      // Only focus and select text when a new node is selected
      if (isNewlySelected) {
        setTimeout(() => {
          if (nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select(); // Also select the text for easy editing
          }
        }, 100); // Small delay to ensure the component is rendered
      }
      
      // Update the previous node ID reference
      previousNodeIdRef.current = node.id;
    } else {
      // Clear the previous node ID when no node is selected
      previousNodeIdRef.current = null;
    }
  }, [node]);

  const handleInputChange = (field, value) => {
    let isValid = true;
    
    // Special handling for phone field - enforce + prefix and only numbers
    if (field === 'phone') {
      // Always ensure the + is at the start
      if (!value.startsWith('+')) {
        value = '+' + value.replace(/\+/g, ''); // Add + at start and remove any other +
      }
      // Remove any non-digit characters except the leading +
      value = '+' + value.substring(1).replace(/\D/g, '');
      
      // Validate phone format (+ followed by digits)
      if (value.length > 1 && !/^\+\d*$/.test(value)) {
        setPhoneError('Telefonnummer muss mit + beginnen und nur Zahlen enthalten');
        isValid = false;
      } else {
        setPhoneError('');
      }
    }
    
    // Email validation
    if (field === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (value && !emailRegex.test(value)) {
        setEmailError('Bitte gib eine gültige E-Mail-Adresse ein');
        isValid = false;
      } else {
        setEmailError('');
      }
    }
    
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    
    // Only save if validation passes
    if (!isValid) {
      return; // Don't save invalid data
    }
    
    if (isDebugMode && (field === 'positionX' || field === 'positionY')) {
      // For debug mode, handle position updates separately
      const newPosition = {
        x: field === 'positionX' ? parseFloat(value) || 0 : formData.positionX,
        y: field === 'positionY' ? parseFloat(value) || 0 : formData.positionY
      };
      const dataWithoutPosition = { ...newData };
      delete dataWithoutPosition.positionX;
      delete dataWithoutPosition.positionY;
      debouncedUpdate(node.id, dataWithoutPosition, newPosition);
    } else {
      // Regular data update (exclude position fields)
      const dataWithoutPosition = { ...newData };
      delete dataWithoutPosition.positionX;
      delete dataWithoutPosition.positionY;
      debouncedUpdate(node.id, dataWithoutPosition);
    }
  };

  // Handle address autocomplete selection
  const handleAddressSelect = (addressData) => {
    console.log('[NodeEditor] Address selected from autocomplete:', addressData);
    
    // Update form data with all address components
    const newData = {
      ...formData,
      street: addressData.street || '',
      housenumber: addressData.housenumber || '',
      city: addressData.city || '',
      zip: addressData.zip || '',
      country: addressData.country || ''
    };
    
    setFormData(newData);
    // Keep autocomplete field empty after selection
    setAddressAutocompleteValue('');
    
    // Save to database (exclude position fields)
    const dataToSave = { ...newData };
    delete dataToSave.positionX;
    delete dataToSave.positionY;
    
    // Immediate update (no debounce) since user explicitly selected
    onUpdate(node.id, dataToSave);
    
    // Queue geocoding after database save
    const updatedNode = {
      ...node,
      data: { ...node.data, ...dataToSave }
    };
    queueGeocoding(updatedNode);
  };

  const handleDelete = () => {
    // Use React Flow's deleteElements method to trigger the same deletion as Delete key
    // This will handle all the same logic as the keyboard delete key
    deleteElements({ nodes: [{ id: node.id }] });
    
    // Close the node editor by clearing the selection
    if (setSelectedNode) {
      setSelectedNode(null);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '8px',
    marginBottom: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
    height: '34px',
    boxSizing: 'border-box'
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

  // Check if this is a family node
  const isFamilyNode = node?.type === 'family';

  // If it's a family node, show only the delete button
  if (isFamilyNode) {
    return (
      <div>
        <h3 style={{ color: 'white' }}>{appConfig.ui.nodeEditor.title}</h3>
        
        {/* Delete Button for Family Node */}
        <div style={{ marginTop: '20px' }}>
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
            {appConfig.ui.nodeEditor.buttons.deleteFamily}
          </button>
        </div>
      </div>
    );
  }

  // For person nodes, show all fields
  return (
    <div>
      <h3 style={{ color: 'white' }}>{appConfig.ui.nodeEditor.title}</h3>
      
      <label style={labelStyle}>{appConfig.ui.nodeEditor.labels.name}</label>
      <input
        ref={nameInputRef}
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

      <label style={labelStyle}>{appConfig.ui.nodeEditor.labels.maidenName}</label>
      <input
        type="text"
        value={formData.maidenName}
        onChange={(e) => handleInputChange('maidenName', e.target.value)}
        style={inputStyle}
        placeholder={appConfig.ui.nodeEditor.placeholders.maidenName}
      />

      <label style={labelStyle}>{appConfig.ui.nodeEditor.labels.birthDate}</label>
      <input
        type="date"
        value={formData.birthDate}
        onChange={(e) => handleInputChange('birthDate', e.target.value)}
        style={inputStyle}
      />

      <label style={labelStyle}>{appConfig.ui.nodeEditor.labels.deathDate}</label>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <input
          type="date"
          value={formData.deathDate}
          onChange={(e) => handleInputChange('deathDate', e.target.value || null)}
          style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
        />
        {formData.deathDate && (
          <button
            onClick={() => handleInputChange('deathDate', '')}
            style={{
              padding: '8px 10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: '#f44336',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              marginBottom: 0,
              height: '34px',
              minWidth: '34px'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#da190b'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#f44336'}
            title="Clear death date"
          >
            ✕
          </button>
        )}
      </div>

      {/* Phone field - conditionally visible */}
      {showPhoneField && (
        <>
          <label style={labelStyle}>{appConfig.ui.nodeEditor.labels.phone}</label>
          <input
            type="tel"
            value={formData.phone || '+'}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            style={{
              ...inputStyle,
              border: phoneError ? '2px solid #e74c3c' : inputStyle.border
            }}
            placeholder={appConfig.ui.nodeEditor.placeholders.phone}
          />
          {phoneError && (
            <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '4px', marginBottom: '8px' }}>
              {phoneError}
            </div>
          )}
        </>
      )}

      {/* Email field - conditionally visible */}
      {showEmailField && (
        <>
          <label style={labelStyle}>{appConfig.ui.nodeEditor.labels.email}</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            style={{
              ...inputStyle,
              border: emailError ? '2px solid #e74c3c' : inputStyle.border
            }}
            placeholder={appConfig.ui.nodeEditor.placeholders.email}
          />
          {emailError && (
            <div style={{ color: '#e74c3c', fontSize: '12px', marginTop: '4px', marginBottom: '8px' }}>
              {emailError}
            </div>
          )}
        </>
      )}

      {/* Unified Address Autocomplete */}
      <label style={labelStyle}>{appConfig.ui.nodeEditor.labels.addressAutocomplete}</label>
      <AddressAutocomplete
        value={addressAutocompleteValue}
        onSelect={handleAddressSelect}
        placeholder={appConfig.ui.nodeEditor.placeholders.addressAutocomplete}
        inputStyle={inputStyle}
      />

      {/* Individual Address Fields - Read-only display / manual edit fallback */}
      {showStreetFields && (
        <div style={addressRowStyle}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{appConfig.ui.nodeEditor.labels.street}</label>
            <input
              type="text"
              value={formData.street}
              onChange={(e) => handleInputChange('street', e.target.value)}
              style={inputStyle}
              placeholder={appConfig.ui.nodeEditor.placeholders.street}
            />
          </div>
          <div style={{ width: '80px' }}>
            <label style={labelStyle}>{appConfig.ui.nodeEditor.labels.housenumber}</label>
            <input
              type="text"
              value={formData.housenumber}
              onChange={(e) => handleInputChange('housenumber', e.target.value)}
              style={inputStyle}
              placeholder={appConfig.ui.nodeEditor.placeholders.housenumber}
              maxLength={10}
            />
          </div>
        </div>
      )}

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

      {/* Delete Button - Always visible */}
      <div style={{ marginTop: '10px' }}>
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

      {showSlideshow && (
        <PictureSlideshow
          mode="person"
          personId={node.id}
          personName={`${formData.name} ${formData.surname}`}
          preferredImageId={formData.preferredImageId}
          onPreferredImageChange={(imageId) => {
            setFormData(prev => ({ ...prev, preferredImageId: imageId }));
            onUpdate(node.id, { ...formData, preferredImageId: imageId });
          }}
          onClose={() => setShowSlideshow(false)}
          socket={socket}
        />
      )}

      
    </div>
  );
}

export default NodeEditor;