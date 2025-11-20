import React from "react";
import {
  BezierEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
} from "@xyflow/react";
import { encryptedApi } from "./encryptedApi";

export default function PartnerEdge(props) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    type,
    data,
  } = props;

  const { setEdges } = useReactFlow();

  // Check if this is an expartner edge
  const isExpartner = type === 'expartner';

  // Partner edges stay green, expartner edges are gray
  const edgeColor = isExpartner ? 'var(--edge-expartner)' : 'var(--edge-partner)';

  const [, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const handleToggle = async () => {
    // Toggle between partner and expartner
    const newType = isExpartner ? 'partner' : 'expartner';
    
    try {
      // Update the edge type in the database using encryptedApi
      await encryptedApi.updateEdge(id, { type: newType });
      
      // Update the edge type in local state
      setEdges((prevEdges) => 
        prevEdges.map((edge) => 
          edge.id === id 
            ? { ...edge, type: newType }
            : edge
        )
      );
    } catch (error) {
      console.error('Failed to toggle edge type:', error);
    }
  };

  return (
    <>
      <BezierEdge 
        {...props} 
        style={{ 
          stroke: edgeColor, 
          strokeWidth: 1,
          strokeDasharray: isExpartner ? '5,5' : 'none' // Dashed line for expartner
        }} 
      />
      <EdgeLabelRenderer>
        <button
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
            backgroundColor: "transparent",
            color: isExpartner ? "orange" : "red",
            border: "none",
            width: "12px",
            height: "12px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: "1",
          }}
          onClick={handleToggle}
        >
          ×
        </button>
      </EdgeLabelRenderer>
    </>
  );
}