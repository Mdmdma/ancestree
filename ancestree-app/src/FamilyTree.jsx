import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  Background,
  ReactFlow,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react';
import { appConfig } from './config';
import ELK from 'elkjs/lib/elk.bundled.js';
import PersonNode from './PersonNode';
import FamilyNode from './FamilyNode';
import PartnerEdge from './PartnerEdge';
import BloodlineEdge from './BloodlineEdge';
import BloodlineEdgeHidden from './BloodlineEdgeHidden';
import BloodlineEdgeFake from './BloodlineEdgeFake';
import ElkDebugOverlay from './ElkDebugOverlay';
import { api } from './api';
import { encryptedApi } from './encryptedApi';
import { useDebounce } from './hooks/useDebounce';
import { isEncryptionEnabled, getDerivedKey, isBatchOperationInProgress } from './encryptionSession';
import { decryptNodeData, decryptEdgeData } from './encryptedApi';
import { queueBatchGeocoding } from './geocodingService';

import '@xyflow/react/dist/style.css';

const nodeTypes = {
  person: PersonNode,
  family: FamilyNode,
};

const edgeTypes = {
  partner: PartnerEdge,
  expartner: PartnerEdge,
  bloodline: BloodlineEdge,
  bloodlinehidden: BloodlineEdgeHidden,
  bloodlinefake: BloodlineEdgeFake,
};

// Replace incremental id generator with UUID-based generator
const getId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `id-${Math.random().toString(36).slice(2,9)}-${Date.now().toString(36)}`;
};

const nodeOrigin = [0.5, 0];

// Helper function to check if an edge is a partner or expartner edge
const isPartnerEdge = (edge) => {
  return edge.type === 'partner' || edge.type === 'expartner';
};

// Helper function to check if edge has any encrypted properties
// This can be used for debugging/logging purposes
const hasEncryptedProperties = (edge) => {
  // Check common edge properties that might be encrypted
  const propsToCheck = ['type', 'label', 'source', 'target', 'id'];
  
  for (const prop of propsToCheck) {
    if (edge[prop] && typeof edge[prop] === 'string' && edge[prop].startsWith('enc:')) {
      console.warn(`[FamilyTree] Encrypted edge property "${prop}": ${edge[prop].substring(0, 50)}...`);
      return true;
    }
  }
  
  // Check edge data properties
  if (edge.data) {
    for (const [key, value] of Object.entries(edge.data)) {
      if (value && typeof value === 'string' && value.startsWith('enc:')) {
        console.warn(`[FamilyTree] Encrypted edge data property "${key}": ${value.substring(0, 50)}...`);
        return true;
      }
    }
  }
  
  return false;
};

// Helper function to check if node has any encrypted properties
// This can be used for debugging/logging purposes
const hasEncryptedNodeProperties = (node) => {
  if (!node.data) return false;
  
  // Check node data properties for encrypted values
  for (const [key, value] of Object.entries(node.data)) {
    if (value && typeof value === 'string' && value.startsWith('enc:')) {
      console.warn(`[FamilyTree] Encrypted node data property "${key}": ${value.substring(0, 50)}...`);
      return true;
    }
  }
  
  return false;
};

// Helper function to check if a node is on the bloodline
// Family nodes are always considered bloodline nodes
const isBloodlineNode = (node) => {
  return node.type === 'family' || node.data.bloodline;
};

// Validation function for connection rules
const validateConnection = (sourceNode, targetNode, sourceHandle, targetHandle, edges) => {
  // Helper function to count parent handle connections for a node
  const countParentConnections = (node) => {
    return edges.filter(edge => 
      (edge.source === node.id && edge.sourceHandle === 'parent') ||
      (edge.target === node.id && edge.targetHandle === 'parent')
    ).length;
  };
  
  // Prohibit direct Family-to-Family connections
  if (sourceNode.type === 'family' && targetNode.type === 'family') {
    return { 
      isValid: false, 
      message: appConfig.ui.editor.validationMessages.familyToFamily
    };
  }
  
  // Prohibit direct Person parent-to-child connections
  if (sourceNode.type === 'person' && targetNode.type === 'person') {
    if ((sourceHandle === 'parent' && targetHandle === 'child') ||
        (sourceHandle === 'child' && targetHandle === 'parent')) {
      return { 
        isValid: false, 
        message: appConfig.ui.editor.validationMessages.directParentChild
      };
    }
  }
  
  // Check partner handle restrictions for partner nodes
  if (sourceNode.type === 'person' && targetNode.type === 'person' && 
      (sourceHandle?.includes('partner') || targetHandle?.includes('partner'))) {
    
    // Check if source is a partner node trying to use partner handles
    // Allow if target is bloodline (bloodline nodes can connect to partners)
    if (!isBloodlineNode(sourceNode) && sourceHandle?.includes('partner') && !isBloodlineNode(targetNode)) {
      return { 
        isValid: false, 
        message: appConfig.ui.editor.validationMessages.partnerNodePartnerHandle.replace('{name}', sourceNode.data.name)
      };
    }
    
    // Check if target is a partner node trying to use partner handles
    // Allow if source is bloodline (bloodline nodes can connect to partners)
    if (!isBloodlineNode(targetNode) && targetHandle?.includes('partner') && !isBloodlineNode(sourceNode)) {
      return { 
        isValid: false, 
        message: appConfig.ui.editor.validationMessages.partnerNodePartnerHandle.replace('{name}', targetNode.data.name)
      };
    }
    
    // Check if source partner node already has a partner connection
    if (!isBloodlineNode(sourceNode) && sourceHandle?.includes('partner')) {
      const existingPartnerConnections = edges.filter(edge => 
        isPartnerEdge(edge) && 
        (edge.source === sourceNode.id || edge.target === sourceNode.id)
      );
      if (existingPartnerConnections.length >= 1) {
        return { 
          isValid: false, 
          message: appConfig.ui.editor.validationMessages.partnerNodeMultiplePartners.replace('{name}', sourceNode.data.name)
        };
      }
    }
    
    // Check if target partner node already has a partner connection
    if (!isBloodlineNode(targetNode) && targetHandle?.includes('partner')) {
      const existingPartnerConnections = edges.filter(edge => 
        isPartnerEdge(edge) && 
        (edge.source === targetNode.id || edge.target === targetNode.id)
      );
      if (existingPartnerConnections.length >= 1) {
        return { 
          isValid: false, 
          message: appConfig.ui.editor.validationMessages.partnerNodeMultiplePartners.replace('{name}', targetNode.data.name)
        };
      }
    }
    
    // Prohibit partner connections between two bloodline nodes
    if (isBloodlineNode(sourceNode) && isBloodlineNode(targetNode)) {
      return { 
        isValid: false, 
        message: appConfig.ui.editor.validationMessages.bloodlineToBloodlinePartner
      };
    }
  }
  
  // Check parent handle restrictions for partner nodes
  if (sourceNode.type === 'person' && !isBloodlineNode(sourceNode) && sourceHandle === 'parent') {
    return { 
      isValid: false, 
      message: appConfig.ui.editor.validationMessages.partnerNodeParentHandle.replace('{name}', sourceNode.data.name)
    };
  }
  
  if (targetNode.type === 'person' && !isBloodlineNode(targetNode) && targetHandle === 'parent') {
    return { 
      isValid: false, 
      message: appConfig.ui.editor.validationMessages.partnerNodeParentHandle.replace('{name}', targetNode.data.name)
    };
  }
  
  // Check parent handle restrictions for bloodline nodes with multiple connections
  if (sourceNode.type === 'person' && isBloodlineNode(sourceNode) && sourceHandle === 'parent') {
    const parentConnectionCount = countParentConnections(sourceNode);
    if (parentConnectionCount >= 1) {
      return { 
        isValid: false, 
        message: appConfig.ui.editor.validationMessages.bloodlineMultipleParents
          .replace('{name}', sourceNode.data.name)
          .replace('{count}', parentConnectionCount.toString())
      };
    }
  }
  
  if (targetNode.type === 'person' && isBloodlineNode(targetNode) && targetHandle === 'parent') {
    const parentConnectionCount = countParentConnections(targetNode);
    if (parentConnectionCount >= 1) {
      return { 
        isValid: false, 
        message: appConfig.ui.editor.validationMessages.bloodlineMultipleParents
          .replace('{name}', targetNode.data.name)
          .replace('{count}', parentConnectionCount.toString())
      };
    }
  }
  
  return { isValid: true, message: null };
};

