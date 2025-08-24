import React from "react";
import { Position } from "@xyflow/react";
import CustomHandle from "./CustomHandle";

export default function FamilyNode({ data }) {
  const { name, isSelected, childrenPorts = [] } = data;

  // Handle styles for family node
  const handleStyles = {
    parentConnection: { background: "#8b5cf6", width: "12px", height: "12px" },
    childrenConnection: { background: "#10b981", width: "12px", height: "12px" },
    childrenPort: { background: "#059669", width: "10px", height: "10px" },
    routingIn: { background: "#f59e0b", width: "8px", height: "8px" },
    routingOut: { background: "#ef4444", width: "8px", height: "8px" }
  };

  // Render handles component
  const HandleComponent = () => (
    <>
      <CustomHandle 
        type="target" 
        position={Position.Top} 
        id="parentconnection"
        style={handleStyles.parentConnection}
      />
      <CustomHandle 
        type="source" 
        position={Position.Bottom} 
        id="childrenconnection"
        style={handleStyles.childrenConnection}
      />
      {/* Individual ports for each child connection */}
      {childrenPorts.map((port, index) => {
        const portCount = childrenPorts.length;
        const angle = portCount > 1 ? (index / (portCount - 1)) * Math.PI - Math.PI/2 : -Math.PI/2;
        const radius = 35; // Distance from center for ports
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        return (
          <CustomHandle 
            key={port.id}
            type="source" 
            position={Position.Bottom} 
            id={port.id}
            style={{
              ...handleStyles.childrenPort,
              transform: `translate(${x}px, ${y}px)`,
              position: 'absolute'
            }}
          />
        );
      })}
      {/* Routing ports for inter-cluster connections - REMOVED */}
    </>
  );

  // Circle size - no longer changes based on selection since not selectable
  const circleSize = 40;
  const fontSize = "12px";

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: `${circleSize}px`,
        height: `${circleSize}px`,
        borderRadius: "100%",
        backgroundColor: "#f3f4f6",
        border: "2px solid #9ca3af",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)"
      }}
    >
      <div 
        style={{ 
          fontWeight: "bold", 
          fontSize: fontSize,
          textAlign: "center",
          color: "#374151",
          wordBreak: "break-word",
          padding: "4px"
        }}
      >
      </div>
      <HandleComponent />
    </div>
  );
}
