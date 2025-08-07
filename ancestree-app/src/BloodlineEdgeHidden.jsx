import React from "react";
import {
  BezierEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
} from "@xyflow/react";

export default function BloodlineEdgeHidden(props) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
  } = props;

  const { setEdges } = useReactFlow();
  const isDebugMode = data?.isDebugMode || false;

  // Color logic based on debug mode
  // Normal mode: transparent (almost invisible)
  // Debug mode: orange
  const edgeColor = isDebugMode ? 'rgba(255, 152, 0, 1)' : 'rgba(0, 0, 0, 0.1)'; // Orange in debug, transparent in normal

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BezierEdge {...props} style={{ stroke: edgeColor, strokeWidth: 1 }} />
      {isDebugMode && (
        <EdgeLabelRenderer>
          <button
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
              backgroundColor: "transparent",
              color: "red",
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
            onClick={() =>
              setEdges((prevEdges) => prevEdges.filter((edge) => edge.id !== id))
            }
          >
            ×
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
