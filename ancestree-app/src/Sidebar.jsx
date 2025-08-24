import React from 'react';
import NodeEditor from './NodeEditor';
import ImageGallery from './ImageGallery';
import MapView from './MapView';
import ElkDebugOverlay from './ElkDebugOverlay';

const Sidebar = ({ 
  activeTab, 
  setActiveTab,
  selectedNode,
  nodes,
  edges,
  showDebug,
  debugInfo,
  treeOperations,
  onPersonSelectFromGallery,
  onPersonSelectFromMap,
  onTaggingModeChange,
  onMapModeChange,
  updateNodeData,
  updateNodeDataAndPosition,
  deleteNode,
  nodeHasConnections
}) => {
  const { autoLayout, fitTreeToView } = treeOperations || {};

  return (
    <div style={{ 
      width: '20vw', 
      borderLeft: '1px solid #ccc', 
      backgroundColor: '#09380dff',
      padding: '0',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      minHeight: '100vh',
      boxSizing: 'border-box',
      flexShrink: 0 // Prevent sidebar from shrinking
    }}>
      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        borderBottom: '1px solid #ccc',
        backgroundColor: '#0a4b11ff'
      }}>
        <button
          onClick={() => setActiveTab('editor')}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: activeTab === 'editor' ? '#09380dff' : 'transparent',
            color: 'white',
            border: 'none',
            borderBottom: activeTab === 'editor' ? '2px solid #4CAF50' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeTab === 'editor' ? 'bold' : 'normal'
          }}
        >
          👤 Editor
        </button>
        <button
          onClick={() => setActiveTab('images')}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: activeTab === 'images' ? '#09380dff' : 'transparent',
            color: 'white',
            border: 'none',
            borderBottom: activeTab === 'images' ? '2px solid #4CAF50' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeTab === 'images' ? 'bold' : 'normal'
          }}
        >
          📸 Photos
        </button>
        <button
          onClick={() => setActiveTab('map')}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: activeTab === 'map' ? '#09380dff' : 'transparent',
            color: 'white',
            border: 'none',
            borderBottom: activeTab === 'map' ? '2px solid #4CAF50' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeTab === 'map' ? 'bold' : 'normal'
          }}
        >
          🗺️ Map
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto',
        minHeight: 0, // Allows flex item to shrink
        display: 'flex',
        flexDirection: 'column'
      }}>
        {activeTab === 'editor' && (
          <div style={{ padding: '20px', flex: 1 }}>
            {selectedNode ? (
              <NodeEditor 
                node={selectedNode} 
                onUpdate={showDebug ? updateNodeDataAndPosition : updateNodeData}
                onDelete={deleteNode}
                hasConnections={nodeHasConnections(selectedNode.id)}
                isDebugMode={showDebug}
                nodes={nodes}
                edges={edges}
              />
            ) : (
              <div style={{ color: 'white' }}>
                <h3>Wähle eine Person</h3>
                <p>Klicke auf eine beliebige Person, um ihre Informationen zu bearbeiten.</p>
                <p>Ziehe von einem farbigen Punkt ins leere, um eine neue Person hinzuzufügen.</p>
                
                <div style={{ marginTop: '30px' }}>
                  <button 
                    onClick={autoLayout}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      fontSize: '16px',
                      cursor: 'pointer',
                      marginBottom: '10px'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#45a049'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#4CAF50'}
                  >
                    🔄 Auto Layout
                  </button>
                  
                  <button 
                    onClick={fitTreeToView}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      fontSize: '16px',
                      cursor: 'pointer',
                      marginBottom: '10px'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#1976D2'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#2196F3'}
                  >
                    🔍 Fit to View
                  </button>
                  
                  <p style={{ fontSize: '0.8rem', opacity: 0.8, margin: '0 0 20px 0' }}>
                    Auto Layout: Strg+L (Cmd+L)<br/>
                    Fit to View: Strg+F (Cmd+F)
                  </p>
                  
                  {showDebug && (
                    <div style={{ marginTop: '15px' }}>
                      <h4 style={{ color: 'white', marginBottom: '10px' }}>🔧 ELK Debug Information</h4>
                      <ElkDebugOverlay debugInfo={debugInfo} />
                    </div>
                  )}
                </div>
                
                <div style={{ marginTop: '20px', fontSize: '0.9rem' }}>
                  <h4>Verbindungsregeln:</h4>
                  <p>🔴 Rot (oben): Eltern hinzufügen</p>
                  <p>🟠 Orange (unten): Kinder hinzufügen</p>
                  <p>🔵 Blau (links/rechts): Partner hinzufügen</p>
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'images' && (
          <ImageGallery 
            nodes={nodes}
            selectedNode={selectedNode}
            onPersonSelect={onPersonSelectFromGallery}
            onTaggingModeChange={onTaggingModeChange}
          />
        )}
        
        {activeTab === 'map' && (
          <MapView 
            nodes={nodes}
            selectedNode={selectedNode}
            onPersonSelect={onPersonSelectFromMap}
            onMapModeChange={onMapModeChange}
          />
        )}
      </div>
    </div>
  );
};

export default Sidebar;
