import React, { useCallback, useState, useEffect } from 'react';
import { ReactFlowProvider, useReactFlow, useNodesState, useEdgesState, useUpdateNodeInternals, addEdge } from '@xyflow/react';
import FamilyTree from './FamilyTree';
import AppHeader from './AppHeader';
import Sidebar from './Sidebar';
import Login from './Login';
import { api, getAuthToken } from './api';
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
  const [isLoginExpanded, setIsLoginExpanded] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const { fitView } = useReactFlow();

  // Check authentication on app load
  useEffect(() => {
    const checkAuth = async () => {
      const token = getAuthToken();
      if (token) {
        try {
          const result = await api.verifyToken();
          setIsAuthenticated(true);
          setUser(result.user);
        } catch (error) {
          console.log('Token invalid, please login again');
          api.logout();
          setIsAuthenticated(false);
          setIsLoginExpanded(true);
        }
      } else {
        setIsLoginExpanded(true);
      }
      setCheckingAuth(false);
    };

    checkAuth();
  }, []);

  // Handle successful login
  const handleLoginSuccess = (userData) => {
    setIsAuthenticated(true);
    setUser(userData);
    setIsLoginExpanded(false);
  };

  // Handle logout
  const handleLogout = () => {
    api.logout();
    setIsAuthenticated(false);
    setUser(null);
    setIsLoginExpanded(true);
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
      updateNode: data.updateNode,
      refreshData: data.refreshData
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

      const response = await api.updateNode(nodeId, { position: node.position, data: newData });
      
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
  }, [nodes, treeOperations]);

  const updateNodeDataAndPosition = useCallback(async (nodeId, newData, newPosition) => {
    try {
      const currentNode = nodes.find(n => n.id === nodeId);
      if (!currentNode) {
        console.error('Node not found:', nodeId);
        return;
      }

      const finalPosition = newPosition || currentNode.position;
      
      const response = await api.updateNode(nodeId, { position: finalPosition, data: newData });
      
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
  }, [nodes, treeOperations]);

  const deleteNode = useCallback(async (nodeId) => {
    try {
      await api.deleteNode(nodeId);
      
      setNodes((nds) => nds.filter(node => node.id !== nodeId));
      setEdges((eds) => eds.filter(edge => edge.source !== nodeId && edge.target !== nodeId));
      
      setSelectedNode(null);
    } catch (error) {
      console.error('Failed to delete node:', error);
    }
  }, []);

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
    const person = nodes.find(node => node.id === personId);
    if (person) {
      setSelectedNode(person);
      setTimeout(() => {
        if (treeOperations?.fitTreeToView) {
          treeOperations.fitTreeToView({
            padding: 0.3,
            duration: 1000,
            nodes: [{ id: personId }]
          });
        }
      }, 150);
    }
  }, [nodes, treeOperations]);

  const handleTaggingModeChange = useCallback((isTagging) => {
    setIsTaggingMode(isTagging);
  }, []);

  const handleMapModeChange = useCallback((isMapActive) => {
    setIsMapMode(isMapActive);
  }, []);

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      width: '100vw',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      {/* Login Component */}
      <Login 
        onLoginSuccess={handleLoginSuccess}
        isExpanded={isLoginExpanded}
        onToggleExpanded={() => setIsLoginExpanded(!isLoginExpanded)}
      />

      {/* Main Content */}
      <div style={{ 
        flex: 1, 
        minWidth: 0,
        overflow: 'hidden',
        marginLeft: isLoginExpanded ? '320px' : '60px',
        transition: 'margin-left 0.3s ease'
      }}>
        {checkingAuth ? (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            fontSize: '18px',
            color: '#666'
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
            color: '#666'
          }}>
            <div>🔐</div>
            <div>Please login to access your family tree</div>
          </div>
        ) : (
          <>
            <AppHeader user={user} onLogout={handleLogout} />
            <div style={{ width: '100%', height: 'calc(100vh - 120px)' }}>
              <FamilyTree 
                selectedNode={selectedNode}
                setSelectedNode={setSelectedNode}
                showDebug={showDebug}
                setDebugInfo={setDebugInfo}
                isTaggingMode={isTaggingMode}
                isMapMode={isMapMode}
                onNodeUpdate={handleTreeUpdate}
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
          deleteNode={deleteNode}
          nodeHasConnections={nodeHasConnections}
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