const FamilyTree = ({ 
  setSelectedNode, 
  showDebug, 
  onNodeUpdate,
  socketData
}) => {
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [elkDebugData, setElkDebugData] = useState(null);
  const [showElkDebug, setShowElkDebug] = useState(false);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [initialFitDone, setInitialFitDone] = useState(false);
  const [reactFlowReady, setReactFlowReady] = useState(false);
  const [batchOperationActive, setBatchOperationActive] = useState(false);

  // Real-time collaboration setup - use provided socket data
  const { socket, isConnected, userCount, isCollaborating } = socketData || {};
  const [, setRecentChanges] = useState(new Set());
  
  // Track deletion attempts to prevent duplicates
  const deletionAttemptsRef = useRef(new Set());

  // Track edge drag start position for minimum drag distance
  const edgeDragStartRef = useRef(null);

  // Debounced position update for real-time collaboration
  const [debouncedPositionUpdate] = useDebounce((nodeId, position) => {
    if (socket && isCollaborating) {
      socket.emit('node:position', { nodeId, position });
    }
  }, 300);

  // Monitor batch operation status to pause renders during encryption operations
  useEffect(() => {
    const checkBatchOperation = setInterval(() => {
      const isBatchActive = isBatchOperationInProgress();
      if (isBatchActive !== batchOperationActive) {
        setBatchOperationActive(isBatchActive);
        if (isBatchActive) {
          console.log('[FamilyTree] Batch operation started - pausing renders and interactions');
        } else {
          console.log('[FamilyTree] Batch operation ended - resuming normal operation');
        }
      }
    }, 500); // Check every 500ms
    
    return () => clearInterval(checkBatchOperation);
  }, [batchOperationActive]);

  // Update edges and nodes with debug mode information when showDebug changes
  useEffect(() => {
    setEdges((currentEdges) =>
      currentEdges.map((edge) => ({
        ...edge,
        data: { ...edge.data, isDebugMode: showDebug }
      }))
    );
    
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        data: { ...node.data, isDebugMode: showDebug }
      }))
    );
    
    // Clear ELK debug data when debug mode is turned off
    if (!showDebug) {
      setElkDebugData(null);
      setShowElkDebug(false);
    }
  }, [showDebug, setEdges, setNodes]);

  // Real-time collaboration event listeners
  useEffect(() => {
    if (!socket) return;

    // Helper function to add visual feedback for recent changes
    const addRecentChangeIndicator = (nodeId) => {
      setRecentChanges(prev => new Set([...prev, nodeId]));
      setTimeout(() => {
        setRecentChanges(prev => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        // Clear the visual indicator from node data
        setNodes(nds => nds.map(n => 
          n.id === nodeId 
            ? { ...n, data: { ...n.data, isRecentChange: false } }
            : n
        ));
      }, 2000);
    };

    // Listen for remote node creation
    socket.on('node:created', async (remoteNode) => {
      console.log('[SOCKET] Received node:created event for node:', remoteNode.id, 'Current socket ID:', socket.id);
      
      // Decrypt the node if encryption is enabled
      let nodeToAdd = remoteNode;
      if (isEncryptionEnabled() && getDerivedKey()) {
        try {
          nodeToAdd = await decryptNodeData(remoteNode);
          console.log('[SOCKET] Decrypted node:', nodeToAdd.id);
        } catch (error) {
          console.error('[SOCKET] Failed to decrypt node:', error);
          // Continue with encrypted node instead of triggering logout
        }
      }
      
      setNodes(nds => {
        // Check if node already exists to prevent duplicates
        if (nds.find(n => n.id === nodeToAdd.id)) {
          console.log('[SOCKET] Node already exists, skipping:', nodeToAdd.id);
          return nds;
        }
        console.log('[SOCKET] Adding new node:', nodeToAdd.id);
        return [...nds, nodeToAdd];
      });
      addRecentChangeIndicator(nodeToAdd.id);
    });

    // Listen for remote node updates
    socket.on('node:updated', async (remoteNode) => {
      console.log('Remote node updated:', remoteNode);
      
      // Decrypt the node if encryption is enabled
      let nodeToUpdate = remoteNode;
      if (isEncryptionEnabled() && getDerivedKey()) {
        try {
          nodeToUpdate = await decryptNodeData(remoteNode);
          console.log('[SOCKET] Decrypted updated node:', nodeToUpdate.id);
        } catch (error) {
          console.error('[SOCKET] Failed to decrypt updated node:', error);
          // Continue with encrypted node instead of triggering logout
        }
      }
      
      // Preserve client-side UI state when applying remote updates
      setNodes(nds => nds.map(n => {
        if (n.id !== nodeToUpdate.id) return n;
        
        // Merge updates while preserving client-only UI state
        return {
          ...n,
          ...nodeToUpdate,
          data: {
            ...n.data,              // Keep existing data first
            ...nodeToUpdate.data,    // Apply data updates from server
            isRecentChange: true,    // Mark as recently changed
            isDebugMode: n.data.isDebugMode  // Preserve debug mode (client-only)
            // Note: isSelected is NOT in node.data anymore (Strategy 3)
          },
          selected: n.selected  // Preserve React Flow's selection state
        };
      }));
      addRecentChangeIndicator(nodeToUpdate.id);
    });

    // Listen for remote node deletions
    socket.on('node:deleted', ({ id }) => {
      console.log('Remote node deleted:', id);
      setNodes(nds => nds.filter(n => n.id !== id));
    });

    // Listen for remote node position updates
    socket.on('node:position', ({ nodeId, position, updatedBy }) => {
      // Don't apply our own position updates
      if (updatedBy === socket.id) return;
      
      // Preserve client-side UI state when updating position
      setNodes(nds => nds.map(n => 
        n.id === nodeId 
          ? { 
              ...n, 
              position,
              // Preserve selection state and other UI properties
              selected: n.selected,
              data: {
                ...n.data,
                isDebugMode: n.data.isDebugMode
              }
            }
          : n
      ));
    });

    // Listen for remote edge creation
    socket.on('edge:created', async (remoteEdge) => {
      console.log('Remote edge created:', remoteEdge);
      
      // Decrypt the edge if encryption is enabled
      let edgeToAdd = remoteEdge;
      if (isEncryptionEnabled() && getDerivedKey()) {
        try {
          edgeToAdd = await decryptEdgeData(remoteEdge);
          console.log('[SOCKET] Decrypted created edge:', edgeToAdd.id);
        } catch (error) {
          console.error('[SOCKET] Failed to decrypt created edge:', error);
          // Continue with encrypted edge instead of triggering logout
        }
      }
      
      setEdges(eds => {
        // Check if edge already exists to prevent duplicates
        if (eds.find(e => e.id === edgeToAdd.id)) {
          console.log('Edge already exists locally, skipping:', edgeToAdd.id);
          return eds;
        }
        console.log('Adding remote edge to local state:', edgeToAdd.id);
        return [...eds, edgeToAdd];
      });
    });

    // Listen for remote edge updates
    socket.on('edge:updated', async (remoteEdge) => {
      console.log('Remote edge updated:', remoteEdge);
      
      // Decrypt the edge if encryption is enabled
      let edgeToUpdate = remoteEdge;
      if (isEncryptionEnabled() && getDerivedKey()) {
        try {
          edgeToUpdate = await decryptEdgeData(remoteEdge);
          console.log('[SOCKET] Decrypted updated edge:', edgeToUpdate.id);
        } catch (error) {
          console.error('[SOCKET] Failed to decrypt updated edge:', error);
          // Continue with encrypted edge instead of triggering logout
        }
      }
      
      setEdges(eds => eds.map(e => 
        e.id === edgeToUpdate.id 
          ? { ...e, ...edgeToUpdate }
          : e
      ));
    });

    // Listen for remote edge deletions
    socket.on('edge:deleted', ({ id }) => {
      console.log('Remote edge deleted:', id);
      setEdges(eds => eds.filter(e => e.id !== id));
    });

    // Cleanup listeners on unmount
    return () => {
      socket.off('node:created');
      socket.off('node:updated');
      socket.off('node:deleted');
      socket.off('node:position');
      socket.off('edge:created');
      socket.off('edge:updated');
      socket.off('edge:deleted');
      socket.off('edge:deleted');
    };
  }, [socket, setNodes, setEdges]);

  // Handle node changes including position updates
  const handleNodesChange = useCallback(async (changes) => {
    onNodesChange(changes);
    
    // Handle different types of node changes
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        if (change.dragging) {
          // During drag: only emit to other users, don't save to DB yet
          debouncedPositionUpdate(change.id, change.position);
        } else {
          // After drag: save to database
          try {
            const node = nodes.find(n => n.id === change.id);
            if (node) {
              await encryptedApi.updateNode(change.id, { 
                position: change.position, 
                data: node.data 
              }, socket?.id);
            }
          } catch (error) {
            console.error('Failed to update node position:', error);
          }
        }
      } else if (change.type === 'remove') {
        // Handle node deletions - only delete from database
        // React Flow will only allow deletion if no edges are connected
        console.log('FamilyTree: Handling node deletion for node:', change.id);
        
        // Check if we're already processing this deletion
        if (deletionAttemptsRef.current.has(change.id)) {
          console.log('FamilyTree: Deletion already in progress for node:', change.id);
          continue;
        }
        
        // Mark this deletion as in progress
        deletionAttemptsRef.current.add(change.id);
        
        try {
          await encryptedApi.deleteNode(change.id);
          console.log('FamilyTree: Successfully deleted node:', change.id);
        } catch (error) {
          console.error('Failed to delete node:', error);
        } finally {
          // Remove from tracking set after completion (success or failure)
          setTimeout(() => {
            deletionAttemptsRef.current.delete(change.id);
          }, 1000); // 1 second delay to handle potential race conditions
        }
      }
    }
  }, [onNodesChange, nodes, debouncedPositionUpdate, socket]);

  // Handle edge changes including deletions
  const handleEdgesChange = useCallback(async (changes) => {
    onEdgesChange(changes);
    
    // Handle edge deletions
    for (const change of changes) {
      if (change.type === 'remove') {
        try {
          await encryptedApi.deleteEdge(change.id);
        } catch (error) {
          console.error('Failed to delete edge:', error);
        }
      }
    }
  }, [onEdgesChange]);

  // Load initial data from database
  useEffect(() => {
    const loadData = async () => {
      try {
        const [nodesData, edgesData] = await Promise.all([
          encryptedApi.loadNodes(),
          encryptedApi.loadEdges()
        ]);
        
        // Ensure nodes have proper React Flow properties
        const processedNodes = nodesData.map(node => ({
          ...node,
          deletable: true, // Explicitly enable deletion
          selectable: true,
          data: {
            ...node.data,
            // Provide defaults for new fields if they don't exist
            // Family nodes are always on the bloodline
            bloodline: node.type === 'family' ? true : (node.data.bloodline !== undefined ? node.data.bloodline : true),
            isDebugMode: showDebug // Add debug mode to node data
            // isRecentChange removed - transient UI state
            // isSelected removed - managed by App.jsx and React Flow (Strategy 3)
          }
        }));
        
        setNodes(processedNodes);
        
        // Ensure edges have proper React Flow properties
        const processedEdges = edgesData.map(edge => ({
          ...edge,
          data: {
            isDebugMode: showDebug,
            ...edge.data // Preserve any existing data
          }
        }));
        
        setEdges(processedEdges);
        
        // Queue geocoding check for all nodes (will run in background)
        // Only geocodes nodes where address hash has changed
        console.log('[FamilyTree] Queuing geocoding check for loaded nodes');
        queueBatchGeocoding(processedNodes);
        
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [setNodes, setEdges, showDebug]);

  // Fit view when BOTH ReactFlow is ready AND nodes are loaded
  useEffect(() => {
    console.log('[FIT VIEW] Check conditions - reactFlowReady:', reactFlowReady, 'loading:', loading, 'nodes:', nodes.length, 'initialFitDone:', initialFitDone);
    if (reactFlowReady && !loading && nodes.length > 0 && !initialFitDone) {
      // Wait a bit for nodes to fully render
      const timer = setTimeout(() => {
        console.log('[FIT VIEW] Calling fitView');
        try {
          fitView({ 
            padding: 0.2,
            duration: 0
          });
          setInitialFitDone(true);
          console.log('[FIT VIEW] Fit view completed successfully');
        } catch (error) {
          console.error('[FIT VIEW] Error calling fitView:', error);
        }
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [reactFlowReady, loading, nodes.length, fitView, initialFitDone]);

  // Function to refresh data from database (for ensuring sync)
  const refreshData = useCallback(async () => {
    try {
      const [nodesData, edgesData] = await Promise.all([
        encryptedApi.loadNodes(),
        encryptedApi.loadEdges()
      ]);
      
      // Process nodes with React Flow properties
      const processedNodes = nodesData.map(node => ({
        ...node,
        deletable: true,
        selectable: true,
        data: {
          ...node.data,
          bloodline: node.type === 'family' ? true : (node.data.bloodline !== undefined ? node.data.bloodline : true),
          isDebugMode: showDebug // Add debug mode to node data
          // isRecentChange removed - transient UI state
          // isSelected removed - managed by App.jsx and React Flow (Strategy 3)
        }
      }));
      
      // Process edges with debug mode information
      const processedEdges = edgesData.map(edge => ({
        ...edge,
        data: {
          isDebugMode: showDebug,
          ...edge.data
        }
      }));
      
      setNodes(processedNodes);
      setEdges(processedEdges);
      
      // Queue geocoding check for all nodes
      console.log('[FamilyTree] Queuing geocoding check after refresh');
      queueBatchGeocoding(processedNodes);
      setEdges(processedEdges);
    } catch (error) {
      console.error('❌ [FamilyTree] Failed to refresh data:', error);
    }
  }, [setNodes, setEdges, showDebug]);

  // Auto layout using ELK
  const autoLayout = useCallback(async () => {
    if (nodes.length === 0) return;

    try {
      const elk = new ELK();

      // Find all bloodline nodes (nodes with bloodline: true)
      const bloodlineNodes = nodes.filter(node => 
        node.type === 'person' && isBloodlineNode(node)
      );

      // Create ELK clusters for each bloodline node
      const elkClusters = [];
      const processedNodes = new Set();

      for (const bloodlineNode of bloodlineNodes) {
        if (processedNodes.has(bloodlineNode.id)) continue;

        // Find all partners of this bloodline node
        const partnerEdges = edges.filter(edge => 
          isPartnerEdge(edge) && 
          (edge.source === bloodlineNode.id || edge.target === bloodlineNode.id)
        );

        const partners = partnerEdges.map(edge => {
          const partnerId = edge.source === bloodlineNode.id ? edge.target : edge.source;
          const partner = nodes.find(n => n.id === partnerId);
          const isLeftPartner = (edge.source === bloodlineNode.id && edge.sourceHandle === 'partner-left') ||
                               (edge.target === bloodlineNode.id && edge.targetHandle === 'partner-left');
          return { node: partner, isLeft: isLeftPartner, edge };
        }).filter(p => p.node);

        // Find all family nodes connected through children handle
        const childFamilyEdges = edges.filter(edge => 
          (edge.source === bloodlineNode.id && edge.sourceHandle === 'child') ||
          (partners.some(p => edge.source === p.node.id && edge.sourceHandle === 'child'))
        );

        const familyNodes = childFamilyEdges.map(edge => {
          const familyNode = nodes.find(n => n.id === edge.target && n.type === 'family');
          return { node: familyNode, edge };
        }).filter(f => f.node);

        // Create ELK cluster
        const clusterNodes = [];
        
        // Add main bloodline node
        clusterNodes.push({
          id: bloodlineNode.id,
          width: 150,
          height: 60,
          x: 0,
          y: 0
        });

        // Add left partners (sorted by connection order)
        const leftPartners = partners.filter(p => p.isLeft);
        leftPartners.sort((a, b) => {
          // Sort by number of connections to reduce crossings
          const aConnections = edges.filter(e => e.source === a.node.id || e.target === a.node.id).length;
          const bConnections = edges.filter(e => e.source === b.node.id || e.target === b.node.id).length;
          return bConnections - aConnections; // More connected partners closer to center
        });
        
        leftPartners.forEach((partner, index) => {
          clusterNodes.push({
            id: partner.node.id,
            width: 150,
            height: 60,
            x: -(index + 1) * 180, // Reduced spacing for more compact layout
            y: 0
          });
          processedNodes.add(partner.node.id);
        });

        // Add right partners (sorted by connection order)
        const rightPartners = partners.filter(p => !p.isLeft);
        rightPartners.sort((a, b) => {
          // Sort by number of connections to reduce crossings
          const aConnections = edges.filter(e => e.source === a.node.id || e.target === a.node.id).length;
          const bConnections = edges.filter(e => e.source === b.node.id || e.target === b.node.id).length;
          return bConnections - aConnections; // More connected partners closer to center
        });
        
        rightPartners.forEach((partner, index) => {
          clusterNodes.push({
            id: partner.node.id,
            width: 150,
            height: 60,
            x: (index + 1) * 180, // Reduced spacing for more compact layout
            y: 0
          });
          processedNodes.add(partner.node.id);
        });

        // Add family nodes 100px below with better positioning and sorting
        familyNodes.sort((a, b) => {
          // Sort family nodes by the average X position of their feeding nodes
          const getFeedingAvgX = (family) => {
            const feedingEdges = edges.filter(edge => 
              edge.target === family.node.id && 
              (edge.type === 'bloodline' || edge.type === 'bloodlinefake')
            );
            
            const feedingNodes = feedingEdges
              .map(edge => clusterNodes.find(n => n.id === edge.source))
              .filter(Boolean);
              
            if (feedingNodes.length > 0) {
              return feedingNodes.reduce((sum, node) => sum + node.x, 0) / feedingNodes.length;
            }
            
            // Fallback: use all parent nodes in cluster
            const allParentNodes = [
              clusterNodes.find(n => n.id === bloodlineNode.id),
              ...clusterNodes.filter(n => partners.some(p => p.node.id === n.id))
            ].filter(Boolean);
            
            return allParentNodes.length > 0 
              ? allParentNodes.reduce((sum, node) => sum + node.x, 0) / allParentNodes.length
              : 0;
          };
          
          return getFeedingAvgX(a) - getFeedingAvgX(b);
        });
        
        familyNodes.forEach((family, index) => {
          // Calculate x position as average of feeding nodes
          const feedingNodes = [];
          
          // Find all edges feeding into this family node
          const feedingEdges = edges.filter(edge => 
            edge.target === family.node.id && 
            (edge.type === 'bloodline' || edge.type === 'bloodlinefake')
          );

          feedingEdges.forEach(edge => {
            const sourceNode = clusterNodes.find(n => n.id === edge.source);
            if (sourceNode) {
              feedingNodes.push(sourceNode);
            }
          });

          let avgX;
          if (feedingNodes.length > 0) {
            avgX = feedingNodes.reduce((sum, node) => sum + node.x, 0) / feedingNodes.length;
          } else {
            // If no feeding nodes found, position based on bloodline node and partners
            const allParentNodes = [
              clusterNodes.find(n => n.id === bloodlineNode.id),
              ...clusterNodes.filter(n => partners.some(p => p.node.id === n.id))
            ].filter(Boolean);
            
            if (allParentNodes.length > 0) {
              avgX = allParentNodes.reduce((sum, node) => sum + node.x, 0) / allParentNodes.length;
            } else {
              // Final fallback: distribute evenly based on sorted order
              const totalWidth = clusterNodes.length > 1 
                ? Math.max(...clusterNodes.map(n => n.x)) - Math.min(...clusterNodes.map(n => n.x))
                : 400;
              avgX = (index - (familyNodes.length - 1) / 2) * Math.max(200, totalWidth / Math.max(1, familyNodes.length - 1));
            }
          }

          clusterNodes.push({
            id: family.node.id,
            width: 80,
            height: 80,
            x: avgX,
            y: 100
          });
        });

        // Calculate cluster bounds
        const minX = Math.min(...clusterNodes.map(n => n.x - n.width/2));
        const maxX = Math.max(...clusterNodes.map(n => n.x + n.width/2));
        const minY = Math.min(...clusterNodes.map(n => n.y - n.height/2));
        const maxY = Math.max(...clusterNodes.map(n => n.y + n.height/2));

        elkClusters.push({
          bloodlineNode,
          clusterNodes,
          bounds: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY }
        });

        processedNodes.add(bloodlineNode.id);
      }

      // Create ELK graph with clusters as nodes and bloodline connections as edges
      const elkGraph = {
        id: "root",
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'DOWN',
          'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
          'elk.layered.crossingMinimization.semiInteractive': 'true',
          'elk.layered.crossingMinimization.hierarchicalSweepiness': '0.9', // High value to respect port positions
          'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
          'elk.layered.nodePlacement.favorStraightEdges': 'true', // Prefer straight edges
          'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
          'elk.layered.considerModelOrder.portModelOrder': 'true', // Respect port order
          'elk.layered.considerModelOrder.crossingCounterPortInfluence': '0.8', // Ports influence crossing
          'elk.separateConnectedComponents': 'false',
          'elk.layered.thoroughness': '7', // Higher thoroughness for better optimization
          'elk.spacing.portPort': '15', // Space between ports
          'elk.spacing.nodeNode': '80' // Space between clusters
        },
        children: [],
        edges: []
      };

      // Add clusters as ELK nodes with ports for family nodes
      elkClusters.forEach((cluster, index) => {
        // Count bloodline connections to determine priority
        const connectionCount = edges.filter(edge => 
          (edge.type === 'bloodline' || edge.type === 'bloodlinehidden') &&
          (cluster.clusterNodes.some(n => n.id === edge.source) ||
           cluster.clusterNodes.some(n => n.id === edge.target))
        ).length;
        
        // Create ports for each family node in this cluster
        const familyNodesInCluster = cluster.clusterNodes.filter(n => 
          nodes.find(node => node.id === n.id && node.type === 'family')
        );
        
        // Sort family nodes by their X position for consistent port ordering
        familyNodesInCluster.sort((a, b) => a.x - b.x);
        
        // Create individual ports for each external edge from family nodes
        const ports = [];
        let portIndex = 0;
        
        familyNodesInCluster.forEach(familyNode => {
          // Find all edges connected to this family node that go outside the cluster
          const externalEdges = edges.filter(edge => {
            const isConnectedToFamily = edge.source === familyNode.id || edge.target === familyNode.id;
            if (!isConnectedToFamily) return false;
            
            // Check if the other end of the edge is outside this cluster
            const otherNodeId = edge.source === familyNode.id ? edge.target : edge.source;
            const isOtherNodeInCluster = cluster.clusterNodes.some(n => n.id === otherNodeId);
            return !isOtherNodeInCluster;
          });
          
          // Create a dedicated port for each external edge
          externalEdges.forEach((edge, edgeIndex) => {
            const otherNodeId = edge.source === familyNode.id ? edge.target : edge.source;
            const targetClusterIndex = elkClusters.findIndex(c => 
              c.clusterNodes.some(n => n.id === otherNodeId)
            );
            
            let primaryTargetType = 'external';
            
            if (targetClusterIndex !== -1) {
              primaryTargetType = `cluster-${targetClusterIndex}`;
            }
            
            // Determine port side and position - always on bottom (SOUTH side)
            let portSide = 'SOUTH';
            let basePortX = familyNode.x - cluster.bounds.minX + 50;
            let portY = cluster.bounds.height + 100;
            
            // Calculate port X position with spacing for multiple ports from the same family node
            const portSpacing = 25; // Distance between ports from the same family node
            const portOffset = (edgeIndex - (externalEdges.length - 1) / 2) * portSpacing;
            let portX = basePortX + portOffset;
            
            // Ensure port X position is within cluster bounds with some padding
            portX = Math.max(15, Math.min(cluster.bounds.width + 85, portX));
            
            // Create port for this specific edge
            ports.push({
              id: `port-family-${familyNode.id}-edge-${edge.id}`,
              layoutOptions: {
                'elk.port.side': portSide,
                'elk.port.index': `${portIndex}`, // Port index for ordering
                'elk.port.anchor': `(${portX}, ${portY})`,
                'elk.port.borderOffset': '0' // Align ports to cluster border
              },
              // Port properties to influence ordering
              properties: {
                'portAlignment': 'BEGIN',
                'portConstraints': 'FIXED_ORDER' // Keep ports in specified order
              },
              // Store metadata for debug purposes and edge mapping
              metadata: {
                familyNodes: [familyNode.id],
                targetGroup: primaryTargetType,
                groupSize: 1,
                familyNodeX: familyNode.x,
                familyNodeY: familyNode.y,
                edgeId: edge.id, // Store the edge ID for mapping
                targetNodeId: otherNodeId,
                portOrder: portIndex, // Explicit port ordering value
                portPositionX: portX // X position for downstream ordering hints
              }
            });
            
            portIndex--;
          });
        });
        
        elkGraph.children.push({
          id: `cluster-${index}`,
          width: cluster.bounds.width + 100,
          height: cluster.bounds.height + 100,
          ports: ports,
          layoutOptions: {
            'elk.priority': `${Math.max(1, connectionCount)}`,
            'elk.portConstraints': 'FIXED_ORDER', // Enforce port ordering
            'elk.layered.crossingMinimization.forceNodeModelOrder': 'true' // Force model order
          }
        });
      });

      // Calculate downstream cluster ordering based on upstream port positions
      // This creates a map of which clusters should be ordered left-to-right
      const downstreamClusterOrdering = new Map();
      
      elkClusters.forEach((sourceCluster, sourceIndex) => {
        const sourcePorts = elkGraph.children[sourceIndex].ports || [];
        
        // Group downstream connections by target cluster and calculate average port X position
        const targetClusterPositions = new Map();
        
        sourcePorts.forEach(port => {
          const targetNodeId = port.metadata?.targetNodeId;
          if (!targetNodeId) return;
          
          // Find which cluster the target node belongs to
          const targetClusterIndex = elkClusters.findIndex(c =>
            c.clusterNodes.some(n => n.id === targetNodeId)
          );
          
          if (targetClusterIndex !== -1 && targetClusterIndex !== sourceIndex) {
            if (!targetClusterPositions.has(targetClusterIndex)) {
              targetClusterPositions.set(targetClusterIndex, []);
            }
            targetClusterPositions.get(targetClusterIndex).push(port.metadata.portPositionX);
          }
        });
        
        // Calculate average port X position for each downstream cluster
        const orderedTargets = Array.from(targetClusterPositions.entries())
          .map(([targetIndex, portXPositions]) => ({
            targetIndex,
            avgPortX: portXPositions.reduce((sum, x) => sum + x, 0) / portXPositions.length
          }))
          .sort((a, b) => b.avgPortX - a.avgPortX); // INVERTED: Sort right-to-left (highest X first)
        
        if (orderedTargets.length > 0) {
          downstreamClusterOrdering.set(sourceIndex, orderedTargets);
        }
      });
      
      // Apply ordering hints to ELK clusters based on downstream relationships
      downstreamClusterOrdering.forEach((orderedTargets, sourceIndex) => {
        orderedTargets.forEach((target, orderIndex) => {
          const targetCluster = elkGraph.children[target.targetIndex];
          if (targetCluster) {
            // Set layer ID and position hint based on port ordering
            targetCluster.layoutOptions = {
              ...targetCluster.layoutOptions,
              'elk.layered.layerChoiceConstraint': `${sourceIndex + 1}`, // Layer after source
              'elk.layered.crossingMinimization.positionChoiceConstraint': `${orderIndex}` // Left-to-right order
            };
          }
        });
      });

      // Create mapping from edges to their specific ports
      const edgeToPortMap = new Map();
      elkGraph.children.forEach((elkCluster, clusterIndex) => {
        elkCluster.ports?.forEach(port => {
          if (port.metadata?.edgeId) {
            edgeToPortMap.set(port.metadata.edgeId, {
              clusterId: `cluster-${clusterIndex}`,
              portId: port.id,
              targetGroup: port.metadata.targetGroup,
              familyNodeId: port.metadata.familyNodes[0]
            });
          }
        });
      });
      
      // Create individual edges for each inter-cluster connection involving family nodes
      edges.forEach(edge => {
        if (edge.type === 'bloodline' || edge.type === 'bloodlinehidden') {
          const sourceNode = nodes.find(n => n.id === edge.source);
          const targetNode = nodes.find(n => n.id === edge.target);
          
          const sourceClusterIndex = elkClusters.findIndex(c => 
            c.clusterNodes.some(n => n.id === edge.source)
          );
          const targetClusterIndex = elkClusters.findIndex(c => 
            c.clusterNodes.some(n => n.id === edge.target)
          );
          
          // Only process inter-cluster edges
          if (sourceClusterIndex !== -1 && targetClusterIndex !== -1 && 
              sourceClusterIndex !== targetClusterIndex) {
            
            // Use source and target as they are (no age-based reordering)
            const finalSourceIndex = sourceClusterIndex;
            const finalTargetIndex = targetClusterIndex;
            
            // Use nodes as they are in the edge
            const effectiveSourceNode = sourceNode;
            const effectiveTargetNode = targetNode;
            
            // Find appropriate ports for this specific edge by looking through all ports
            let sourcePort = null;
            let targetPort = null;

            elkGraph.children.forEach(cluster => {
              cluster.ports?.forEach(port => {
                if (port.metadata?.edgeId === edge.id) {
                  // This port is for our current edge. Is it for the source or target?
                  const portIsForSource = effectiveSourceNode && port.metadata.familyNodes[0] === effectiveSourceNode.id;
                  const portIsForTarget = effectiveTargetNode && port.metadata.familyNodes[0] === effectiveTargetNode.id;

                  if (portIsForSource) {
                    sourcePort = port.id;
                  } else if (portIsForTarget) {
                    targetPort = port.id;
                  }
                }
              });
            });
            
            // Get port metadata for ordering hints
            let sourcePortMeta = null;
            let targetPortMeta = null;
            
            elkGraph.children[finalSourceIndex]?.ports?.forEach(port => {
              if (port.id === sourcePort) sourcePortMeta = port.metadata;
            });
            
            if (finalTargetIndex < elkGraph.children.length) {
              elkGraph.children[finalTargetIndex]?.ports?.forEach(port => {
                if (port.id === targetPort) targetPortMeta = port.metadata;
              });
            }
            
            // Calculate edge priority based on port positions (leftmost gets higher priority)
            const edgePriority = sourcePortMeta ? 
              Math.max(1, Math.floor((sourcePortMeta.portPositionX || 0) / 50)) : 5;
            
            // Create edge with unique ID based on the original edge
            const elkEdge = {
              id: `edge-inter-${edge.id}`,
              sources: [sourcePort ? `${sourcePort}` : `cluster-${finalSourceIndex}`],
              targets: [targetPort ? `${targetPort}` : `cluster-${finalTargetIndex}`],
              layoutOptions: {
                'elk.layered.priority': `${edgePriority}`, // Priority based on port X position
                'elk.layered.crossingMinimization.positionChoiceConstraint': `${sourcePortMeta?.portOrder || 0}`,
                'elk.edgeRouting': 'ORTHOGONAL' // Use orthogonal routing for cleaner edges
              }
            };
            
            elkGraph.edges.push(elkEdge);
          }
        }
      });

      // Run ELK layout
      const layoutedGraph = await elk.layout(elkGraph);

      // Store ELK debug data for overlay (always store for potential debug use)
      setElkDebugData({
        elkGraph,
        elkClusters,
        layoutedGraph,
        edgeToPortMap // Include edge-to-port mapping for debug visualization
      });

      // Apply ELK layout results to clusters while preserving internal structure
      const finalPositions = new Map();
      
      layoutedGraph.children.forEach((layoutedCluster, index) => {
        const cluster = elkClusters[index];
        const clusterX = layoutedCluster.x || 0;
        const clusterY = layoutedCluster.y || 0;

        // Apply the cluster position while preserving the internal relative positions
        cluster.clusterNodes.forEach(clusterNode => {
          finalPositions.set(clusterNode.id, {
            x: clusterX + clusterNode.x - cluster.bounds.minX + 20, // Reduced padding
            y: clusterY + clusterNode.y - cluster.bounds.minY + 20  // Reduced padding
          });
        });
      });

      // Handle remaining family nodes and standalone person nodes
      const remainingNodes = nodes.filter(node => !finalPositions.has(node.id));
      let standaloneX = 0;
      let standaloneY = 0;
      const maxClusterX = Math.max(0, ...Array.from(finalPositions.values()).map(pos => pos.x));
      
      remainingNodes.forEach((node) => {
        if (node.type === 'family') {
          // Position family nodes near their connected nodes
          const connectedEdges = edges.filter(edge => 
            edge.source === node.id || edge.target === node.id
          );
          
          if (connectedEdges.length > 0) {
            const connectedPositions = connectedEdges
              .map(edge => {
                const connectedId = edge.source === node.id ? edge.target : edge.source;
                return finalPositions.get(connectedId);
              })
              .filter(pos => pos);

            if (connectedPositions.length > 0) {
              const avgX = connectedPositions.reduce((sum, pos) => sum + pos.x, 0) / connectedPositions.length;
              const avgY = connectedPositions.reduce((sum, pos) => sum + pos.y, 0) / connectedPositions.length;
              
              finalPositions.set(node.id, {
                x: avgX,
                y: avgY + 100 // Reduced offset for family nodes
              });
            } else {
              finalPositions.set(node.id, { x: maxClusterX + 200 + standaloneX, y: standaloneY });
              standaloneX += 200;
            }
          } else {
            finalPositions.set(node.id, { x: maxClusterX + 200 + standaloneX, y: standaloneY });
            standaloneX += 200;
          }
        } else {
          // Position standalone person nodes in a simple grid layout
          finalPositions.set(node.id, { x: maxClusterX + 200 + standaloneX, y: standaloneY });
          standaloneX += 200;
          if (standaloneX > 600) {
            standaloneX = 0;
            standaloneY += 200;
          }
        }
      });

      // Apply the new positions
      setNodes((nds) =>
        nds.map((node) => {
          const newPosition = finalPositions.get(node.id);
          if (newPosition) {
            return {
              ...node,
              position: newPosition
            };
          }
          return node;
        })
      );

      // Update positions in database
      for (const [nodeId, position] of finalPositions) {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          try {
            await encryptedApi.updateNode(nodeId, { 
              position: position, 
              data: node.data 
            });
          } catch (error) {
            console.error(`Failed to update position for node ${nodeId}:`, error);
          }
        }
      }

    } catch (error) {
      console.error('Auto layout failed:', error);
    }
  }, [nodes, edges, setNodes]);

  // Fit tree to view
  const fitTreeToView = useCallback(() => {
    fitView({ 
      padding: 0.2,
      duration: 800
    });
  }, [fitView]);

  // Zoom to a specific node and show immediate family
  // Adjustable zoom level: 1.5 shows node + immediate family context
  // Lower values (e.g., 1.2) show more context, higher values (e.g., 2.0) show less
  const zoomToNode = useCallback((nodeId) => {
    const targetNode = nodes.find(n => n.id === nodeId);
    if (!targetNode || !targetNode.position) {
      console.warn('[ZoomToNode] Node not found or has no position:', nodeId);
      return;
    }

    // Get connected nodes (parents, partners, children) to calculate bounds
    const connectedNodeIds = new Set([nodeId]);
    
    // Find all edges connected to this node
    edges.forEach(edge => {
      if (edge.source === nodeId) {
        connectedNodeIds.add(edge.target);
      }
      if (edge.target === nodeId) {
        connectedNodeIds.add(edge.source);
      }
    });

    // Get positions of all connected nodes
    const connectedNodes = nodes.filter(n => connectedNodeIds.has(n.id) && n.position);
    
    if (connectedNodes.length === 0) {
      console.warn('[ZoomToNode] No connected nodes found');
      return;
    }

    // Calculate bounding box for connected nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    connectedNodes.forEach(node => {
      const x = node.position.x;
      const y = node.position.y;
      const width = node.width || 200; // Default node width
      const height = node.height || 80; // Default node height
      
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });

    // Calculate center and dimensions
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const width = maxX - minX;
    const height = maxY - minY;

    // Use fitView with calculated bounds
    // This ensures smooth pan and zoom to show the node and immediate family
    fitView({
      nodes: connectedNodes.map(n => ({ id: n.id })),
      duration: 800,
      padding: 0.3,
      // ZOOM LEVEL ADJUSTMENT:
      // Increase minZoom to zoom in more (e.g., 1.8 for closer view)
      // Decrease minZoom to zoom out more (e.g., 1.2 for wider view)
      // Default: 1.5 provides good balance showing node + immediate family
      minZoom: 1.5,
      maxZoom: 1.5
    });

    console.log('[ZoomToNode] Zooming to node:', nodeId, 'with', connectedNodes.length, 'connected nodes');
  }, [nodes, edges, fitView]);

  // Handle ReactFlow initialization - fit view when ready
  const handleInit = useCallback((reactFlowInstance) => {
    console.log('[FIT VIEW] ReactFlow onInit called, nodes:', nodes.length);
    setReactFlowReady(true);
  }, [nodes.length]);

  // Simplified validation - allow all connections
  const isValidConnection = useCallback(() => {
    return true;
  }, []);

  const onConnect = useCallback(
    async (params) => {
      // Get source and target nodes to validate connection
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);
      
      if (!sourceNode || !targetNode) return;
      
      // Validate connection rules
      const validationResult = validateConnection(
        sourceNode, 
        targetNode, 
        params.sourceHandle, 
        params.targetHandle,
        edges
      );
      
      if (!validationResult.isValid) {
        // Show user-friendly message
        console.warn('Connection prohibited:', validationResult.message);
        // Use setTimeout to ensure the message appears after React has processed the connection attempt
        setTimeout(() => {
          alert(`Connection not allowed:\n\n${validationResult.message}`);
        }, 100);
        return;
      }
      
      // Determine edge type based on connection
      let edgeType = 'bloodline';
      if (params.sourceHandle?.includes('partner') || params.targetHandle?.includes('partner')) {
        edgeType = 'partner';
      } else {
        // Check if either node is a partner node (bloodline: false) using child/parent handles
        const sourceIsPartner = !isBloodlineNode(sourceNode);
        const targetIsPartner = !isBloodlineNode(targetNode);
        
        if ((sourceIsPartner || targetIsPartner) && 
            (params.sourceHandle === 'child' || params.sourceHandle === 'parent' ||
             params.targetHandle === 'child' || params.targetHandle === 'parent')) {
          edgeType = 'bloodlinefake';
        }
      }
      
      const newEdge = { 
        ...params, 
        id: getId(), // Generate unique ID for the edge
        type: edgeType, 
        data: { isDebugMode: showDebug } 
      };
      
      // Check if there's an existing hidden bloodline edge in the same position
      const existingHiddenEdge = edges.find(edge => 
        edge.type === 'bloodlinehidden' &&
        edge.source === params.source &&
        edge.target === params.target &&
        edge.sourceHandle === params.sourceHandle &&
        edge.targetHandle === params.targetHandle
      );
      
      try {
        if (existingHiddenEdge) {
          // Replace hidden bloodline edge with normal bloodline edge
          await encryptedApi.deleteEdge(existingHiddenEdge.id);
          
          const replacementEdge = {
            ...existingHiddenEdge,
            type: edgeType, // Use the determined edge type (bloodline, bloodlinefake, or partner)
            id: getId(), // Generate new ID
            data: { isDebugMode: showDebug }
          };
          
          await encryptedApi.createEdge(replacementEdge, socket?.id);
          
          // Add the replacement edge to local state immediately
          setEdges((eds) => {
            // Remove the hidden edge and add the replacement edge
            return [...eds.filter(e => e.id !== existingHiddenEdge.id), replacementEdge];
          });
        } else {
          // Create new edge normally
          await encryptedApi.createEdge(newEdge, socket?.id);
          
          // Add the edge to local state immediately
          setEdges((eds) => [...eds, newEdge]);
        }
        
        // Special case: When connecting two bloodline nodes with partner edge
        // (applies to both new edges and replaced hidden edges)
        if (edgeType === 'partner' && isBloodlineNode(sourceNode) && isBloodlineNode(targetNode)) {
          // Use a timeout to ensure the partner edge is added to state first
          setTimeout(async () => {
            try {
              // Determine which node should remain bloodline and which should become partner
              // Check if either node has a connection through the parent handle
              const sourceHasParentConnection = edges.some(edge => 
                (edge.source === sourceNode.id && edge.sourceHandle === 'parent') ||
                (edge.target === sourceNode.id && edge.targetHandle === 'parent')
              );
              const targetHasParentConnection = edges.some(edge => 
                (edge.source === targetNode.id && edge.sourceHandle === 'parent') ||
                (edge.target === targetNode.id && edge.targetHandle === 'parent')
              );
              
              let bloodlineNode, partnerNode;
              
              if (sourceHasParentConnection && !targetHasParentConnection) {
                // Source has parent connection, so source stays bloodline, target becomes partner
                console.log(`🔗 Partner connection decision: Source (${sourceNode.data.name}) has parent connection, staying bloodline. Target (${targetNode.data.name}) becomes partner.`);
                bloodlineNode = sourceNode;
                partnerNode = targetNode;
              } else if (targetHasParentConnection && !sourceHasParentConnection) {
                // Target has parent connection, so target stays bloodline, source becomes partner
                console.log(`🔗 Partner connection decision: Target (${targetNode.data.name}) has parent connection, staying bloodline. Source (${sourceNode.data.name}) becomes partner.`);
                bloodlineNode = targetNode;
                partnerNode = sourceNode;
              } else {
                // Default behavior: target becomes partner (original logic)
                console.log(`🔗 Partner connection decision: Using default logic. Source (${sourceNode.data.name}) stays bloodline, Target (${targetNode.data.name}) becomes partner.`);
                bloodlineNode = sourceNode;
                partnerNode = targetNode;
              }
              
              // Set partner node bloodline status to false
              const updatedPartnerNode = {
                ...partnerNode,
                data: { ...partnerNode.data, bloodline: false }
              };
              
              await encryptedApi.updateNode(partnerNode.id, { 
                position: partnerNode.position, 
                data: updatedPartnerNode.data 
              });
              
              setNodes((nds) => 
                nds.map(n => n.id === partnerNode.id ? updatedPartnerNode : n)
              );
              
              // Get current edges including the newly created partner edge
              setEdges((currentEdges) => {
                // Find all family connections from the partner node and convert to fake bloodline edges
                const partnerFamilyEdges = currentEdges.filter(edge => 
                  (edge.source === partnerNode.id && (edge.sourceHandle === 'child' || edge.sourceHandle === 'parent')) ||
                  (edge.target === partnerNode.id && (edge.targetHandle === 'child' || edge.targetHandle === 'parent'))
                );
                
                // Convert family edges to fake bloodline edges and collect family nodes
                const affectedFamilyNodes = [];
                let updatedEdges = [...currentEdges];
                
                for (const familyEdge of partnerFamilyEdges) {
                  if (familyEdge.type === 'bloodline') {
                    // Delete old edge and create new fake bloodline edge
                    encryptedApi.deleteEdge(familyEdge.id);
                    
                    const updatedFamilyEdge = { 
                      ...familyEdge, 
                      type: 'bloodlinefake',
                      id: getId() // Generate new ID for the replacement edge
                    };
                    
                    encryptedApi.createEdge(updatedFamilyEdge, socket?.id);
                    
                    // Remove old edge and add new fake edge to local state immediately
                    updatedEdges = updatedEdges.filter(e => e.id !== familyEdge.id);
                    updatedEdges.push(updatedFamilyEdge);
                    
                    // Collect family node for hidden edge creation
                    const familyNodeId = familyEdge.source === partnerNode.id ? familyEdge.target : familyEdge.source;
                    const familyNode = nodes.find(n => n.id === familyNodeId);
                    if (familyNode && familyNode.type === 'family') {
                      affectedFamilyNodes.push({ familyNode, familyEdge: updatedFamilyEdge });
                    }
                  }
                }
                
                // Create hidden bloodline edges from bloodline node to family nodes
                affectedFamilyNodes.forEach(({ familyNode, familyEdge }) => {
                  // Check if family node already has hidden or true bloodline edges (excluding the one we just converted)
                  const existingBloodlineEdges = updatedEdges.filter(edge => 
                    (edge.source === familyNode.id || edge.target === familyNode.id) &&
                    (edge.type === 'bloodline' || edge.type === 'bloodlinehidden') &&
                    edge.id !== familyEdge.id
                  );
                  
                  if (existingBloodlineEdges.length === 0) {
                    // Create hidden bloodline edge from bloodline node to family
                    const hiddenEdgeId = getId();
                    let hiddenEdge;
                    
                    if (familyEdge.source === partnerNode.id && familyEdge.sourceHandle === 'child') {
                      // Bloodline node child -> Family parentconnection (hidden)
                      hiddenEdge = {
                        id: hiddenEdgeId,
                        source: bloodlineNode.id,
                        target: familyNode.id,
                        sourceHandle: 'child',
                        targetHandle: 'parentconnection',
                        type: 'bloodlinehidden',
                        data: { isDebugMode: showDebug }
                      };
                    } else if (familyEdge.target === partnerNode.id && familyEdge.targetHandle === 'parent') {
                      // Family childrenconnection -> Bloodline node parent (hidden)
                      hiddenEdge = {
                        id: hiddenEdgeId,
                        source: familyNode.id,
                        target: bloodlineNode.id,
                        sourceHandle: 'childrenconnection',
                        targetHandle: 'parent',
                        type: 'bloodlinehidden',
                        data: { isDebugMode: showDebug }
                      };
                    }
                    
                    if (hiddenEdge) {
                      encryptedApi.createEdge(hiddenEdge, socket?.id);
                      // Add hidden edge to local state immediately
                      updatedEdges.push(hiddenEdge);
                    }
                  }
                });
                
                return updatedEdges;
              });
              
            } catch (error) {
              console.error('Failed to process bloodline node conversion:', error);
            }
          }, 50);
        }
        
      } catch (error) {
        console.error('Failed to create edge:', error);
      }
    },
    [setEdges, showDebug, nodes, edges, setNodes, socket],
  );

  const onNodeClick = useCallback((event, node) => {
    // Set selection in App.jsx state
    // React Flow manages its own selection state
    setSelectedNode(node);
    // No longer manipulating node.data.isSelected (Strategy 3)
  }, [setSelectedNode]);

  const onPaneClick = useCallback(() => {
    // Clear selection in App.jsx state
    setSelectedNode(null);
    // No longer manipulating node.data.isSelected (Strategy 3)
  }, [setSelectedNode]);

  const onConnectStart = useCallback((event, { handleId, handleType, nodeId }) => {
    // Store the starting position of the edge drag
    const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;
    edgeDragStartRef.current = { x: clientX, y: clientY };
  }, []);

  const onConnectEnd = useCallback(
    async (event, connectionState) => {
      if (!connectionState.isValid && connectionState.fromNode && connectionState.fromHandle) {
        try {
          // Check if edge was dragged at least 50 pixels
          const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;
          
          if (edgeDragStartRef.current) {
            const dragDistance = Math.sqrt(
              Math.pow(clientX - edgeDragStartRef.current.x, 2) + 
              Math.pow(clientY - edgeDragStartRef.current.y, 2)
            );
            
            // Reset the drag start position
            edgeDragStartRef.current = null;
            
            // Only create new node if dragged at least 50 pixels
            if (dragDistance < 50) {
              return;
            }
          }
          
          const sourceHandle = connectionState.fromHandle.id;
          const sourceNode = connectionState.fromNode;
          
          // Validate connection before creating new node
          // Create a virtual target node based on what would be created
          let virtualTargetNode, virtualTargetHandle;
          
          if (sourceNode.type === 'person') {
            if (sourceHandle === 'parent' || sourceHandle === 'child') {
              // Would create a Family node
              virtualTargetNode = {
                id: 'virtual-family',
                type: 'family',
                data: { bloodline: true }
              };
              virtualTargetHandle = sourceHandle === 'parent' ? 'childrenconnection' : 'parentconnection';
            } else if (sourceHandle === 'partner-left' || sourceHandle === 'partner-right') {
              // Would create a Partner Person node
              virtualTargetNode = {
                id: 'virtual-partner',
                type: 'person',
                data: { name: 'Virtual Partner', bloodline: false }
              };
              virtualTargetHandle = sourceHandle === 'partner-left' ? 'partner-right' : 'partner-left';
            }
          } else if (sourceNode.type === 'family') {
            // Would create a Person node
            if (sourceHandle === 'childrenconnection') {
              virtualTargetNode = {
                id: 'virtual-person',
                type: 'person',
                data: { name: 'Virtual Parent', bloodline: true }
              };
              virtualTargetHandle = 'parent';
            } else if (sourceHandle === 'parentconnection') {
              // Check if family already has a bloodline edge through parentconnection
              const hasExistingBloodlineConnection = edges.some(edge => 
                edge.target === sourceNode.id && 
                edge.targetHandle === 'parentconnection' && 
                (edge.type === 'bloodline' || edge.type === 'bloodlinehidden')
              );
              
              virtualTargetNode = {
                id: 'virtual-person',
                type: 'person',
                data: { name: 'Virtual Child', bloodline: !hasExistingBloodlineConnection }
              };
              virtualTargetHandle = 'child';
            }
          }
          
          // Validate the virtual connection
          if (virtualTargetNode && virtualTargetHandle) {
            const validationResult = validateConnection(
              sourceNode,
              virtualTargetNode,
              sourceHandle,
              virtualTargetHandle,
              edges
            );
            
            if (!validationResult.isValid) {
              // Show validation message and stop node creation
              console.warn('Node creation prohibited:', validationResult.message);
              setTimeout(() => {
                alert(`Node creation not allowed:\n\n${validationResult.message}`);
              }, 100);
              return;
            }
          }
          
          const newId = getId();
          
          let dropPosition = screenToFlowPosition({ 
            x: 'changedTouches' in event ? event.changedTouches[0].clientX : event.clientX, 
            y: 'changedTouches' in event ? event.changedTouches[0].clientY : event.clientY 
          });
          
          // Helper function to generate random year offset
          const getRandomYearOffset = (baseYears) => {
            return baseYears + Math.floor(Math.random() * 11) - 5; // +/- 5 years
          };
          
          // Helper function to calculate birth year from age and current year
          const calculateBirthYear = (ageOffset) => {
            const currentYear = new Date().getFullYear();
            return currentYear - ageOffset;
          };
          
          // Helper function to parse birth year from date string
          const getBirthYear = (birthDate) => {
            if (!birthDate) return null;
            const year = parseInt(birthDate.split('-')[0]);
            return isNaN(year) ? null : year;
          };
          
          // Function to calculate handle offset from node center
          const getHandleOffset = (nodeType, handleId, isSelected = false) => {
            if (nodeType === 'family') {
              const radius = isSelected ? 40 : 30; // Half of circle size
              switch (handleId) {
                case 'parentconnection': return { x: 0, y: 0};
                case 'childrenconnection': return { x: 0, y: 2*radius };
                default: return { x: 0, y: 0 };
              }
            } else if (nodeType === 'person') {
              if (isSelected) {
                // Selected person node: 200px wide, ~100px height
                switch (handleId) {
                  case 'parent': return { x: 0, y: -50 };
                  case 'child': return { x: 0, y: 50 };
                  case 'partner-left': return { x: -110, y: 10 };
                  case 'partner-right': return { x: 110, y: 10 };
                  default: return { x: 0, y: 0 };
                }
              } else {
                // Unselected person node: minWidth 120px, ~40px height
                switch (handleId) {
                  case 'parent': return { x: 0, y: 0 };
                  case 'child': return { x: 0, y: 30 };
                  case 'partner-left': return { x: -75, y: 20 };
                  case 'partner-right': return { x: 75, y: 20 };
                  default: return { x: 0, y: 0 };
                }
              }
            }
            return { x: 0, y: 0 };
          };
          
          // Determine what type of node to create and how to connect
          let newNode, newEdge;
          let isPartnerNode = false;
          let existingBloodlineNode = null;
          
          if (sourceNode.type === 'person') {
            if (sourceHandle === 'parent' || sourceHandle === 'child') {
              // Person parent/child handle -> Create Family node
              const sourcePersonBirthYear = getBirthYear(sourceNode.data.birthDate);
              const familyAgeOffset = getRandomYearOffset(15);
              let familyEstablishmentYear;
              
              if (sourcePersonBirthYear) {
                if (sourceHandle === 'parent') {
                  // Family established before person was born (family of parents)
                  familyEstablishmentYear = sourcePersonBirthYear - familyAgeOffset;
                } else {
                  // Family established after person was born (family of children)
                  familyEstablishmentYear = sourcePersonBirthYear + familyAgeOffset;
                }
              } else {
                // Fallback: estimate based on current year
                const currentYear = new Date().getFullYear();
                familyEstablishmentYear = currentYear - getRandomYearOffset(25);
              }
              
              const familyNodeData = {
                name: `${appConfig.ui.defaultNames.family} ${familyEstablishmentYear}`,
                surname: sourceNode.data.surname || '',
                birthDate: `${familyEstablishmentYear}-01-01`,
                city: sourceNode.data.city || '',
                zip: sourceNode.data.zip || '',
                country: sourceNode.data.country || '',
                sourcePersonBirthYear: sourcePersonBirthYear,
                bloodline: true // Family nodes are always on the bloodline
                // isSelected removed - managed by App.jsx and React Flow (Strategy 3)
              };
              
              // Calculate position so the connecting handle is at the drop point
              let targetHandle = sourceHandle === 'parent' ? 'childrenconnection' : 'parentconnection';
              const handleOffset = getHandleOffset('family', targetHandle, false);
              
              newNode = {
                id: newId,
                type: 'family',
                position: {
                  x: dropPosition.x - handleOffset.x,
                  y: dropPosition.y - handleOffset.y
                },
                data: familyNodeData,
                deletable: true,
                selectable: true,
              };
              
              // Create appropriate edge(s)
              if (sourceHandle === 'parent') {
                // Person parent -> Family childrenconnection
                if (!isBloodlineNode(sourceNode)) {
                  // Partner node: create fake bloodline edge
                  newEdge = {
                    id: `edge-${newId}`,
                    source: newId,
                    target: sourceNode.id,
                    sourceHandle: 'childrenconnection',
                    targetHandle: 'parent',
                    type: 'bloodlinefake',
                    data: { isDebugMode: showDebug }
                  };
                } else {
                  // Bloodline node: create regular bloodline edge
                  newEdge = {
                    id: `edge-${newId}`,
                    source: newId,
                    target: sourceNode.id,
                    sourceHandle: 'childrenconnection',
                    targetHandle: 'parent',
                    type: 'bloodline',
                    data: { isDebugMode: showDebug }
                  };
                }
              } else {
                // Person child -> Family parentconnection
                if (!isBloodlineNode(sourceNode)) {
                  // Partner node: create fake bloodline edge
                  newEdge = {
                    id: `edge-${newId}`,
                    source: sourceNode.id,
                    target: newId,
                    sourceHandle: 'child',
                    targetHandle: 'parentconnection',
                    type: 'bloodlinefake',
                    data: { isDebugMode: showDebug }
                  };
                } else {
                  // Bloodline node: create regular bloodline edge
                  newEdge = {
                    id: `edge-${newId}`,
                    source: sourceNode.id,
                    target: newId,
                    sourceHandle: 'child',
                    targetHandle: 'parentconnection',
                    type: 'bloodline',
                    data: { isDebugMode: showDebug }
                  };
                }
              }
              
            } else if (sourceHandle === 'partner-left' || sourceHandle === 'partner-right') {
              // Partner connections
              const sourcePersonBirthYear = getBirthYear(sourceNode.data.birthDate);
              const ageOffset = getRandomYearOffset(0); // Same age +/- 5 years
              let partnerBirthYear;
              
              if (sourcePersonBirthYear) {
                partnerBirthYear = sourcePersonBirthYear + ageOffset;
              } else {
                partnerBirthYear = calculateBirthYear(getRandomYearOffset(30));
              }
              
              const newNodeData = {
                name: appConfig.ui.defaultNames.partner,
                surname: sourceNode.data.surname || '',
                birthDate: `${partnerBirthYear}-01-01`,
                deathDate: '',
                city: sourceNode.data.city || '',
                zip: sourceNode.data.zip || '',
                country: sourceNode.data.country || '',
                phone: '',
                numberOfPartners: 0,
                bloodline: false
                // isSelected removed - managed by App.jsx and React Flow (Strategy 3)
              };

              // Calculate position so the connecting handle is at the drop point
              let targetHandle = sourceHandle === 'partner-left' ? 'partner-right' : 'partner-left';
              const handleOffset = getHandleOffset('person', targetHandle, false);
              
              newNode = {
                id: newId,
                type: 'person',
                position: {
                  x: dropPosition.x - handleOffset.x,
                  y: dropPosition.y - handleOffset.y
                },
                data: newNodeData,
                deletable: true,
                selectable: true,
              };

              if (sourceHandle === 'partner-left') {
                newEdge = {
                  id: `edge-${newId}`,
                  source: sourceNode.id,
                  target: newId,
                  sourceHandle: 'partner-left',
                  targetHandle: 'partner-right',
                  type: 'partner',
                  data: { isDebugMode: showDebug }
                };
              } else {
                newEdge = {
                  id: `edge-${newId}`,
                  source: newId,
                  target: sourceNode.id,
                  sourceHandle: 'partner-left',
                  targetHandle: 'partner-right',
                  type: 'partner',
                  data: { isDebugMode: showDebug }
                };
              }
            }
            
          } else if (sourceNode.type === 'family') {
            // Family node -> Create Person node
            // Inherit all data directly from family node
            
            // Determine name based on source handle
            let personName;
            if (sourceHandle === 'childrenconnection') {
              personName = appConfig.ui.defaultNames.child;
            } else {
              personName = appConfig.ui.defaultNames.parent;
            }
            
            // Calculate birth year based on family establishment year
            const familyBirthYear = getBirthYear(sourceNode.data.birthDate) || 
              (sourceNode.data.name.match(/\d{4}/) ? parseInt(sourceNode.data.name.match(/\d{4}/)[0]) : new Date().getFullYear() - 30);
            const ageOffset = getRandomYearOffset(15);
            let personBirthYear;
            
            if (sourceHandle === 'childrenconnection') {
              // Child is born after family establishment
              personBirthYear = familyBirthYear + ageOffset;
            } else {
              // Parent is born before family establishment  
              personBirthYear = familyBirthYear - ageOffset;
            }
            
            // Check if family already has a bloodline edge through parentconnection
            if (sourceHandle === 'parentconnection') {
              const existingParentEdge = edges.find(edge => 
                edge.target === sourceNode.id && 
                edge.targetHandle === 'parentconnection' && 
                (edge.type === 'bloodline' || edge.type === 'bloodlinehidden')
              );
              
              if (existingParentEdge) {
                isPartnerNode = true;
                existingBloodlineNode = nodes.find(n => n.id === existingParentEdge.source);
                console.log(`🔗 Family parentconnection already has bloodline edge. Creating partner node for existing bloodline node: ${existingBloodlineNode?.data?.name}`);
              }
            }
            
            const personNodeData = {
              name: personName,
              surname: sourceNode.data.surname || '',
              birthDate: `${personBirthYear}-01-01`,
              deathDate: '',
              city: sourceNode.data.city || '',
              zip: sourceNode.data.zip || '',
              country: sourceNode.data.country || '',
              phone: '',
              gender: 'male',
              numberOfPartners: 0,
              bloodline: !isPartnerNode // Partner nodes have bloodline: false
              // isSelected removed - managed by App.jsx and React Flow (Strategy 3)
            };
            
            // Calculate position so the connecting handle is at the drop point
            let targetHandle = sourceHandle === 'childrenconnection' ? 'parent' : 'child';
            const handleOffset = getHandleOffset('person', targetHandle, false);
            
            newNode = {
              id: newId,
              type: 'person',
              position: {
                x: dropPosition.x - handleOffset.x,
                y: dropPosition.y - handleOffset.y
              },
              data: personNodeData,
              deletable: true,
              selectable: true,
            };
            
            // Create appropriate edge
            if (sourceHandle === 'childrenconnection') {
              // Family childrenconnection -> Person parent
              newEdge = {
                id: `edge-${newId}`,
                source: sourceNode.id,
                target: newId,
                sourceHandle: 'childrenconnection',
                targetHandle: 'parent',
                type: 'bloodline',
                data: { isDebugMode: showDebug }
              };
            } else {
              // Family parentconnection -> Person child
              if (isPartnerNode) {
                // Create fake bloodline edge for partner node
                newEdge = {
                  id: `edge-${newId}`,
                  source: newId,
                  target: sourceNode.id,
                  sourceHandle: 'child',
                  targetHandle: 'parentconnection',
                  type: 'bloodlinefake',
                  data: { isDebugMode: showDebug }
                };
              } else {
                // Create regular bloodline edge for bloodline node
                newEdge = {
                  id: `edge-${newId}`,
                  source: newId,
                  target: sourceNode.id,
                  sourceHandle: 'child',
                  targetHandle: 'parentconnection',
                  type: 'bloodline',
                  data: { isDebugMode: showDebug }
                };
              }
            }
          }
          
          if (newNode && newEdge) {
            // Save to database - node will be added via socket event
            console.log('[CREATE NODE] Creating node via API, Node ID:', newNode.id);
            try {
              await encryptedApi.createNode(newNode, socket?.id);
              // Note: Don't add node to local state here - let socket listener handle it

              // Create edge after a short delay
              setTimeout(async () => {
                try {
                  await encryptedApi.createEdge(newEdge, socket?.id);
                  
                  // Add the edge to local state immediately
                  setEdges((eds) => [...eds, newEdge]);
                  
                  // Special case: If we created a partner node through family parentconnection, create partner edge to existing bloodline node
                if (newNode.type === 'person' && sourceNode.type === 'family' && sourceHandle === 'parentconnection' && isPartnerNode && existingBloodlineNode) {
                  console.log(`🔗 Creating partner edge between bloodline node ${existingBloodlineNode.data.name} and new partner node ${newNode.data.name}`);
                  
                  // Create partner edge from bloodline node (right handle) to new partner node (left handle)
                  const partnerEdgeId = getId();

                  // Determine source and target based on relative positions
                  const bloodlineNodePosition = existingBloodlineNode.position;
                  const newNodePosition = newNode.position;
                  
                  // If new node is to the right of bloodline node, bloodline is source, new node is target
                  // If new node is to the left of bloodline node, new node is source, bloodline is target
                  let source, target;
                  
                  if (newNodePosition.x > bloodlineNodePosition.x) {
                    // New node is to the right: bloodline -> new node (right->left)
                    source = newNode.id;
                    target = existingBloodlineNode.id;
                    
                    console.log(`🔗 New node is to the right, using bloodline -> newNode`);
                  } else {
                    // New node is to the left: new node -> bloodline (left->right)
                    source = existingBloodlineNode.id;
                    target = newNode.id;  
                    console.log(`🔗 New node is to the left, using newNode -> bloodline`);
                  }
                  
                  // Create partner edge with position-based source/target
                  const partnerEdge = {
                    id: partnerEdgeId,
                    source: source,
                    target: target,
                    sourceHandle: 'partner-left',
                    targetHandle: 'partner-right',
                    type: 'partner',
                    data: { isDebugMode: showDebug }
                  };
                  
                  // Create partner edge after a short delay to ensure the first edge is processed
                  setTimeout(async () => {
                    try {
                      await encryptedApi.createEdge(partnerEdge, socket?.id);
                      
                      // Add partner edge to local state immediately
                      setEdges((eds) => [...eds, partnerEdge]);
                      
                      console.log(`🔗 Successfully created partner edge between ${existingBloodlineNode.data.name} and ${newNode.data.name}`);
                    } catch (error) {
                      console.error('Failed to create partner edge:', error);
                    }
                  }, 100);
                }
                
                // Special case: If creating family from partner node, also create hidden bloodline edge from connected bloodline node
                if (newNode.type === 'family' && sourceNode.type === 'person' && !isBloodlineNode(sourceNode)) {
                  // Find the bloodline node connected to this partner
                  const partnerEdge = edges.find(edge => 
                    isPartnerEdge(edge) && 
                    (edge.source === sourceNode.id || edge.target === sourceNode.id)
                  );
                  
                  if (partnerEdge) {
                    const bloodlineNodeId = partnerEdge.source === sourceNode.id ? partnerEdge.target : partnerEdge.source;
                    const bloodlineNode = nodes.find(n => n.id === bloodlineNodeId);
                    
                    if (bloodlineNode && isBloodlineNode(bloodlineNode)) {
                      // Create hidden bloodline edge from bloodline node to family
                      const hiddenEdgeId = getId();
                      let hiddenEdge;
                      
                      if (sourceHandle === 'parent') {
                        // Bloodline node parent -> Family childrenconnection (hidden)
                        hiddenEdge = {
                          id: hiddenEdgeId,
                          source: newId,
                          target: bloodlineNodeId,
                          sourceHandle: 'childrenconnection',
                          targetHandle: 'parent',
                          type: 'bloodlinehidden',
                          data: { isDebugMode: showDebug }
                        };
                      } else {
                        // Bloodline node child -> Family parentconnection (hidden)
                        hiddenEdge = {
                          id: hiddenEdgeId,
                          source: bloodlineNodeId,
                          target: newId,
                          sourceHandle: 'child',
                          targetHandle: 'parentconnection',
                          type: 'bloodlinehidden',
                          data: { isDebugMode: showDebug }
                        };
                      }
                      
                      // Create the hidden edge
                      setTimeout(async () => {
                        try {
                          await encryptedApi.createEdge(hiddenEdge, socket?.id);
                          
                          // Add hidden edge to local state immediately
                          setEdges((eds) => [...eds, hiddenEdge]);
                        } catch (error) {
                          console.error('Failed to create hidden bloodline edge:', error);
                        }
                      }, 150);
                    }
                  }
                }
                
              } catch (error) {
                console.error('Failed to create edge:', error);
              }
            }, 100);
            } catch (error) {
              // Handle node creation error (e.g., when node creation is locked)
              console.error('Failed to create node:', error);
              if (error.message && error.message.includes('locked')) {
                setTimeout(() => {
                  alert(`${appConfig.ui.alerts.nodeCreationLocked.title}\n\n${appConfig.ui.alerts.nodeCreationLocked.message}`);
                }, 100);
              } else {
                setTimeout(() => {
                  alert('Fehler beim Erstellen des Knotens: ' + error.message);
                }, 100);
              }
            }
          }
          
        } catch (error) {
          console.error('Error creating new node:', error);
        }
      }
    },
    [screenToFlowPosition, setNodes, showDebug, nodes, edges, socket],
  );

  // Function to update node data from parent component (for syncing sidebar changes)
  const updateNode = useCallback((nodeId, newData, newPosition) => {
    if (showDebug) {
      console.log('FamilyTree: updateNode called for node', nodeId, 'with data:', newData, 'and position:', newPosition);
    }
    
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { 
              ...node, 
              data: { 
                ...node.data, 
                ...newData
              },
              ...(newPosition && { position: newPosition })
            }
          : node
      )
    );
  }, [setNodes, showDebug]);

  // Expose tree operations to parent component
  useEffect(() => {
    if (onNodeUpdate) {
      onNodeUpdate({
        nodes,
        edges,
        autoLayout,
        fitTreeToView,
        zoomToNode,
        updateNode,
        refreshData
      });
    }
  }, [nodes, edges, autoLayout, fitTreeToView, zoomToNode, updateNode, refreshData, onNodeUpdate]);

  if (loading) {
    return <div>{appConfig.ui.loading.familyTree}</div>;
  }

  // Show a blocking overlay during batch operations (encryption/decryption/password change)
  if (batchOperationActive) {
    return (
      <div style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: '#4CAF50',
        fontSize: '18px',
        fontWeight: 'bold',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div>
          <div style={{ marginBottom: '20px', fontSize: '24px' }}>⚡ Processing...</div>
          <div>Encryption operation in progress</div>
          <div style={{ fontSize: '14px', marginTop: '10px', opacity: 0.7 }}>
            Please wait while we secure your data
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onInit={handleInit}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        isValidConnection={isValidConnection}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        nodeOrigin={nodeOrigin}
        minZoom={0.05}
        maxZoom={2}
      >
        <Background />
        <MiniMap 
          className="minimap-desktop-only"
          nodeColor={(node) => {
            if (node.type === 'family') return '#09380dff';
            if (node.data.bloodline) return '#4CAF50';
            return '#666666';
          }}
          maskColor="rgba(0, 0, 0, 0.6)"
          style={{
            backgroundColor: '#1a1a1a',
            border: '2px solid #4CAF50',
            borderRadius: '8px'
          }}
        />
      </ReactFlow>
      
      {/* Real-time Collaboration Indicator - only visible in debug mode */}
      {isConnected && showDebug && userCount > 0 && (
        <div
          className="mobile-hide-online-users"
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            padding: '8px 16px',
            backgroundColor: isCollaborating ? '#4CAF50' : '#FFC107',
            color: 'white',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'bold',
            zIndex: 1001,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <div 
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isCollaborating ? '#66BB6A' : '#FFD54F',
              animation: isCollaborating ? 'pulse 2s infinite' : 'none'
            }}
          />
          {isCollaborating 
            ? appConfig.ui.collaboration.usersCollaborating.replace('{count}', userCount)
            : appConfig.ui.collaboration.userOnline.replace('{count}', userCount)
          }
        </div>
      )}
      
      {/* ELK Debug Button - only visible when debug mode is on */}
      {showDebug && (
        <button
          onClick={() => setShowElkDebug(!showElkDebug)}
          style={{
            position: 'absolute',
            top: '10px',
            left: (isConnected && userCount > 0) ? '250px' : '10px', // Position next to collaboration indicator if showing
            padding: '8px 16px',
            backgroundColor: showElkDebug ? '#FF5722' : '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: 1001,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🔍 {showElkDebug ? 'Hide ELK Debug' : 'Show ELK Debug'}
        </button>
      )}
      
      {/* ELK Debug Overlay */}
      <ElkDebugOverlay 
        elkDebugData={elkDebugData} 
        showDebug={showElkDebug} 
      />
    </div>
  );
};

export default FamilyTree;
