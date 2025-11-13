import React from "react";
import { Handle } from "@xyflow/react";

export default function CustomHandle(props) {
  // Map handle IDs to CSS class names
  const getHandleClass = (id) => {
    if (!id) return '';
    
    // Map IDs to class names
    const classMap = {
      'parent': 'handle-parent',
      'child': 'handle-child',
      'partner-left': 'handle-partner',
      'partner-right': 'handle-partner',
      'parentconnection': 'handle-parent-connection',
      'childrenconnection': 'handle-children-connection'
    };
    
    // Check if it's a children port (starts with 'port-')
    if (id.startsWith('port-')) {
      return 'handle-children-port';
    }
    
    return classMap[id] || '';
  };
  
  const handleClass = getHandleClass(props.id);
  const className = [handleClass, props.className].filter(Boolean).join(' ');
  
  return (
    <Handle
      {...props}
      className={className}
    />
  );
}