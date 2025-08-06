import React, { useState, useEffect } from 'react';

function NodeEditor({ node, onUpdate }) {
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
    gender: 'male'
  });

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
        gender: node.data.gender || 'male'
      });
    }
  }, [node]);

  const handleInputChange = (field, value) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    onUpdate(node.id, newData);
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
      <h3 style={{ color: 'white' }}>Daten ergänzen</h3>
      
      <label style={labelStyle}>Name:</label>
      <input
        type="text"
        value={formData.name}
        onChange={(e) => handleInputChange('name', e.target.value)}
        style={inputStyle}
      />

      <label style={labelStyle}>Nachname:</label>
      <input
        type="text"
        value={formData.surname}
        onChange={(e) => handleInputChange('surname', e.target.value)}
        style={inputStyle}
      />

      <label style={labelStyle}>Geburtsdatum:</label>
      <input
        type="date"
        value={formData.birthDate}
        onChange={(e) => handleInputChange('birthDate', e.target.value)}
        style={inputStyle}
      />

      <label style={labelStyle}>Todestag:</label>
      <input
        type="date"
        value={formData.deathDate}
        onChange={(e) => handleInputChange('deathDate', e.target.value || null)}
        style={inputStyle}
      />

      <label style={labelStyle}>Telefon:</label>
      <input
        type="tel"
        value={formData.phone}
        onChange={(e) => handleInputChange('phone', e.target.value)}
        style={inputStyle}
        placeholder="z.B. +43 5287 87123"
      />

      <label style={labelStyle}>Straße:</label>
      <input
        type="text"
        value={formData.street}
        onChange={(e) => handleInputChange('street', e.target.value)}
        style={inputStyle}
        placeholder="z.B. Hauptstraße 123"
      />

      <div style={addressRowStyle}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Stadt:</label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => handleInputChange('city', e.target.value)}
            style={inputStyle}
            placeholder="z.B. Innsbruck"
          />
        </div>
        <div style={{ width: '80px' }}>
          <label style={labelStyle}>PLZ:</label>
          <input
            type="text"
            value={formData.zip}
            onChange={(e) => handleInputChange('zip', e.target.value)}
            style={inputStyle}
            placeholder="6020"
          />
        </div>
      </div>

      <label style={labelStyle}>Land (Code):</label>
      <input
        type="text"
        value={formData.country}
        onChange={(e) => handleInputChange('country', e.target.value.toUpperCase())}
        style={inputStyle}
        placeholder="z.B. AT, DE, CH"
        maxLength="2"
      />

      <label style={labelStyle}>Geschlecht:</label>
      <select
        value={formData.gender}
        onChange={(e) => handleInputChange('gender', e.target.value)}
        style={inputStyle}
      >
        <option value="male">Männlich</option>
        <option value="female">Weiblich</option>
      </select>
    </div>
  );
}

export default NodeEditor;