import React from "react";
import { Handle, Position } from "@xyflow/react";
import CustomHandle from "./CustomHandle";

export default function PersonNode({ data }) {
  const { name, surname, birthDate, deathDate, street, city, zip, country, gender, isSelected } = data;

  // Format address display
  const formatAddress = () => {
    const parts = [];
    if (street) parts.push(street);
    if (city || zip) {
      const cityZip = [zip, city].filter(Boolean).join(' ');
      if (cityZip) parts.push(cityZip);
    }
    if (country) parts.push(country);
    return parts.join(', ');
  };

  const address = formatAddress();

  // If not selected, show only name
  if (!isSelected) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
          backgroundColor: '#e2e8f0',
          border: '2px solid #bbbdbf',
          padding: '8px 12px',
          minWidth: '120px',
          cursor: 'pointer'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.5rem' }}>{gender === "male" ? "👨" : "👩"}</span>
          <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
            {name} {surname}
          </div>
        </div>
        <CustomHandle type="source" position={Position.Right} />
        <CustomHandle type="target" position={Position.Left} />
      </div>
    );
  }

  // If selected, show full details
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        borderRadius: '8px',
        backgroundColor: '#d4edda', // Slightly different color when selected
        border: '3px solid #28a745', // Green border when selected
        padding: '12px',
        gap: '8px',
        width: '200px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.2)' // Add shadow when selected
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
        <div>
          <span style={{ fontSize: '2rem' }}>{gender === "male" ? "👨" : "👩"}</span>
        </div>
        <div style={{ flex: '1' }}>
          <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>
            {name} {surname}
          </div>
          {birthDate && (
            <div style={{ fontSize: '0.75rem', color: '#666' }}>
              * {birthDate}
            </div>
          )}
          {deathDate && (
            <div style={{ fontSize: '0.75rem', color: '#666' }}>
              † {deathDate}
            </div>
          )}
        </div>
      </div>
      
      {address && (
        <div style={{ width: '100%' }}>
          <div style={{ fontSize: '0.75rem', color: '#888' }}>
            📍 {address}
          </div>
        </div>
      )}
      
      <CustomHandle type="source" position={Position.Right} />
      <CustomHandle type="target" position={Position.Left} />
    </div>
  );
}