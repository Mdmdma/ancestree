import React, { useCallback, useState, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import FamilyTree from './FamilyTree';
import AppHeader from './AppHeader';
import Sidebar from './Sidebar';
import Login from './Login';
import AdminPanel from './AdminPanel';
import ContactButton from './ContactButton';
import TermsAcceptanceDialog from './TermsAcceptanceDialog';
import { api, getAuthToken, getSocketServerUrl, setLogoutCallback, setLastFamilyName } from './api';
import { encryptedApi } from './encryptedApi';
import { clearSession, isEncryptionEnabled, getDerivedKey, shouldPauseKeyCheck } from './encryptionSession';
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
  const [completionSettings, setCompletionSettings] = useState(null);
  
  // Terms acceptance state
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [termsStatus, setTermsStatus] = useState(null);

  // Initialize socket connection when authenticated
  const socketData = useSocket(getSocketServerUrl(), isAuthenticated);

  // Handle logout - wrapped in useCallback to maintain stable reference
  const handleLogout = useCallback(() => {
    console.log('🔴🔴🔴 [App] handleLogout CALLED 🔴🔴🔴');
    console.log('[App] Clearing session and logging out user');
    
    // Save family name before clearing user data
    if (user && user.familyName) {
      setLastFamilyName(user.familyName);
    }
    
    api.logout();
    clearSession(); // Clear encryption session
    setIsAuthenticated(false);
    setUser(null);
    console.log('[App] ✅ Logout complete - user should see login screen');
  }, [user]);

  // Set up logout callback and periodic key availability check
  useEffect(() => {
    console.log('🟢 [App] Setting up logout callback and key check');
    
    // Register logout callback
    setLogoutCallback(() => {
      console.log('🔴 [App] Auto-logout triggered - encryption key unavailable');
      handleLogout();
    });
    
    // Set up periodic check for encryption key availability (every 500ms)
    const keyCheckInterval = setInterval(() => {
      // Only check if user is authenticated
      if (!isAuthenticated) return;
      
      // Skip check if paused (during sensitive operations)
      if (shouldPauseKeyCheck()) {
        return;
      }
      
      // Check if encryption is enabled but no key is available
      const encryptionEnabled = isEncryptionEnabled();
      const hasKey = getDerivedKey() !== null;
      
      if (encryptionEnabled && !hasKey) {
        console.error('❌ [App] Encryption enabled but no key available - triggering auto-logout');
        handleLogout();
      }
    }, 500);
    
    // Cleanup
    return () => {
      console.log('🟡 [App] Cleaning up logout callback and key check');
      setLogoutCallback(null);
      clearInterval(keyCheckInterval);
    };
  }, [handleLogout, isAuthenticated]);

  // Check authentication on app load
  useEffect(() => {
    const checkAuth = async () => {
      const token = getAuthToken();
      if (token) {
        try {
          const result = await api.verifyToken();
          setIsAuthenticated(true);
          setUser(result.user);
          
          // CRITICAL: After page refresh, check if encryption is enabled
          // If it is, we need to log out because we don't have the decryption key
          try {
            const settings = await api.getFamilySettings();
            if (settings.encryptionEnabled) {
              console.error('❌ [App] Encryption enabled but no session after page refresh - logging out');
              // Force logout immediately
              api.logout();
              clearSession();
              setIsAuthenticated(false);
              setUser(null);
              // Save family name for auto-fill
              if (result.user && result.user.familyName) {
                setLastFamilyName(result.user.familyName);
              }
            }
          } catch (settingsError) {
            console.error('[App] Failed to check encryption settings:', settingsError);
          }
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
    // Store the family name for auto-fill after forced logout
    setLastFamilyName(userData.familyName);
    // Note: Encryption session is initialized in Login.jsx via initializeSession()
    
    // Check if user needs to accept new terms
    try {
      const status = await api.getTermsStatus();
      setTermsStatus(status);
      if (status.needsAcceptance) {
        setShowTermsDialog(true);
      }
    } catch (err) {
      console.error('[App] Failed to check terms status:', err);
      // Don't block login if terms check fails
    }
  };

  // Handle terms acceptance
  const handleTermsAccepted = () => {
    setShowTermsDialog(false);
    setTermsStatus(prev => prev ? { ...prev, needsAcceptance: false } : null);
  };

  const handleTermsDialogClose = () => {
    setShowTermsDialog(false);
    // User can close without accepting, but dialog will show again on next login
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
                onCompletionSettingsLoad={setCompletionSettings}
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
          completionSettings={completionSettings}
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

      {/* Terms Acceptance Dialog */}
      {isAuthenticated && (
        <TermsAcceptanceDialog
          isOpen={showTermsDialog}
          onClose={handleTermsDialogClose}
          onAccepted={handleTermsAccepted}
          currentVersion={termsStatus?.currentVersion}
          userAcceptedVersion={termsStatus?.userAcceptedVersion}
        />
      )}

      {/* Contact Button - Only shown when authenticated */}
      {isAuthenticated && <ContactButton />}
    </div>
  );
};

const App = () => (
  <ReactFlowProvider>
    <AddNodeOnEdgeDrop />
  </ReactFlowProvider>
);

export default App;
