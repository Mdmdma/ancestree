import React from "react";
import { Position } from "@xyflow/react";
import CustomHandle from "./CustomHandle";
import { checkNodeCompletion } from "./completionUtils";
import { formatDisplayDate } from "./dateUtils";
import { getDisplayValue, isSkipMarker } from "./skipMarkerUtils";

export default function PersonNode({ data, selected }) {
  const { name, surname, birthDate, deathDate, street, city, zip, country, phone, email, latitude, longitude, isDebugMode, completionSettings } = data;

  // Check if node is complete
  const { isComplete } = checkNodeCompletion(data, completionSettings);
  const showIncompleteWarning = completionSettings?.showMissingRequired && !isComplete;
  const showCompleteIndicator = completionSettings?.showMissingRequired && isComplete;

  // Get display values (filters out skip markers)
  const displayName = getDisplayValue(name);
  const displaySurname = getDisplayValue(surname);
  const displayBirthDate = getDisplayValue(birthDate);
  const displayDeathDate = getDisplayValue(deathDate);
  const displayPhone = getDisplayValue(phone, 'phone');
  const displayEmail = getDisplayValue(email);

  // Format address display (filtering out skip markers)
  const formatAddress = () => {
    const parts = [];
    const displayStreet = getDisplayValue(street);
    const displayCity = getDisplayValue(city);
    const displayZip = getDisplayValue(zip);
    const displayCountry = getDisplayValue(country);
    
    if (displayStreet) parts.push(displayStreet);
    if (displayCity || displayZip) {
      const cityZip = [displayZip, displayCity].filter(Boolean).join(" ");
      if (cityZip) parts.push(cityZip);
    }
    if (displayCountry) parts.push(displayCountry);
    return parts.join(", ");
  };

  const address = formatAddress();

  // Render handles component
  const HandleComponent = () => (
    <>
      <CustomHandle 
        type="target" 
        position={Position.Top} 
        id="parent"
      />
      <CustomHandle 
        type="source" 
        position={Position.Bottom} 
        id="child"
      />
      <CustomHandle 
        type="source" 
        position={Position.Left} 
        id="partner-left"
      />
      <CustomHandle 
        type="target" 
        position={Position.Right} 
        id="partner-right"
      />
    </>
  );

  // If not selected, show only name (use React Flow's selected prop)
  if (!selected) {
    return (
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "8px",
          backgroundColor: "var(--node-person-bg)",
          border: showIncompleteWarning 
            ? "2px solid #ef4444" 
            : showCompleteIndicator 
              ? "2px solid #22c55e" 
              : "2px solid #bbbdbf",
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
            color: "var(--node-person-border)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}>
            {displayName}
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
        backgroundColor: "var(--node-person-bg-selected)",
        border: showIncompleteWarning 
          ? "3px solid #ef4444" 
          : showCompleteIndicator 
            ? "3px solid #22c55e" 
            : "3px solid #09380dff",
        padding: "12px",
        gap: "8px",
        width: "200px",
        boxShadow: "0 4px 8px rgba(0,0,0,0.2)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
        <div style={{ flex: "1" }}>
          <div style={{ fontWeight: "bold", fontSize: "1rem", color: "var(--node-person-text-primary)" }}>
            {displayName} {displaySurname}
          </div>
          {displayBirthDate && (
            <div style={{ fontSize: "0.75rem", color: "var(--node-person-text-secondary)" }}>
              * {formatDisplayDate(displayBirthDate)}
            </div>
          )}
          {displayDeathDate && (
            <div style={{ fontSize: "0.75rem", color: "var(--node-person-text-secondary)" }}>
              † {formatDisplayDate(displayDeathDate)}
            </div>
          )}
        </div>
      </div>
      
      {address && (
        <div style={{ width: "100%" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--node-person-text-tertiary)" }}>
            📍 {address}
          </div>
        </div>
      )}
      
      {displayPhone && (
        <div style={{ width: "100%" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--node-person-text-tertiary)" }}>
            📞 {displayPhone}
          </div>
        </div>
      )}
      
      {displayEmail && (
        <div style={{ width: "100%" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--node-person-text-tertiary)" }}>
            ✉️ {displayEmail}
          </div>
        </div>
      )}
      
      {isDebugMode && (latitude !== null && longitude !== null) && (
        <div style={{ width: "100%" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--node-person-text-debug)", fontFamily: "monospace" }}>
            🌍 {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
          </div>
        </div>
      )}
      
      <HandleComponent />
    </div>
  );
}
