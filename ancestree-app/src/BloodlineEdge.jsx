import React from "react";
import {
  BezierEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
} from "@xyflow/react";

export default function BloodlineEdge(props) {
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
  // Normal mode: red for both normal and fake bloodline edges
  // Debug mode: red for normal bloodline edges
  const edgeColor = 'rgba(233, 42, 9, 1)'; // Red in both modes

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
          </>
        );
      }