import React, { useEffect, useRef } from 'react';

const ElkDebugOverlay = ({ elkDebugData, showDebug }) => {
  const popupRef = useRef(null);

  useEffect(() => {
    if (showDebug && elkDebugData) {
      // Open popup window
      const popup = window.open('', 'elk-debug', 'width=1200,height=800,scrollbars=yes,resizable=yes');
      popupRef.current = popup;
      
      if (popup) {
        // Set up the popup window content
        popup.document.title = 'ELK Debug View';
        popup.document.head.innerHTML = `
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              background: #f5f5f5;
              overflow: auto;
            }
            .debug-container {
              position: relative;
              background: white;
              border-radius: 8px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              min-height: calc(100vh - 40px);
            }
            .legend {
              position: fixed;
              top: 20px;
              right: 20px;
              background: rgba(255, 255, 255, 0.95);
              border: 2px solid #333;
              border-radius: 8px;
              padding: 10px;
              font-size: 12px;
              min-width: 180px;
              z-index: 1000;
              box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            }
          </style>
        `;
        
        renderDebugContent(popup, elkDebugData);
      }
    } else if (popupRef.current && !popupRef.current.closed) {
      // Close popup if showDebug is false
      popupRef.current.close();
      popupRef.current = null;
    }

    // Cleanup function to close popup when component unmounts
    return () => {
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, [showDebug, elkDebugData]);

  // This component doesn't render anything in the main window
  return null;
};

const renderDebugContent = (popup, elkDebugData) => {
  const { elkGraph, elkClusters, layoutedGraph } = elkDebugData;
  
  // Calculate total bounds for proper canvas sizing
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  layoutedGraph?.children?.forEach(cluster => {
    minX = Math.min(minX, cluster.x);
    minY = Math.min(minY, cluster.y);
    maxX = Math.max(maxX, cluster.x + cluster.width);
    maxY = Math.max(maxY, cluster.y + cluster.height);
  });
  
  const padding = 100;
  const totalWidth = maxX - minX + 2 * padding;
  const totalHeight = maxY - minY + 2 * padding;
  const offsetX = -minX + padding;
  const offsetY = -minY + padding;

  popup.document.body.innerHTML = `
    <div class="debug-container" style="width: ${totalWidth}px; height: ${totalHeight}px;">
      <h2 style="position: absolute; top: 10px; left: 10px; margin: 0; color: #333; background: rgba(255,255,255,0.9); padding: 8px 12px; border-radius: 6px; border: 2px solid #333;">
        ELK Debug View - Family Tree Layout
      </h2>
      
      ${renderClusters(layoutedGraph, elkClusters, elkGraph, offsetX, offsetY)}
      
      <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5;">
        ${renderEdges(elkGraph, layoutedGraph, offsetX, offsetY)}
      </svg>
      
      <!-- Legend -->
      <div class="legend">
        <div style="font-weight: bold; margin-bottom: 8px; color: #333;">
          ELK Debug View
        </div>
        <div style="display: flex; align-items: center; margin-bottom: 4px;">
          <div style="width: 16px; height: 12px; border: 2px dashed #ff6b6b; background: rgba(255, 107, 107, 0.1); margin-right: 6px;"></div>
          <span>ELK Clusters</span>
        </div>
        <div style="display: flex; align-items: center; margin-bottom: 4px;">
          <div style="width: 12px; height: 12px; background: #4ecdc4; border: 2px solid #26a69a; border-radius: 50%; margin-right: 8px;"></div>
          <span>Edge-specific Ports</span>
        </div>
        <div style="display: flex; align-items: center; margin-bottom: 4px;">
          <div style="width: 8px; height: 8px; background: #e74c3c; border: 1px solid #c0392b; border-radius: 2px; margin-right: 10px;"></div>
          <span>Family Node Position</span>
        </div>
        <div style="display: flex; align-items: center; margin-bottom: 4px;">
          <div style="width: 16px; height: 3px; background: #ff9f43; margin-right: 6px; opacity: 0.7;"></div>
          <span>Family→Port Connection</span>
        </div>
        <div style="display: flex; align-items: center; margin-bottom: 4px;">
          <div style="width: 16px; height: 12px; border: 1px solid #ffd93d; background: rgba(255, 217, 61, 0.2); margin-right: 6px;"></div>
          <span>Internal Nodes</span>
        </div>
        <div style="display: flex; align-items: center;">
          <div style="width: 16px; height: 3px; background: #6c5ce7; margin-right: 6px;"></div>
          <span>ELK Edges</span>
        </div>
      </div>
    </div>
  `;
};

const renderClusters = (layoutedGraph, elkClusters, elkGraph, offsetX, offsetY) => {
  return layoutedGraph?.children?.map((layoutedCluster, index) => {
    const cluster = elkClusters[index];
    if (!cluster) return '';

    const clusterX = layoutedCluster.x + offsetX;
    const clusterY = layoutedCluster.y + offsetY;

    return `
      <div>
        <!-- Cluster boundary -->
        <div style="
          position: absolute;
          left: ${clusterX}px;
          top: ${clusterY}px;
          width: ${layoutedCluster.width}px;
          height: ${layoutedCluster.height}px;
          border: 2px dashed #ff6b6b;
          background: rgba(255, 107, 107, 0.1);
          border-radius: 8px;
        "></div>
        
        <!-- Cluster label -->
        <div style="
          position: absolute;
          left: ${clusterX + 5}px;
          top: ${clusterY - 20}px;
          font-size: 12px;
          font-weight: bold;
          color: #ff6b6b;
          background: rgba(255, 255, 255, 0.9);
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid #ff6b6b;
        ">
          Cluster ${index} (Birth: ${cluster.birthYear})
        </div>

        ${renderPorts(elkGraph.children[index], layoutedCluster, cluster, clusterX, clusterY)}
        ${renderInternalNodes(cluster, clusterX, clusterY)}
      </div>
    `;
  }).join('') || '';
};

const renderPorts = (elkCluster, layoutedCluster, cluster, clusterX, clusterY) => {
  return elkCluster?.ports?.map((port, portIndex) => {
    const anchorMatch = port.layoutOptions['elk.port.anchor']?.match(/\(([^,]+),([^)]+)\)/);
    if (!anchorMatch) return '';
    
    const portX = parseFloat(anchorMatch[1]);
    const portY = parseFloat(anchorMatch[2]);
    
    // Determine port side for visual styling
    const portSide = port.layoutOptions['elk.port.side'] || 'SOUTH';
    const isTopOrBottom = portSide === 'NORTH' || portSide === 'SOUTH';
    
    return `
      <!-- Port marker -->
      <div style="
        position: absolute;
        left: ${clusterX + portX - 6}px;
        top: ${clusterY + portY - 6}px;
        width: 12px;
        height: 12px;
        background: #4ecdc4;
        border: 2px solid #26a69a;
        border-radius: 50%;
        z-index: 10;
      "></div>
      
      <!-- Port group indicator -->
      ${port.metadata?.familyNodes ? `
        <div style="
          position: absolute;
          left: ${clusterX + portX - 8}px;
          top: ${clusterY + portY - 8}px;
          width: 16px;
          height: 16px;
          border: 2px dashed #ff9f43;
          border-radius: 3px;
          z-index: 9;
        "></div>
      ` : ''}
      
      <!-- Port label -->
      <div style="
        position: absolute;
        left: ${clusterX + portX - 35}px;
        top: ${clusterY + portY + (isTopOrBottom ? 15 : -35)}px;
        font-size: 9px;
        color: #26a69a;
        background: rgba(255, 255, 255, 0.95);
        padding: 2px 4px;
        border-radius: 3px;
        border: 1px solid #26a69a;
        max-width: 70px;
        text-align: center;
        font-weight: bold;
        z-index: 11;
      ">
        ${port.metadata?.edgeId ? 
          `Edge Port<br/>${port.metadata.edgeId.substring(0, 12)}...` : 
          `Family Port<br/>${port.id.includes('port-family-') ? port.id.replace('port-family-', 'F:').substring(0, 10) + '...' : `Port ${portIndex}`}`
        }
      </div>
      
      <!-- Family node position indicator -->
      ${port.metadata?.familyNodeX !== undefined && port.metadata?.familyNodeY !== undefined ? `
        <div style="
          position: absolute;
          left: ${clusterX + port.metadata.familyNodeX - cluster.bounds.minX + 45}px;
          top: ${clusterY + port.metadata.familyNodeY - cluster.bounds.minY + 45}px;
          width: 8px;
          height: 8px;
          background: #e74c3c;
          border: 1px solid #c0392b;
          border-radius: 2px;
          z-index: 12;
        "></div>
        
        <!-- Connection line from family node to port -->
        <svg style="
          position: absolute;
          left: ${clusterX}px;
          top: ${clusterY}px;
          width: ${layoutedCluster.width}px;
          height: ${layoutedCluster.height}px;
          pointer-events: none;
          z-index: 8;
        ">
          <line
            x1="${port.metadata.familyNodeX - cluster.bounds.minX + 50}"
            y1="${port.metadata.familyNodeY - cluster.bounds.minY + 50}"
            x2="${portX}"
            y2="${portY}"
            stroke="#ff9f43"
            stroke-width="2"
            stroke-dasharray="3,3"
            opacity="0.7"
          />
        </svg>
      ` : ''}
    `;
  }).join('') || '';
};

const renderInternalNodes = (cluster, clusterX, clusterY) => {
  return cluster.clusterNodes.map((clusterNode, nodeIndex) => {
    const nodeX = clusterX + clusterNode.x - cluster.bounds.minX + 50 - clusterNode.width/2;
    const nodeY = clusterY + clusterNode.y - cluster.bounds.minY + 50 - clusterNode.height/2;
    
    return `
      <!-- Internal node boundary -->
      <div style="
        position: absolute;
        left: ${nodeX}px;
        top: ${nodeY}px;
        width: ${clusterNode.width}px;
        height: ${clusterNode.height}px;
        border: 1px solid #ffd93d;
        background: rgba(255, 217, 61, 0.2);
        border-radius: 4px;
      "></div>
      
      <!-- Internal node label -->
      <div style="
        position: absolute;
        left: ${nodeX + clusterNode.width/2 - 15}px;
        top: ${nodeY - 15}px;
        font-size: 10px;
        color: #f57f17;
        background: rgba(255, 255, 255, 0.9);
        padding: 1px 3px;
        border-radius: 3px;
        border: 1px solid #ffd93d;
      ">
        ${nodeIndex}
      </div>
    `;
  }).join('');
};

const renderEdges = (elkGraph, layoutedGraph, offsetX, offsetY) => {
  // Helper to find a port's absolute position using anchor coordinates
  const findPortPosition = (portId) => {
    for (let clusterIndex = 0; clusterIndex < layoutedGraph.children.length; clusterIndex++) {
      const cluster = layoutedGraph.children[clusterIndex];
      const elkCluster = elkGraph.children[clusterIndex];
      
      const port = elkCluster?.ports?.find(p => p.id === portId);
      if (port) {
        // Extract coordinates from anchor format: "(x,y)"
        const anchorMatch = port.layoutOptions['elk.port.anchor']?.match(/\(([^,]+),([^)]+)\)/);
        if (anchorMatch) {
          const portX = parseFloat(anchorMatch[1]);
          const portY = parseFloat(anchorMatch[2]);
          
          return {
            x: cluster.x + portX + offsetX,
            y: cluster.y + portY + offsetY,
            clusterIndex,
            portId: port.id,
            edgeId: port.metadata?.edgeId
          };
        }
      }
    }
    return null;
  };

  console.log('Debug: ELK Edges to render:', elkGraph.edges?.length || 0);
  
  return elkGraph.edges?.map((elkEdge, edgeIndex) => {
    const sourceId = elkEdge.sources[0];
    const targetId = elkEdge.targets[0];
    
    console.log(`Debug Edge ${edgeIndex}: ${sourceId} -> ${targetId}`);

    let sourcePos = findPortPosition(sourceId);
    let targetPos = findPortPosition(targetId);

    // Enhanced fallback with better cluster center calculation
    if (!sourcePos) {
      console.log(`Warning: Source port ${sourceId} not found, using cluster fallback`);
      const sourceCluster = layoutedGraph.children.find(c => c.id === sourceId);
      if (sourceCluster) {
        sourcePos = {
          x: sourceCluster.x + sourceCluster.width / 2 + offsetX,
          y: sourceCluster.y + sourceCluster.height / 2 + offsetY,
          clusterIndex: -1,
          portId: sourceId,
          edgeId: 'cluster-fallback'
        };
      }
    }
    
    if (!targetPos) {
      console.log(`Warning: Target port ${targetId} not found, using cluster fallback`);
      const targetCluster = layoutedGraph.children.find(c => c.id === targetId);
      if (targetCluster) {
        targetPos = {
          x: targetCluster.x + targetCluster.width / 2 + offsetX,
          y: targetCluster.y + targetCluster.height / 2 + offsetY,
          clusterIndex: -1,
          portId: targetId,
          edgeId: 'cluster-fallback'
        };
      }
    }

    if (!sourcePos || !targetPos) {
      console.log(`Error: Could not find positions for edge ${sourceId} -> ${targetId}`);
      return '';
    }

    const { x: sourceX, y: sourceY } = sourcePos;
    const { x: targetX, y: targetY } = targetPos;

    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    // Extract original edge ID from the ELK edge ID for better labeling
    const originalEdgeId = elkEdge.id.replace('edge-inter-', '');

    return `
      <g>
        <!-- Edge line -->
        <line
          x1="${sourceX}"
          y1="${sourceY}"
          x2="${targetX}"
          y2="${targetY}"
          stroke="#6c5ce7"
          stroke-width="3"
          opacity="0.8"
          stroke-dasharray="none"
        />
        
        <!-- Edge arrow -->
        <path 
          d="M -8 -4 L 0 0 L -8 4 z" 
          fill="#6c5ce7"
          transform="translate(${targetX}, ${targetY}) rotate(${angle})"
          opacity="0.9"
        />
        
        <!-- Edge label with original edge info -->
        <text 
          x="${sourceX + dx / 2}" 
          y="${sourceY + dy / 2 - 8}" 
          font-size="11" 
          fill="#6c5ce7" 
          text-anchor="middle"
          font-weight="bold"
          style="text-shadow: 1px 1px 2px rgba(255,255,255,0.8);"
        >
          ${originalEdgeId.substring(0, 8)}
        </text>
        
        <!-- Debug info showing port IDs -->
        <text 
          x="${sourceX + dx / 2}" 
          y="${sourceY + dy / 2 + 8}" 
          font-size="8" 
          fill="#666" 
          text-anchor="middle"
          opacity="0.7"
        >
          ${sourcePos.portId.substring(sourcePos.portId.lastIndexOf('-') + 1, sourcePos.portId.lastIndexOf('-') + 4)}→${targetPos.portId.substring(targetPos.portId.lastIndexOf('-') + 1, targetPos.portId.lastIndexOf('-') + 4)}
        </text>
      </g>
    `;
  }).join('') || '';
};

export default ElkDebugOverlay;