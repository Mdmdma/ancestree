import React from "react";
import { Handle } from "@xyflow/react";

export default function CustomHandle(props) {
  return (
    <Handle
      style={{
        width: 15,
        height: 15,
        background: props.style?.background || "#555",
        border: "2px solid white",
        borderRadius: "50%",
        ...props.style
      }}
      {...props}
    />
  );
}