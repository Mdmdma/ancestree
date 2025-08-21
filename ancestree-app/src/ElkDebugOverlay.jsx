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
      ${renderEdges(elkGraph, layoutedGraph, offsetX, offsetY)}
      
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
          <span>Family Ports</span>
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

        ${renderPorts(elkGraph.children[index], clusterX, clusterY)}
        ${renderInternalNodes(cluster, clusterX, clusterY)}
      </div>
    `;
  }).join('') || '';
};

const renderPorts = (elkCluster, clusterX, clusterY) => {
  return elkCluster?.ports?.map((port, portIndex) => {
    const anchorMatch = port.layoutOptions['elk.port.anchor']?.match(/\(([^,]+),([^)]+)\)/);
    if (!anchorMatch) return '';
    
    const portX = parseFloat(anchorMatch[1]);
    const portY = parseFloat(anchorMatch[2]);
    
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
      "></div>
      
      <!-- Port label -->
      <div style="
        position: absolute;
        left: ${clusterX + portX - 20}px;
        top: ${clusterY + portY + 15}px;
        font-size: 10px;
        color: #26a69a;
        background: rgba(255, 255, 255, 0.9);
        padding: 1px 4px;
        border-radius: 3px;
        border: 1px solid #26a69a;
        max-width: 40px;
        text-align: center;
      ">
        P${portIndex}
      </div>
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
  return elkGraph?.edges?.map((elkEdge, edgeIndex) => {
    const sourceIndex = parseInt(elkEdge.sources[0].replace('cluster-', ''));
    const targetIndex = parseInt(elkEdge.targets[0].replace('cluster-', ''));
    
    const sourceCluster = layoutedGraph?.children?.[sourceIndex];
    const targetCluster = layoutedGraph?.children?.[targetIndex];
    
    if (!sourceCluster || !targetCluster) return '';

    const sourceX = sourceCluster.x + sourceCluster.width / 2 + offsetX;
    const sourceY = sourceCluster.y + sourceCluster.height + offsetY;
    const targetX = targetCluster.x + targetCluster.width / 2 + offsetX;
    const targetY = targetCluster.y + offsetY;
    
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    return `
      <!-- Edge line -->
      <div style="
        position: absolute;
        left: ${sourceX}px;
        top: ${sourceY}px;
        width: ${length}px;
        height: 3px;
        background: #6c5ce7;
        transform-origin: 0 50%;
        transform: rotate(${angle}deg);
        opacity: 0.7;
      "></div>
      
      <!-- Edge arrow -->
      <div style="
        position: absolute;
        left: ${targetX - 5}px;
        top: ${targetY - 5}px;
        width: 0;
        height: 0;
        border-left: 5px solid #6c5ce7;
        border-top: 5px solid transparent;
        border-bottom: 5px solid transparent;
        transform: rotate(${angle - 90}deg);
      "></div>
      
      <!-- Edge label -->
      <div style="
        position: absolute;
        left: ${sourceX + dx/2 - 15}px;
        top: ${sourceY + dy/2 - 10}px;
        font-size: 10px;
        color: #6c5ce7;
        background: rgba(255, 255, 255, 0.9);
        padding: 1px 4px;
        border-radius: 3px;
        border: 1px solid #6c5ce7;
      ">
        E${edgeIndex}
      </div>
    `;
  }).join('') || '';
};

export default ElkDebugOverlay;