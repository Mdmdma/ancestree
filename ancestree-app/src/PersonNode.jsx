import React from "react";
import { Position } from "@xyflow/react";
import CustomHandle from "./CustomHandle";

export default function PersonNode({ data }) {
  const { name, surname, birthDate, deathDate, street, city, zip, country, phone, email, latitude, longitude, isSelected, isDebugMode } = data;

  // Format address display
  const formatAddress = () => {
    const parts = [];
    if (street) parts.push(street);
    if (city || zip) {
      const cityZip = [zip, city].filter(Boolean).join(" ");
      if (cityZip) parts.push(cityZip);
    }
    if (country) parts.push(country);
    return parts.join(", ");
  };

  const address = formatAddress();

  // Common handle styles
  const handleStyles = {
    parent: { background: "#ff6b6b", width: "12px", height: "12px" },
    child: { background: "#dd7f13ff", width: "12px", height: "12px" },
    partner: { background: "#45b7d1", width: "12px", height: "12px" }
  };

  // Render handles component
  const HandleComponent = () => (
    <>
      <CustomHandle 
        type="target" 
        position={Position.Top} 
        id="parent"
        style={handleStyles.parent}
      />
      <CustomHandle 
        type="source" 
        position={Position.Bottom} 
        id="child"
        style={handleStyles.child}
      />
      <CustomHandle 
        type="source" 
        position={Position.Left} 
        id="partner-left"
        style={handleStyles.partner}
      />
      <CustomHandle 
        type="target" 
        position={Position.Right} 
        id="partner-right"
        style={handleStyles.partner}
      />
    </>
  );

  // If not selected, show only name
  if (!isSelected) {
    return (
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "8px",
          backgroundColor: "#e2e8f0",
          border: "2px solid #bbbdbf",
          padding: "8px 12px",
          width: "120px",
          height: "40px",
          cursor: "pointer"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
          <div style={{ 
            fontWeight: "bold", 
            fontSize: "1.2rem", 
            color: "#374151",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}>
            {name}
          </div>
        </div>
        <HandleComponent />
      </div>
    );
  }

  // If selected, show full details
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        borderRadius: "8px",
        backgroundColor: "#d4edda",
        border: "3px solid #09380dff",
        padding: "12px",
        gap: "8px",
        width: "200px",
        boxShadow: "0 4px 8px rgba(0,0,0,0.2)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
        <div style={{ flex: "1" }}>
          <div style={{ fontWeight: "bold", fontSize: "1rem", color: "#222" }}>
            {name} {surname}
          </div>
          {birthDate && (
            <div style={{ fontSize: "0.75rem", color: "#333" }}>
              * {birthDate}
            </div>
          )}
          {deathDate && (
            <div style={{ fontSize: "0.75rem", color: "#333" }}>
              † {deathDate}
            </div>
          )}
        </div>
      </div>
      
      {address && (
        <div style={{ width: "100%" }}>
          <div style={{ fontSize: "0.75rem", color: "#444" }}>
            📍 {address}
          </div>
        </div>
      )}
      
      {phone && (
        <div style={{ width: "100%" }}>
          <div style={{ fontSize: "0.75rem", color: "#444" }}>
            📞 {phone}
          </div>
        </div>
      )}
      
      {email && (
        <div style={{ width: "100%" }}>
          <div style={{ fontSize: "0.75rem", color: "#444" }}>
            ✉️ {email}
          </div>
        </div>
      )}
      
      {isDebugMode && (latitude !== null && longitude !== null) && (
        <div style={{ width: "100%" }}>
          <div style={{ fontSize: "0.75rem", color: "#666", fontFamily: "monospace" }}>
            🌍 {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
          </div>
        </div>
      )}
      
      <HandleComponent />
    </div>
  );
}
