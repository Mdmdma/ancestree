import React, { useCallback, useState, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import FamilyTree from './FamilyTree';
import AppHeader from './AppHeader';
import Sidebar from './Sidebar';
import Login from './Login';
import AdminPanel from './AdminPanel';
import { api, getAuthToken, getSocketServerUrl } from './api';
import { encryptedApi } from './encryptedApi';
import { clearSession } from './encryptionSession';
import { useSocket } from './hooks/useSocket';
import ELK from 'elkjs/lib/elk.bundled.js';

import '@xyflow/react/dist/style.css';

const AddNodeOnEdgeDrop = () => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [activeTab, setActiveTab] = useState('editor'); // 'editor', 'images', or 'map'
  const [isTaggingMode, setIsTaggingMode] = useState(false);
  const [isMapMode, setIsMapMode] = useState(false);
  const [treeOperations, setTreeOperations] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [galleryViewMode, setGalleryViewMode] = useState('gallery'); // Track gallery view mode for mobile sidebar height
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // Initialize socket connection when authenticated
  const socketData = useSocket(getSocketServerUrl(), isAuthenticated);

  // Check authentication on app load
  useEffect(() => {
    const checkAuth = async () => {
      const token = getAuthToken();
      if (token) {
        try {
          const result = await api.verifyToken();
          setIsAuthenticated(true);
          setUser(result.user);
        } catch {
          console.log('Token invalid, please login again');
          api.logout();
          setIsAuthenticated(false);
        }
      }
      setCheckingAuth(false);
    };

    checkAuth();
  }, []);

  // Handle successful login
  const handleLoginSuccess = async (userData, password) => {
    setIsAuthenticated(true);
    setUser(userData);
    // Note: Encryption session is initialized in Login.jsx via initializeSession()
  };

  // Handle logout
  const handleLogout = () => {
    api.logout();
    clearSession(); // Clear encryption session
    setIsAuthenticated(false);
    setUser(null);
  };

  // Handle admin panel
  const handleAdminClick = () => {
    setShowAdminPanel(true);
  };

  const handleAdminClose = () => {
    setShowAdminPanel(false);
  };

  const handleAdminAuthenticate = () => {
    setIsAdminAuthenticated(true);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Auto layout with Ctrl+L or Cmd+L
      if ((event.ctrlKey || event.metaKey) && event.key === 'l') {
        event.preventDefault();
        if (treeOperations?.autoLayout) {
          treeOperations.autoLayout();
        }
      }
      // Fit to view with Ctrl+F or Cmd+F
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        if (treeOperations?.fitTreeToView) {
          treeOperations.fitTreeToView();
        }
      }
      // Toggle debug mode with Ctrl+Shift+D or Cmd+Shift+D
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        setShowDebug(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [treeOperations]);

  // Handle tree data updates from FamilyTree component
  const handleTreeUpdate = useCallback((data) => {
    setNodes(data.nodes);
    setEdges(data.edges);
    setTreeOperations({
      autoLayout: data.autoLayout,
      fitTreeToView: data.fitTreeToView,
      zoomToNode: data.zoomToNode,
      updateNode: data.updateNode,
      refreshData: data.refreshData,
      selectNode: data.selectNode
    });
  }, []);

  // Node update handlers for the sidebar
  const updateNodeData = useCallback(async (nodeId, newData) => {
    try {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) {
        console.error('Node not found:', nodeId);
        return;
      }

      const response = await encryptedApi.updateNode(nodeId, { position: node.position, data: newData });
      
      if (response.success) {
        // Update the local state
        setNodes((nds) =>
          nds.map((node) =>
            node.id === nodeId
              ? { 
                  ...node, 
                  data: { 
                    ...node.data, 
                    ...newData
                  } 
                }
              : node
          )
        );

        // Update selectedNode if it's the same node being updated
        if (selectedNode && selectedNode.id === nodeId) {
          setSelectedNode((prevSelected) => ({
            ...prevSelected,
            data: {
              ...prevSelected.data,
              ...newData
            }
          }));
        }

        // Also update the tree operations if available to sync FamilyTree component
        if (treeOperations?.updateNode) {
          if (showDebug) {
            console.log('App: Calling treeOperations.updateNode for node', nodeId, 'with data:', newData);
          }
          treeOperations.updateNode(nodeId, newData);
        }
      } else {
        console.error('Failed to update node in database');
        // Optionally refresh data from database to get current state
        if (treeOperations?.refreshData) {
          treeOperations.refreshData();
        }
      }
    } catch (error) {
      console.error('Failed to update node:', error);
      // Optionally refresh data from database to get current state
      if (treeOperations?.refreshData) {
        treeOperations.refreshData();
      }
    }
  }, [nodes, treeOperations, selectedNode, showDebug]);

  const updateNodeDataAndPosition = useCallback(async (nodeId, newData, newPosition) => {
    try {
      const currentNode = nodes.find(n => n.id === nodeId);
      if (!currentNode) {
        console.error('Node not found:', nodeId);
        return;
      }

      const finalPosition = newPosition || currentNode.position;
      
      const response = await encryptedApi.updateNode(nodeId, { position: finalPosition, data: newData });
      
      if (response.success) {
        // Update the local state
        setNodes((nds) =>
          nds.map((node) =>
            node.id === nodeId
              ? { 
                  ...node, 
                  data: { 
                    ...node.data, 
                    ...newData
                  }, 
                  position: finalPosition 
                }
              : node
          )
        );

        // Update selectedNode if it's the same node being updated
        if (selectedNode && selectedNode.id === nodeId) {
          setSelectedNode((prevSelected) => ({
            ...prevSelected,
            data: {
              ...prevSelected.data,
              ...newData
            },
            position: finalPosition
          }));
        }

        // Also update the tree operations if available to sync FamilyTree component
        if (treeOperations?.updateNode) {
          if (showDebug) {
            console.log('App: Calling treeOperations.updateNode for node', nodeId, 'with data:', newData, 'and position:', finalPosition);
          }
          treeOperations.updateNode(nodeId, newData, finalPosition);
        }
      } else {
        console.error('Failed to update node in database');
        // Optionally refresh data from database to get current state
        if (treeOperations?.refreshData) {
          treeOperations.refreshData();
        }
      }
    } catch (error) {
      console.error('Failed to update node:', error);
      // Optionally refresh data from database to get current state
      if (treeOperations?.refreshData) {
        treeOperations.refreshData();
      }
      throw error;
    }
  }, [nodes, treeOperations, selectedNode, showDebug]);

  const nodeHasConnections = useCallback((nodeId) => {
    return edges.some(edge => edge.source === nodeId || edge.target === nodeId);
  }, [edges]);

  // Selection handlers
  const handlePersonSelectFromGallery = useCallback((personId) => {
    const person = nodes.find(node => node.id === personId);
    if (person) {
      setSelectedNode(person);
      if (!isTaggingMode) {
        setActiveTab('editor');
      }
    }
  }, [nodes, isTaggingMode]);

  const handlePersonSelectFromMap = useCallback((personId) => {
    // Do nothing if clicking the already selected marker
    if (selectedNode && selectedNode.id === personId) {
      console.log('[Map Selection] Node already selected, ignoring click');
      return;
    }

    const person = nodes.find(node => node.id === personId);
    if (person) {
      // Update selected node (this will turn the marker red)
      setSelectedNode(person);
      
      // Zoom to the node and show immediate family in the tree view
      setTimeout(() => {
        if (treeOperations?.zoomToNode) {
          treeOperations.zoomToNode(personId);
        }
      }, 100);
    }
  }, [nodes, selectedNode, treeOperations]);

  const handleTaggingModeChange = useCallback((isTagging) => {
    setIsTaggingMode(isTagging);
  }, []);

  const handleMapModeChange = useCallback((isMapActive) => {
    setIsMapMode(isMapActive);
  }, []);

  return (
    <div className="app-container" style={{ 
      display: 'flex', 
      height: '100vh', 
      width: '100vw',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      {/* Login Component - Only show when not authenticated */}
      {!isAuthenticated && (
        <Login 
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {/* Main Content */}
      <div className="main-content" style={{ 
        flex: 1, 
        minWidth: 0,
        overflow: 'hidden',
        marginLeft: '0',
        width: isAuthenticated ? '100%' : '0',
        display: isAuthenticated ? 'block' : 'none'
      }}>
        {checkingAuth ? (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            fontSize: '18px',
            color: 'var(--app-loading-text)'
          }}>
            Checking authentication...
          </div>
        ) : !isAuthenticated ? (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            flexDirection: 'column',
            gap: '20px',
            fontSize: '18px',
            color: 'var(--app-loading-text)'
          }}>
            <div>🔐</div>
            <div>Please login to access your family tree</div>
          </div>
        ) : (
          <>
            <AppHeader user={user} onLogout={handleLogout} onAdminClick={handleAdminClick} />
            <div className="tree-container" style={{ 
              width: '100%', 
              height: 'calc(100vh - 60px)',
              overflow: 'hidden'
            }}>
              <FamilyTree 
                selectedNode={selectedNode}
                setSelectedNode={setSelectedNode}
                showDebug={showDebug}
                setDebugInfo={setDebugInfo}
                isTaggingMode={isTaggingMode}
                isMapMode={isMapMode}
                onNodeUpdate={handleTreeUpdate}
                socketData={socketData}
              />
            </div>
          </>
        )}
      </div>
      
      {/* Sidebar - only show when authenticated */}
      {isAuthenticated && (
        <Sidebar 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          selectedNode={selectedNode}
          setSelectedNode={setSelectedNode}
          nodes={nodes}
          edges={edges}
          showDebug={showDebug}
          debugInfo={debugInfo}
          treeOperations={treeOperations}
          onPersonSelectFromGallery={handlePersonSelectFromGallery}
          onPersonSelectFromMap={handlePersonSelectFromMap}
          onTaggingModeChange={handleTaggingModeChange}
          onMapModeChange={handleMapModeChange}
          updateNodeData={updateNodeData}
          updateNodeDataAndPosition={updateNodeDataAndPosition}
          nodeHasConnections={nodeHasConnections}
          galleryViewMode={galleryViewMode}
          onGalleryViewModeChange={setGalleryViewMode}
          socket={socketData.socket}
        />
      )}

      {/* Admin Panel */}
      {isAuthenticated && (
        <AdminPanel
          isOpen={showAdminPanel}
          onClose={handleAdminClose}
          isAuthenticated={isAdminAuthenticated}
          onAuthenticate={handleAdminAuthenticate}
          familyName={user?.familyName}
          onDataReload={() => treeOperations?.refreshData()}
        />
      )}
    </div>
  );
};

const App = () => (
  <ReactFlowProvider>
    <AddNodeOnEdgeDrop />
  </ReactFlowProvider>
);

export default App;
