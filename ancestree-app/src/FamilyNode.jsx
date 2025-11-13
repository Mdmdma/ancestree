import React from "react";
import { Position } from "@xyflow/react";
import CustomHandle from "./CustomHandle";

export default function FamilyNode({ data }) {
  const { childrenPorts = [] } = data;

  // Render handles component
  const HandleComponent = () => (
    <>
      <CustomHandle 
        type="target" 
        position={Position.Top} 
        id="parentconnection"
      />
      <CustomHandle 
        type="source" 
        position={Position.Bottom} 
        id="childrenconnection"
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
