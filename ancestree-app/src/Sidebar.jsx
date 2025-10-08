import React from 'react';
import NodeEditor from './NodeEditor';
import ImageGallery from './ImageGallery';
import MapView from './MapView';
import ElkDebugOverlay from './ElkDebugOverlay';
import NodeSearch from './NodeSearch';
import { appConfig } from './config';

const Sidebar = ({ 
  activeTab, 
  setActiveTab,
  selectedNode,
  setSelectedNode,
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
  nodeHasConnections,
  galleryViewMode,
  onGalleryViewModeChange
}) => {
  const { autoLayout, fitTreeToView } = treeOperations || {};

  // Determine if sidebar should be expanded on mobile
  const shouldExpandSidebar = 
    (activeTab === 'images' && galleryViewMode === 'confirm') ||
    (activeTab === 'editor' && selectedNode !== null);

  return (
    <div 
      className="sidebar-container" 
      data-gallery-mode={galleryViewMode}
      data-expanded={shouldExpandSidebar ? 'true' : 'false'}
      style={{ 
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
      {/* Search Section - Always visible at top */}
      <div className="mobile-hide-search" style={{ 
        padding: '16px',
        borderBottom: '1px solid #0a4b11ff',
        backgroundColor: '#09380dff'
      }}>
        <NodeSearch 
          nodes={nodes}
          onNodeSelect={(node) => {
            // Use tree operations to properly select the node in the tree
            if (treeOperations?.selectNode) {
              treeOperations.selectNode(node.id);
            } else {
              // Fallback to direct selection if selectNode is not available
              setSelectedNode(node);
            }
            // Don't change the active tab - preserve current sidebar view
          }}
        />
      </div>

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
          {appConfig.ui.tabs.editor}
        </button>
        <button
          onClick={() => setActiveTab('images')}
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: activeTab === 'images' ? '#09380dff' : 'transparent',
            color: 'white',
            border: 'none',
            borderBottom: activeTab === 'images' ? '2px solid #4CAF50' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activeTab === 'images' ? 'bold' : 'normal'
          }}
        >
          {appConfig.ui.tabs.photos}
        </button>
        <button
          onClick={() => setActiveTab('map')}
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: activeTab === 'map' ? '#09380dff' : 'transparent',
            color: 'white',
            border: 'none',
            borderBottom: activeTab === 'map' ? '2px solid #4CAF50' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activeTab === 'map' ? 'bold' : 'normal'
          }}
        >
          {appConfig.ui.tabs.map}
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
                setSelectedNode={setSelectedNode}
                hasConnections={nodeHasConnections(selectedNode.id)}
                isDebugMode={showDebug}
                nodes={nodes}
                edges={edges}
              />
            ) : (
              <div style={{ color: 'white' }}>
                <h3 className="mobile-hide-tab-title">{appConfig.ui.editor.selectPersonTitle}</h3>
                <p className="mobile-hide-instructions">{appConfig.ui.editor.selectPersonDescription}</p>
                <p className="mobile-hide-instructions">{appConfig.ui.editor.addPersonDescription}</p>
                
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
                    {appConfig.ui.editor.buttons.autoLayout}
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
                    {appConfig.ui.editor.buttons.fitToView}
                  </button>
                  
                  <p className="mobile-hide-instructions" style={{ fontSize: '0.8rem', opacity: 0.8, margin: '0 0 20px 0' }}>
                    {appConfig.ui.editor.shortcutsHelp.autoLayout}<br/>
                    {appConfig.ui.editor.shortcutsHelp.fitToView}
                  </p>
                  
                  {showDebug && (
                    <div style={{ marginTop: '15px' }}>
                      <h4 style={{ color: 'white', marginBottom: '10px' }}>{appConfig.ui.editor.debug.title}</h4>
                      <ElkDebugOverlay debugInfo={debugInfo} />
                    </div>
                  )}
                </div>
                
                <div className="mobile-hide-instructions" style={{ marginTop: '20px', fontSize: '0.9rem' }}>
                  <h4>{appConfig.ui.editor.connectionRules.title}</h4>
                  <p>{appConfig.ui.editor.connectionRules.parent}</p>
                  <p>{appConfig.ui.editor.connectionRules.child}</p>
                  <p>{appConfig.ui.editor.connectionRules.partner}</p>
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
            onViewModeChange={onGalleryViewModeChange}
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
