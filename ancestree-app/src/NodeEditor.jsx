import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import PictureSlideshow from './PictureSlideshow';
import AddressAutocomplete from './components/AddressAutocomplete';
import TextInput from './components/TextInput';
import DateInput from './components/DateInput';
import Button from './components/Button';
import { appConfig } from './config';
import { queueGeocoding } from './geocodingService';
import { api } from './api';
import { isFieldIncomplete } from './completionUtils';

function NodeEditor({ node, onUpdate, setSelectedNode, isDebugMode = false, edges = [], socket, completionSettings }) {
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

  // Check if this is a family node
  const isFamilyNode = node?.type === 'family';

  // If it's a family node, show only the delete button
  if (isFamilyNode) {
    return (
      <div>
        <h3 style={{ color: 'white' }}>{appConfig.ui.nodeEditor.title}</h3>
        
        {/* Delete Button for Family Node */}
        <div style={{ marginTop: '20px' }}>
          <Button
            onClick={handleDelete}
            variant="danger"
            size="large"
            className="w-full"
          >
            {appConfig.ui.nodeEditor.buttons.deleteFamily}
          </Button>
        </div>
      </div>
    );
  }

  // For person nodes, show all fields
  return (
    <div>
      <h3 style={{ color: 'white' }}>{appConfig.ui.nodeEditor.title}</h3>
      
      <TextInput
        ref={nameInputRef}
        label={appConfig.ui.nodeEditor.labels.name}
        value={formData.name}
        onChange={(e) => handleInputChange('name', e.target.value)}
        inputRef={nameInputRef}
        error={completionSettings?.showMissingRequired && isFieldIncomplete('name', formData, completionSettings) ? ' ' : ''}
      />

      <TextInput
        label={appConfig.ui.nodeEditor.labels.surname}
        value={formData.surname}
        onChange={(e) => handleInputChange('surname', e.target.value)}
        error={completionSettings?.showMissingRequired && isFieldIncomplete('surname', formData, completionSettings) ? ' ' : ''}
      />

      <TextInput
        label={appConfig.ui.nodeEditor.labels.maidenName}
        value={formData.maidenName}
        onChange={(e) => handleInputChange('maidenName', e.target.value)}
        placeholder={appConfig.ui.nodeEditor.placeholders.maidenName}
        error={completionSettings?.showMissingRequired && isFieldIncomplete('maidenName', formData, completionSettings) ? ' ' : ''}
      />

      <DateInput
        label={appConfig.ui.nodeEditor.labels.birthDate}
        value={formData.birthDate}
        onChange={(e) => handleInputChange('birthDate', e.target.value)}
        error={completionSettings?.showMissingRequired && isFieldIncomplete('birthDate', formData, completionSettings) ? ' ' : ''}
      />

      <DateInput
        label={appConfig.ui.nodeEditor.labels.deathDate}
        value={formData.deathDate}
        onChange={(e) => handleInputChange('deathDate', e.target.value || null)}
        showClearButton={true}
        onClear={() => handleInputChange('deathDate', '')}
      />

      {/* Phone field - conditionally visible */}
      {showPhoneField && (
        <TextInput
          type="tel"
          label={appConfig.ui.nodeEditor.labels.phone}
          value={formData.phone || '+'}
          onChange={(e) => handleInputChange('phone', e.target.value)}
          placeholder={appConfig.ui.nodeEditor.placeholders.phone}
          error={phoneError || (completionSettings?.showMissingRequired && isFieldIncomplete('phone', formData, completionSettings) ? ' ' : '')}
        />
      )}

      {/* Email field - conditionally visible */}
      {showEmailField && (
        <TextInput
          type="email"
          label={appConfig.ui.nodeEditor.labels.email}
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          placeholder={appConfig.ui.nodeEditor.placeholders.email}
          error={emailError || (completionSettings?.showMissingRequired && isFieldIncomplete('email', formData, completionSettings) ? ' ' : '')}
        />
      )}

      {/* Unified Address Autocomplete */}
      <label className="block text-sm font-medium text-gray-300 mb-1">
        {appConfig.ui.nodeEditor.labels.addressAutocomplete}
      </label>
      <AddressAutocomplete
        value={addressAutocompleteValue}
        onSelect={handleAddressSelect}
        placeholder={appConfig.ui.nodeEditor.placeholders.addressAutocomplete}
        inputStyle={{
          width: '100%',
          padding: '8px 12px',
          backgroundColor: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          color: 'black',
          fontSize: '14px',
          height: '34px',
          boxSizing: 'border-box'
        }}
      />

      {/* Individual Address Fields - Read-only display / manual edit fallback */}
      {showStreetFields && (
        <div className="flex gap-2">
          <div style={{ flex: '0 0 65%' }}>
            <TextInput
              label={appConfig.ui.nodeEditor.labels.street}
              value={formData.street}
              onChange={(e) => handleInputChange('street', e.target.value)}
              placeholder={appConfig.ui.nodeEditor.placeholders.street}
              error={completionSettings?.showMissingRequired && isFieldIncomplete('street', formData, completionSettings) ? ' ' : ''}
            />
          </div>
          <div style={{ flex: '0 0 35%' }}>
            <TextInput
              label={appConfig.ui.nodeEditor.labels.housenumber}
              value={formData.housenumber}
              onChange={(e) => handleInputChange('housenumber', e.target.value)}
              placeholder={appConfig.ui.nodeEditor.placeholders.housenumber}
              maxLength={10}
              error={completionSettings?.showMissingRequired && isFieldIncomplete('housenumber', formData, completionSettings) ? ' ' : ''}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <div style={{ flex: '0 0 65%' }}>
          <TextInput
            label={appConfig.ui.nodeEditor.labels.city}
            value={formData.city}
            onChange={(e) => handleInputChange('city', e.target.value)}
            placeholder={appConfig.ui.nodeEditor.placeholders.city}
            error={completionSettings?.showMissingRequired && isFieldIncomplete('city', formData, completionSettings) ? ' ' : ''}
          />
        </div>
        <div style={{ flex: '0 0 35%' }}>
          <TextInput
            label={appConfig.ui.nodeEditor.labels.zip}
            value={formData.zip}
            onChange={(e) => handleInputChange('zip', e.target.value)}
            placeholder={appConfig.ui.nodeEditor.placeholders.zip}
            error={completionSettings?.showMissingRequired && isFieldIncomplete('zip', formData, completionSettings) ? ' ' : ''}
          />
        </div>
      </div>

      <TextInput
        label={appConfig.ui.nodeEditor.labels.country}
        value={formData.country}
        onChange={(e) => handleInputChange('country', e.target.value.toUpperCase())}
        placeholder={appConfig.ui.nodeEditor.placeholders.country}
        maxLength={2}
        error={completionSettings?.showMissingRequired && isFieldIncomplete('country', formData, completionSettings) ? ' ' : ''}
      />

      {isDebugMode && (
        <div style={{ marginTop: '20px', borderTop: '1px solid #444', paddingTop: '15px' }}>
          <h4 style={{ color: '#FFF', margin: '0 0 15px 0', fontSize: '16px' }}>{appConfig.ui.nodeEditor.debug.title}</h4>
          
          <TextInput
            label={appConfig.ui.nodeEditor.debug.nodeId}
            value={node.id}
            readOnly={true}
          />

          <label style={{
            display: 'block',
            marginBottom: '5px',
            fontWeight: 'bold',
            fontSize: '14px',
            color: 'white'
          }}>{appConfig.ui.nodeEditor.debug.bloodlineStatus}</label>
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

          <div className="flex gap-2">
            <div className="flex-1">
              <TextInput
                type="number"
                label={appConfig.ui.nodeEditor.debug.xPosition}
                value={formData.positionX}
                onChange={(e) => handleInputChange('positionX', e.target.value)}
              />
            </div>
            <div className="flex-1">
              <TextInput
                type="number"
                label={appConfig.ui.nodeEditor.debug.yPosition}
                value={formData.positionY}
                onChange={(e) => handleInputChange('positionY', e.target.value)}
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
        <Button
          onClick={() => setShowSlideshow(true)}
          variant="success"
          size="large"
          className="w-full mb-2.5"
        >
          {appConfig.ui.nodeEditor.buttons.pictures}
        </Button>
      </div>

      {/* Delete Button - Always visible */}
      <div style={{ marginTop: '10px' }}>
        <Button
          onClick={handleDelete}
          variant="danger"
          size="large"
          className="w-full"
        >
          {appConfig.ui.nodeEditor.buttons.delete}
        </Button>
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