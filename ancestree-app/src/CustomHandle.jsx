import React from "react";
import { Handle } from "@xyflow/react";

export default function CustomHandle(props) {
  return (
    <Handle
      style={{
        width: 8,
        height: 8,
        background: "white",
        border: "2px solid black",
      }}
      {...props}
    />
  );
}