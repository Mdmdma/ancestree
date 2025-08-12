import React, { useCallback, useState, useEffect } from 'react';
import {
  Background,
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  useUpdateNodeInternals,
} from '@xyflow/react';
import ELK from 'elkjs/lib/elk.bundled.js';
import PersonNode from './PersonNode';
import NodeEditor from './NodeEditor';
import ImageGallery from './ImageGallery';
import MapView from './MapView';
import PartnerEdge from './PartnerEdge';
import BloodlineEdge from './BloodlineEdge';
import BloodlineEdgeHidden from './BloodlineEdgeHidden';
import BloodlineEdgeFake from './BloodlineEdgeFake';
import { api } from './api';

import '@xyflow/react/dist/style.css';

const nodeTypes = {
  person: PersonNode,
};

const edgeTypes = {
  partner: PartnerEdge,
  bloodline: BloodlineEdge,
  bloodlinehidden: BloodlineEdgeHidden,
  bloodlinefake: BloodlineEdgeFake,
};

let id = 1;
const getId = () => `${id++}`;
const nodeOrigin = [0.5, 0];

// Function to calculate birth date based on relationship
const calculateBirthDate = (sourceNode, relationshipType) => {
  if (!sourceNode.data.birthDate) {
    return ''; // If source node has no birth date, don't set one
  }
  
  const sourceBirthDate = new Date(sourceNode.data.birthDate);
  if (isNaN(sourceBirthDate.getTime())) {
    return ''; // Invalid source birth date
  }
  
  let yearOffset = 0;
  let randomVariation = Math.floor(Math.random() * 11) - 5; // Random number between -5 and +5
  
  switch (relationshipType) {
    case 'child':
      yearOffset = 30 + randomVariation; // Children: +30±5 years
      break;
    case 'parent':
      yearOffset = -30 + randomVariation; // Parents: -30±5 years
      break;
    case 'partner':
      yearOffset = randomVariation; // Partners: ±5 years
      break;
    default:
      return '';
  }
  
  const newBirthDate = new Date(sourceBirthDate);
  newBirthDate.setFullYear(sourceBirthDate.getFullYear() + yearOffset);
  
  // Return in YYYY-MM-DD format
  return newBirthDate.toISOString().split('T')[0];
};

const AddNodeOnEdgeDrop = () => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [activeTab, setActiveTab] = useState('editor'); // 'editor', 'images', or 'map'
  const [isTaggingMode, setIsTaggingMode] = useState(false);
  const [isMapMode, setIsMapMode] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  // Update edges with debug mode information when showDebug changes
  useEffect(() => {
    setEdges((currentEdges) =>
      currentEdges.map((edge) => ({
        ...edge,
        data: { ...edge.data, isDebugMode: showDebug }
      }))
    );
  }, [showDebug, setEdges]);

  // Handle node changes including position updates
  const handleNodesChange = useCallback(async (changes) => {
    onNodesChange(changes);
    
    // Handle different types of node changes
    for (const change of changes) {
      if (change.type === 'position' && change.position && !change.dragging) {
        // Update database for position changes
        try {
          const node = nodes.find(n => n.id === change.id);
          if (node) {
            await api.updateNode(change.id, { 
              position: change.position, 
              data: node.data 
            });
          }
        } catch (error) {
          console.error('Failed to update node position:', error);
        }
      } else if (change.type === 'remove') {
        // Handle node deletions
        try {
          await api.deleteNode(change.id);
        } catch (error) {
          console.error('Failed to delete node:', error);
        }
      }
    }
  }, [onNodesChange, nodes]);

  // Handle edge changes including deletions
  const handleEdgesChange = useCallback(async (changes) => {
    onEdgesChange(changes);
    
    // Handle edge deletions
    for (const change of changes) {
      if (change.type === 'remove') {
        try {
          await api.deleteEdge(change.id);
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
          api.loadNodes(),
          api.loadEdges()
        ]);
        
        setNodes(nodesData);
        setEdges(edgesData);
        
        // Update ID counter based on existing nodes
        const maxId = Math.max(...nodesData.map(n => parseInt(n.id) || 0));
        id = maxId + 1;
        
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [setNodes, setEdges]);

  // Function to calculate and update partner counts for all nodes
  const updatePartnerCounts = useCallback(() => {
    const partnerCounts = new Map();
    
    // Initialize all nodes with 0 partners
    nodes.forEach(node => {
      partnerCounts.set(node.id, 0);
    });
    
    // Count partners from edges
    edges.forEach(edge => {
      if (edge.type === 'partner') {
        partnerCounts.set(edge.source, (partnerCounts.get(edge.source) || 0) + 1);
        partnerCounts.set(edge.target, (partnerCounts.get(edge.target) || 0) + 1);
      }
    });
    
    // Update nodes with partner counts
    const updatedNodes = nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        numberOfPartners: partnerCounts.get(node.id) || 0
      }
    }));
    
    setNodes(updatedNodes);
    return partnerCounts;
  }, [nodes, edges, setNodes]);

  // Function to calculate node dimensions based on partner count
  const getNodeDimensions = useCallback((numberOfPartners) => {
    const baseWidth = 200;
    const baseHeight = 100;
    // Calculate total width needed for this node and all its partners
    const totalWidth = baseWidth * (1 + numberOfPartners); // Each partner gets a full node width
    const partnerHeightIncrease = 0; // Additional height per partner
    
    return {
      width: totalWidth,
      height: baseHeight + (numberOfPartners * partnerHeightIncrease)
    };
  }, []);

  // Auto layout functionality using ELK.js for hierarchical layout with birth year Y positioning
  const autoLayout = useCallback(async () => {
    if (nodes.length === 0) return;

    // Update partner counts first
    const partnerCounts = updatePartnerCounts();

    // Function to calculate Y position with increased separation from birth year
    const calculateYPosition = (birthDate) => {
      if (!birthDate) return 1940 * 5; // Default year for nodes without birth date, scaled
      
      const birthYear = new Date(birthDate).getFullYear();
      const minYear = 1700;
      const maxYear = 2100;
      
      // Clamp birth year to our range and scale it for more separation
      const clampedYear = Math.max(minYear, Math.min(maxYear, birthYear));
      
      // Scale by 5x to increase separation between generations
      return clampedYear * 5;
    };

    // Create ELK instance
    const elk = new ELK();

    // Identify which nodes are on the bloodline using the node bloodline property
    const bloodlineNodeIds = new Set();
    nodes.forEach(node => {
      if (node.data.bloodline) {
        bloodlineNodeIds.add(node.id);
      }
    });

    // Build ELK graph structure with only bloodline nodes, but sized to accommodate partners
    const elkNodes = nodes
      .filter(node => bloodlineNodeIds.has(node.id))
      .map(node => {
        const numberOfPartners = partnerCounts.get(node.id) || node.data.numberOfPartners || 0;
        const dimensions = getNodeDimensions(numberOfPartners);
        
        return {
          id: node.id,
          width: dimensions.width,
          height: dimensions.height,
          properties: {
            birthDate: node.data.birthDate,
            numberOfPartners: numberOfPartners
          }
        };
      });

    // Store debug info for UI display
    setDebugInfo({
      elkNodes: elkNodes,
      partnerCounts: Array.from(partnerCounts.entries()),
      nodeCount: nodes.length,
      bloodlineNodeCount: nodes.filter(n => n.data.bloodline).length,
      partnerOnlyNodeCount: nodes.filter(n => !n.data.bloodline).length,
      edgeCount: edges.filter(e => e.type === 'bloodline' || e.type === 'bloodlinehidden').length,
      fakeEdgeCount: edges.filter(e => e.type === 'bloodlinefake').length,
      partnerEdgeCount: edges.filter(e => e.type === 'partner').length
    });

    const elkEdges = [];
    
    // Add bloodline edges for hierarchical structure
    // Note: bloodlinefake edges are excluded from ELK layout
    edges.forEach(edge => {
      if (edge.type === 'bloodline' || edge.type === 'bloodlinehidden') {
        if (edge.sourceHandle === 'child' && edge.targetHandle === 'parent') {
          // Parent -> Child direction for proper hierarchy
          elkEdges.push({
            id: edge.id,
            sources: [edge.target], // parent
            targets: [edge.source]  // child
          });
        }
      }
    });

    // Group partners together by creating compound nodes
    const partnerGroups = new Map();
    const partnerPairs = new Set();
    
    edges.forEach((edge) => {
      if (edge.type === 'partner') {
        const pairKey = [edge.source, edge.target].sort().join('-');
        if (!partnerPairs.has(pairKey)) {
          partnerPairs.add(pairKey);
          const groupId = `partner-group-${edge.source}-${edge.target}`;
          partnerGroups.set(groupId, {
            members: [edge.source, edge.target],
            leftPartner: edge.sourceHandle === 'partner-left' ? edge.source : edge.target,
            rightPartner: edge.sourceHandle === 'partner-left' ? edge.target : edge.source
          });
        }
      }
    });

    // Create ELK graph
    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.spacing.nodeNode': '30',
        'elk.layered.spacing.nodeNodeBetweenLayers': '80',
        'elk.spacing.edgeEdge': '20',
        'elk.spacing.edgeNode': '30',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        'elk.layered.cycleBreaking.strategy': 'GREEDY'
      },
      children: elkNodes,
      edges: elkEdges
    };

    try {
      // Run ELK layout
      const layoutedGraph = await elk.layout(graph);
      
      // Apply ELK X coordinates to bloodline nodes and override Y coordinates with birth year positioning
      const updatedNodes = nodes.map((node) => {
        const elkNode = layoutedGraph.children.find(n => n.id === node.id);
        
        if (elkNode) {
          // This is a bloodline node - use ELK positioning but adjust for left partners
          const numberOfPartners = partnerCounts.get(node.id) || node.data.numberOfPartners || 0;
          
          // Count left partners for this bloodline node
          let leftPartnerCount = 0;
          edges.forEach(edge => {
            if (edge.type === 'partner' && (edge.source === node.id || edge.target === node.id)) {
              const partnerId = edge.source === node.id ? edge.target : edge.source;
              const partnerNode = nodes.find(n => n.id === partnerId);
              const partnerIsBloodline = partnerNode && partnerNode.data.bloodline;
              
              // Only count non-bloodline left partners
              if (!partnerIsBloodline) {
                const isLeftPartner = (edge.source === node.id && edge.sourceHandle === 'partner-left') ||
                                     (edge.target === node.id && edge.targetHandle === 'partner-left');
                if (isLeftPartner) {
                  leftPartnerCount++;
                }
              }
            }
          });
          
          // Shift the bloodline node to the right by the number of left partners
          const nodeWidth = 200;
          const partnerSpacing = nodeWidth + 20;
          const leftPartnerShift = leftPartnerCount * partnerSpacing;
          
          const x = elkNode.x + leftPartnerShift; 
          const y = calculateYPosition(node.data.birthDate);
          
          return {
            ...node,
            position: { x, y },
            data: {
              ...node.data,
              numberOfPartners: numberOfPartners
            }
          };
        } else {
          // This is a partner-only node - will be positioned relative to bloodline partners later
          const numberOfPartners = partnerCounts.get(node.id) || node.data.numberOfPartners || 0;
          
          return {
            ...node,
            data: {
              ...node.data,
              numberOfPartners: numberOfPartners
            }
          };
        }
      });

      // Position partner nodes relative to their bloodline partners
      const processedPairs = new Set();
      
      edges.forEach(edge => {
        if (edge.type === 'partner') {
          const pairKey = [edge.source, edge.target].sort().join('-');
          
          if (!processedPairs.has(pairKey)) {
            processedPairs.add(pairKey);
            
            const sourceNode = updatedNodes.find(n => n.id === edge.source);
            const targetNode = updatedNodes.find(n => n.id === edge.target);
            
            if (sourceNode && targetNode) {
              // Determine which node is on the bloodline using node properties
              const sourceIsBloodline = sourceNode.data.bloodline;
              const targetIsBloodline = targetNode.data.bloodline;
              
              let bloodlineNode, partnerNode;
              let isLeftPartner;
              
              if (sourceIsBloodline && !targetIsBloodline) {
                // Source is bloodline, target is partner
                bloodlineNode = sourceNode;
                partnerNode = targetNode;
                isLeftPartner = edge.sourceHandle === 'partner-left';
              } else if (targetIsBloodline && !sourceIsBloodline) {
                // Target is bloodline, source is partner
                bloodlineNode = targetNode;
                partnerNode = sourceNode;
                isLeftPartner = edge.targetHandle === 'partner-left';
              } else if (sourceIsBloodline && targetIsBloodline) {
                // Both are bloodline nodes - position them side by side
                const avgX = (sourceNode.position.x + targetNode.position.x) / 2;
                const avgY = (sourceNode.position.y + targetNode.position.y) / 2;
                const partnerSpacing = 220; // Increased spacing for bloodline partners
                
                if (edge.sourceHandle === 'partner-left') {
                  targetNode.position.x = avgX - partnerSpacing / 2;
                  sourceNode.position.x = avgX + partnerSpacing / 2;
                } else {
                  sourceNode.position.x = avgX - partnerSpacing / 2;
                  targetNode.position.x = avgX + partnerSpacing / 2;
                }
                
                sourceNode.position.y = avgY;
                targetNode.position.y = avgY;
              } else if (bloodlineNode && partnerNode) {
                // Position partner node relative to bloodline node
                const nodeWidth = 200;
                const partnerSpacing = nodeWidth + 20; // Small gap between nodes
                
                partnerNode.position.x = isLeftPartner 
                  ? bloodlineNode.position.x - partnerSpacing
                  : bloodlineNode.position.x + partnerSpacing;
                partnerNode.position.y = bloodlineNode.position.y;
              }
            }
          }
        }
      });

      // Handle multiple partners for bloodline nodes
      const processedMultiPartners = new Set();
      
      nodes.forEach(node => {
        if (node.data.bloodline && !processedMultiPartners.has(node.id)) {
          processedMultiPartners.add(node.id);
          
          // Find all partners of this bloodline node
          const leftPartners = [];
          const rightPartners = [];
          
          edges.forEach(edge => {
            if (edge.type === 'partner' && (edge.source === node.id || edge.target === node.id)) {
              const partnerId = edge.source === node.id ? edge.target : edge.source;
              const partnerNode = nodes.find(n => n.id === partnerId);
              const partnerIsBloodline = partnerNode && partnerNode.data.bloodline;
              
              // Only position non-bloodline partners (bloodline partners are handled above)
              if (!partnerIsBloodline) {
                const isLeftPartner = (edge.source === node.id && edge.sourceHandle === 'partner-left') ||
                                     (edge.target === node.id && edge.targetHandle === 'partner-left');
                
                if (isLeftPartner) {
                  leftPartners.push(partnerId);
                } else {
                  rightPartners.push(partnerId);
                }
              }
            }
          });
          
          const bloodlineNode = updatedNodes.find(n => n.id === node.id);
          if (bloodlineNode && (leftPartners.length > 0 || rightPartners.length > 0)) {
            const nodeWidth = 200;
            const partnerSpacing = nodeWidth + 20;
            
            // Position left partners (chain leftward from bloodline node)
            leftPartners.forEach((partnerId, index) => {
              const partnerNode = updatedNodes.find(n => n.id === partnerId);
              if (partnerNode) {
                partnerNode.position.x = bloodlineNode.position.x - (index + 1) * partnerSpacing;
                partnerNode.position.y = bloodlineNode.position.y;
              }
            });
            
            // Position right partners (chain rightward from bloodline node)
            rightPartners.forEach((partnerId, index) => {
              const partnerNode = updatedNodes.find(n => n.id === partnerId);
              if (partnerNode) {
                partnerNode.position.x = bloodlineNode.position.x + (index + 1) * partnerSpacing;
                partnerNode.position.y = bloodlineNode.position.y;
              }
            });
          }
        }
      });

      // Update UI
      setNodes(updatedNodes);

      // Save all position changes to database
      await Promise.all(
        updatedNodes.map(node => 
          api.updateNode(node.id, { position: node.position, data: node.data })
        )
      );

    } catch (error) {
      console.error('ELK layout failed:', error);
    }
  }, [nodes, edges, setNodes, getNodeDimensions, updatePartnerCounts]);

  // Fit tree to view
  const fitTreeToView = useCallback(() => {
    fitView({ 
      padding: 0.2,
      duration: 800
    });
  }, [fitView]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Auto layout with Ctrl+L or Cmd+L
      if ((event.ctrlKey || event.metaKey) && event.key === 'l') {
        event.preventDefault();
        autoLayout();
      }
      // Fit to view with Ctrl+F or Cmd+F
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        fitTreeToView();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [autoLayout, fitTreeToView]);

  // ...existing validation and connection logic...
  const isValidConnection = useCallback((connection) => {
    const { sourceHandle, targetHandle, source, target } = connection;
    
    // Prevent self-connections (node connecting to itself)
    if (source === target) {
      return false;
    }
    
    if (sourceHandle === 'child' && targetHandle === 'parent') {
      return true;
    }
    
    if ((sourceHandle === 'partner-left' && targetHandle === 'partner-right') ||
        (sourceHandle === 'partner-right' && targetHandle === 'partner-left')) {
      return true;
    }
    
    return false;
  }, []);

  const onConnect = useCallback(
    async (params) => {
      if (isValidConnection(params)) {
        // Check if this is a partner connection
        const isPartnerConnection = params.sourceHandle?.includes('partner') || params.targetHandle?.includes('partner');
        
        if (isPartnerConnection) {
          // Regular partner edge
          const newEdge = { ...params, type: 'partner', data: { isDebugMode: showDebug } };
          
          try {
            await api.createEdge(newEdge);
            setEdges((eds) => addEdge(newEdge, eds));
            
            // Remove target node from bloodline when connected as partner
            const targetNode = nodes.find(n => n.id === params.target);
            if (targetNode && targetNode.data.bloodline) {
              const updatedData = {
                ...targetNode.data,
                bloodline: false
              };
              
              await api.updateNode(params.target, { 
                position: targetNode.position, 
                data: updatedData 
              });
              
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === params.target
                    ? { ...node, data: updatedData }
                    : node
                )
              );

                // Convert all existing bloodline edges of this node to fake bloodline edges
                const targetNodeBloodlineEdges = edges.filter(edge => 
                  (edge.source === params.target || edge.target === params.target) && 
                  edge.type === 'bloodline'
                );

                for (const edge of targetNodeBloodlineEdges) {
                  try {
                    // Delete the old bloodline edge
                    await api.deleteEdge(edge.id);
                    
                    // Create a new fake bloodline edge with the same properties
                    const fakeEdge = {
                      ...edge,
                      id: `fake-${edge.id}`,
                      type: 'bloodlinefake',
                      data: { isDebugMode: showDebug }
                    };
                    
                    await api.createEdge(fakeEdge);
                    
                    // Update the edges state
                    setEdges((eds) => 
                      eds.map(e => e.id === edge.id ? fakeEdge : e)
                    );
                  } catch (error) {
                    console.error('Failed to convert bloodline edge to fake:', error);
                  }
                }

                // Remove all hidden bloodline edges connected to this node
                const targetNodeHiddenEdges = edges.filter(edge => 
                  (edge.source === params.target || edge.target === params.target) && 
                  edge.type === 'bloodlinehidden'
                );

                for (const edge of targetNodeHiddenEdges) {
                  try {
                    await api.deleteEdge(edge.id);
                    setEdges((eds) => eds.filter(e => e.id !== edge.id));
                  } catch (error) {
                    console.error('Failed to remove hidden bloodline edge:', error);
                  }
                }
              }
            } catch (error) {
              console.error('Failed to create edge:', error);
            }
        } else {
          // This is a parent-child connection, check if source is a non-bloodline partner
          const sourceNode = nodes.find(n => n.id === params.source);
          const targetNode = nodes.find(n => n.id === params.target);
          
          if (sourceNode && targetNode) {
            // Function to find bloodline partner of a given node
            const findBloodlinePartner = (nodeId) => {
              for (const edge of edges) {
                if (edge.type === 'partner') {
                  if (edge.source === nodeId) {
                    const targetNode = nodes.find(n => n.id === edge.target);
                    if (targetNode && targetNode.data.bloodline) {
                      return edge.target;
                    }
                  } else if (edge.target === nodeId) {
                    const sourceNode = nodes.find(n => n.id === edge.source);
                    if (sourceNode && sourceNode.data.bloodline) {
                      return edge.source;
                    }
                  }
                }
              }
              return null;
            };

            // Function to check for existing hidden bloodline edge between two nodes
            const findHiddenBloodlineEdge = (sourceId, targetId) => {
              return edges.find(edge => 
                edge.type === 'bloodlinehidden' &&
                ((edge.source === sourceId && edge.target === targetId) ||
                 (edge.source === targetId && edge.target === sourceId))
              );
            };

            // Check if there's already a hidden bloodline edge between these nodes
            const existingHiddenEdge = findHiddenBloodlineEdge(params.source, params.target);
            
            if (existingHiddenEdge) {
              // Replace hidden edge with normal bloodline edge
              try {
                // Delete the hidden edge
                await api.deleteEdge(existingHiddenEdge.id);
                setEdges((eds) => eds.filter(edge => edge.id !== existingHiddenEdge.id));
                
                // Create normal bloodline edge
                const normalBloodlineEdge = { ...params, type: 'bloodline', data: { isDebugMode: showDebug } };
                await api.createEdge(normalBloodlineEdge);
                setEdges((eds) => addEdge(normalBloodlineEdge, eds));
              } catch (error) {
                console.error('Failed to replace hidden edge:', error);
              }
              return; // Exit early, we've handled this case
            }
            
            let edgesToCreate = [];
            
            // Check if source is a non-bloodline partner connecting to a child/parent
            if (!sourceNode.data.bloodline && (params.sourceHandle === 'child' || params.targetHandle === 'parent')) {
              // Source is partner node connecting as parent/child - create fake edge
              edgesToCreate.push({
                ...params,
                type: 'bloodlinefake',
                data: { isDebugMode: showDebug }
              });
              
              // Find bloodline partner and create hidden edge
              const bloodlinePartner = findBloodlinePartner(sourceNode.id);
              if (bloodlinePartner) {
                edgesToCreate.push({
                  id: `edge-hidden-${params.source}-${params.target}`,
                  source: params.sourceHandle === 'child' ? bloodlinePartner : bloodlinePartner,
                  target: params.sourceHandle === 'child' ? params.target : params.target,
                  sourceHandle: params.sourceHandle,
                  targetHandle: params.targetHandle,
                  type: 'bloodlinehidden',
                  data: { isDebugMode: showDebug }
                });
              }
            } else if (!targetNode.data.bloodline && (params.sourceHandle === 'child' || params.targetHandle === 'parent')) {
              // Target is partner node - create fake edge  
              edgesToCreate.push({
                ...params,
                type: 'bloodlinefake',
                data: { isDebugMode: showDebug }
              });
              
              // Find bloodline partner and create hidden edge
              const bloodlinePartner = findBloodlinePartner(targetNode.id);
              if (bloodlinePartner) {
                edgesToCreate.push({
                  id: `edge-hidden-${params.source}-${params.target}`,
                  source: params.targetHandle === 'parent' ? params.source : params.source,
                  target: params.targetHandle === 'parent' ? bloodlinePartner : bloodlinePartner,
                  sourceHandle: params.sourceHandle,
                  targetHandle: params.targetHandle,
                  type: 'bloodlinehidden',
                  data: { isDebugMode: showDebug }
                });
              }
            } else {
              // Regular bloodline connection
              edgesToCreate.push({
                ...params,
                type: 'bloodline',
                data: { isDebugMode: showDebug }
              });
            }
            
            // Create all edges
            for (const edge of edgesToCreate) {
              try {
                await api.createEdge(edge);
                setEdges((eds) => addEdge(edge, eds));
              } catch (error) {
                console.error('Failed to create edge:', error);
              }
            }
          }
        }
      }
    },
    [isValidConnection, setEdges, nodes, edges, showDebug, setNodes],
  );

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
    // Only switch to editor tab if not in tagging mode or map mode
    if (!isTaggingMode && !isMapMode) {
      setActiveTab('editor'); // Switch to editor tab when a node is selected
    }
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isSelected: n.id === node.id }
      }))
    );
  }, [setNodes, setSelectedNode, setActiveTab, isTaggingMode, isMapMode]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isSelected: false }
      }))
    );
  }, [setNodes]);

  const updateNodeData = useCallback(async (nodeId, newData) => {
    try {
      const node = nodes.find(n => n.id === nodeId);
      await api.updateNode(nodeId, { position: node.position, data: newData });
      
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
    } catch (error) {
      console.error('Failed to update node:', error);
    }
  }, [setNodes, nodes]);

  // Enhanced update function for NodeDebugger (handles both data and position)
  const updateNodeDataAndPosition = useCallback(async (nodeId, newData, newPosition) => {
    try {
      const currentNode = nodes.find(n => n.id === nodeId);
      const finalPosition = newPosition || currentNode.position;
      
      // Check if bloodline status is being changed from true to false
      const wasBloodline = currentNode.data.bloodline;
      const isNowBloodline = newData.bloodline;
      
      await api.updateNode(nodeId, { position: finalPosition, data: newData });
      
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

      // If node was removed from bloodline, convert all its bloodline edges to fake
      if (wasBloodline && !isNowBloodline) {
        const nodeEdges = edges.filter(edge => 
          (edge.source === nodeId || edge.target === nodeId) && 
          edge.type === 'bloodline'
        );

        for (const edge of nodeEdges) {
          try {
            // Delete the old bloodline edge
            await api.deleteEdge(edge.id);
            
            // Create a new fake bloodline edge with the same properties
            const fakeEdge = {
              ...edge,
              id: `fake-${edge.id}`,
              type: 'bloodlinefake',
              data: { isDebugMode: showDebug }
            };
            
            await api.createEdge(fakeEdge);
            
            // Update the edges state
            setEdges((eds) => 
              eds.map(e => e.id === edge.id ? fakeEdge : e)
            );
          } catch (error) {
            console.error('Failed to convert bloodline edge to fake:', error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to update node:', error);
      throw error; // Re-throw so NodeDebugger can handle it
    }
  }, [setNodes, nodes, edges, setEdges, showDebug]);

  // Delete node functionality
  const deleteNode = useCallback(async (nodeId) => {
    try {
      await api.deleteNode(nodeId);
      
      // Remove from UI
      setNodes((nds) => nds.filter(node => node.id !== nodeId));
      setEdges((eds) => eds.filter(edge => edge.source !== nodeId && edge.target !== nodeId));
      
      // Clear selection if deleted node was selected
      setSelectedNode(null);
    } catch (error) {
      console.error('Failed to delete node:', error);
    }
  }, [setNodes, setEdges]);

  // Check if a node has any connections
  const nodeHasConnections = useCallback((nodeId) => {
    return edges.some(edge => edge.source === nodeId || edge.target === nodeId);
  }, [edges]);

  // Handle person selection from image gallery
  const handlePersonSelectFromGallery = useCallback((personId) => {
    const person = nodes.find(node => node.id === personId);
    if (person) {
      setSelectedNode(person);
      // Only switch to editor tab if not in tagging mode
      if (!isTaggingMode) {
        setActiveTab('editor');
      }
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, isSelected: n.id === personId }
        }))
      );
    }
  }, [nodes, setNodes, isTaggingMode]);

  // Handle person selection from map - focus on tree location instead of opening editor
  const handlePersonSelectFromMap = useCallback((personId) => {
    const person = nodes.find(node => node.id === personId);
    if (person) {
      setSelectedNode(person);
      // Focus the tree view on the selected person's position with a slight delay
      setTimeout(() => {
        fitView({
          padding: 0.3,
          duration: 1000,
          nodes: [{ id: personId }] // Focus only on this node
        });
      }, 150);
      
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, isSelected: n.id === personId }
        }))
      );
    }
  }, [nodes, setNodes, fitView]);

  // Handle tagging mode changes from image gallery
  const handleTaggingModeChange = useCallback((isTagging) => {
    setIsTaggingMode(isTagging);
  }, []);

  // Handle map mode changes
  const handleMapModeChange = useCallback((isMapActive) => {
    setIsMapMode(isMapActive);
  }, []);

  const onConnectEnd = useCallback(
    async (event, connectionState) => {
      if (!connectionState.isValid && connectionState.fromNode && connectionState.fromHandle) {
        try {
          const sourceHandle = connectionState.fromHandle.id;
          const sourceNode = connectionState.fromNode;
          
          const newId = getId();
          const { clientX, clientY } =
            'changedTouches' in event ? event.changedTouches[0] : event;
          
          const newNodeData = {
            name: 'Neue Person',
            surname: sourceNode.data.surname,
            birthDate: '',
            deathDate: '',
            street: sourceNode.data.street || '',
            city: sourceNode.data.city || '',
            zip: sourceNode.data.zip || '',
            country: sourceNode.data.country || '',
            phone: '',
            gender: Math.random() > 0.5 ? 'male' : 'female',
            numberOfPartners: 0, // Track number of partners for sizing
            isSelected: false,
            bloodline: !sourceHandle.includes('partner') // true for parent/child handles, false for partner handles
          };

          const newPosition = screenToFlowPosition({ x: clientX, y: clientY });
          
          // Adjust the position and birth date depending on the respective handle it is generated from
          if (sourceHandle === 'parent') {
            newNodeData.name = 'Elternteil';
            newNodeData.birthDate = calculateBirthDate(sourceNode, 'parent');
            newPosition.y -= 50; // Adjust position for children
          } else if (sourceHandle === 'child') {
            newNodeData.name = 'Kind';
            newNodeData.birthDate = calculateBirthDate(sourceNode, 'child');
            
          } else if (sourceHandle === 'partner-left') {
            newNodeData.name = 'Partner'; 
            newNodeData.birthDate = calculateBirthDate(sourceNode, 'partner');
            newPosition.x -= 75; // Adjust position for left partner
            newPosition.y -= 25
          } else if (sourceHandle === 'partner-right') {
            newNodeData.name = 'Partner';
            newNodeData.birthDate = calculateBirthDate(sourceNode, 'partner');
            newPosition.x += 75; // Adjust position for right partner
            newPosition.y -= 25; // Adjust position for right partner
          }

          const newNode = {
            id: newId,
            type: 'person',
            position: newPosition,
            data: newNodeData,
          };

          // Save to database first
          await api.createNode(newNode);
          
          // Add to UI
          setNodes((nds) => [...nds, newNode]);

          setTimeout(() => {
            updateNodeInternals(newId);
            
            setTimeout(async () => {
              let newEdges = []; // Array to hold multiple edges
              
              // Function to find bloodline partner of a given node using node properties
              const findBloodlinePartner = (nodeId) => {
                for (const edge of edges) {
                  if (edge.type === 'partner') {
                    if (edge.source === nodeId) {
                      const targetNode = nodes.find(n => n.id === edge.target);
                      if (targetNode && targetNode.data.bloodline) {
                        return edge.target;
                      }
                    } else if (edge.target === nodeId) {
                      const sourceNode = nodes.find(n => n.id === edge.source);
                      if (sourceNode && sourceNode.data.bloodline) {
                        return edge.source;
                      }
                    }
                  }
                }
                return null;
              };

              if (sourceHandle === 'parent') {
                if (sourceNode.data.bloodline) {
                  // Source is bloodline node - create normal bloodline edge
                  newEdges.push({
                    id: `edge-${newId}`,
                    source: newId,
                    target: sourceNode.id,
                    sourceHandle: 'child',
                    targetHandle: 'parent',
                    type: 'bloodline',
                    data: { isDebugMode: showDebug }
                  });
                } else {
                  // Source is partner node - create fake edge and hidden edge to bloodline partner
                  newEdges.push({
                    id: `edge-${newId}`,
                    source: newId,
                    target: sourceNode.id,
                    sourceHandle: 'child',
                    targetHandle: 'parent',
                    type: 'bloodlinefake',
                    data: { isDebugMode: showDebug }
                  });
                  
                  const bloodlinePartner = findBloodlinePartner(sourceNode.id);
                  if (bloodlinePartner) {
                    newEdges.push({
                      id: `edge-hidden-${newId}`,
                      source: newId,
                      target: bloodlinePartner,
                      sourceHandle: 'child',
                      targetHandle: 'parent',
                      type: 'bloodlinehidden',
                      data: { isDebugMode: showDebug }
                    });
                  }
                }
              } else if (sourceHandle === 'child') {
                if (sourceNode.data.bloodline) {
                  // Source is bloodline node - create normal bloodline edge
                  newEdges.push({
                    id: `edge-${newId}`,
                    source: sourceNode.id,
                    target: newId,
                    sourceHandle: 'child',
                    targetHandle: 'parent',
                    type: 'bloodline',
                    data: { isDebugMode: showDebug }
                  });
                } else {
                  // Source is partner node - create fake edge and hidden edge to bloodline partner
                  newEdges.push({
                    id: `edge-${newId}`,
                    source: sourceNode.id,
                    target: newId,
                    sourceHandle: 'child',
                    targetHandle: 'parent',
                    type: 'bloodlinefake',
                    data: { isDebugMode: showDebug }
                  });
                  
                  const bloodlinePartner = findBloodlinePartner(sourceNode.id);
                  if (bloodlinePartner) {
                    newEdges.push({
                      id: `edge-hidden-${newId}`,
                      source: bloodlinePartner,
                      target: newId,
                      sourceHandle: 'child',
                      targetHandle: 'parent',
                      type: 'bloodlinehidden',
                      data: { isDebugMode: showDebug }
                    });
                  }
                }
            } else if (sourceHandle === 'partner-left') {
              newEdges.push({
                id: `edge-${newId}`,
                source: sourceNode.id,
                target: newId,
                sourceHandle: 'partner-left',
                targetHandle: 'partner-right',
                type: 'partner',
                data: { isDebugMode: showDebug }
              });
            } else if (sourceHandle === 'partner-right') {
              newEdges.push({
                id: `edge-${newId}`,
                source: newId,
                target: sourceNode.id,
                sourceHandle: 'partner-left',
                targetHandle: 'partner-right',
                type: 'partner',
                data: { isDebugMode: showDebug }
              });
            }              // Create all edges
              for (const edge of newEdges) {
                try {
                  await api.createEdge(edge);
                  setEdges((eds) => [...eds, edge]);
                } catch (error) {
                  console.error('Failed to create edge:', error);
                }
              }
            }, 25);
          }, 25);
          
        } catch (error) {
          console.error('Error creating new node:', error);
        }
      }
    },
    [screenToFlowPosition, setNodes, setEdges, updateNodeInternals, nodes, edges, showDebug],
  );

  if (loading) {
    return <div>Loading family tree...</div>;
  }

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      width: '100vw',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      <div style={{ 
        flex: 1, 
        minWidth: 0, // Allows flex item to shrink below its content size
        overflow: 'hidden'
      }}>
        <article className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px' }}>
          <h1>Familie Inntertal</h1>
          <p>Verbindungen über generationen</p>
          <p>Hilf jetzt mit unseren Stammbaum zu vervollständigen</p>
        </article>
        <div style={{ width: '100%', height: 'calc(100vh - 120px)' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onConnectEnd={onConnectEnd}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            isValidConnection={isValidConnection}
            fitView
            fitViewOptions={{ padding: 2 }}
            nodeOrigin={nodeOrigin}
          >
            <Background />
          </ReactFlow>
        </div>
      </div>
      
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
                    
                    <button 
                      onClick={() => setShowDebug(!showDebug)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: showDebug ? '#FF5722' : '#9C27B0',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        fontSize: '16px',
                        cursor: 'pointer',
                        marginBottom: '10px'
                      }}
                      onMouseOver={(e) => e.target.style.backgroundColor = showDebug ? '#E64A19' : '#7B1FA2'}
                      onMouseOut={(e) => e.target.style.backgroundColor = showDebug ? '#FF5722' : '#9C27B0'}
                    >
                      {showDebug ? '🚫 Hide Debug' : '🔧 Show Debug'}
                    </button>
                    
                    <p style={{ fontSize: '0.8rem', opacity: 0.8, margin: '0 0 20px 0' }}>
                      Auto Layout: Strg+L (Cmd+L)<br/>
                      Fit to View: Strg+F (Cmd+F)
                    </p>
                    
                    {showDebug && debugInfo && (
                      <div style={{ 
                        backgroundColor: '#1e1e1e', 
                        padding: '15px', 
                        borderRadius: '5px', 
                        marginBottom: '20px',
                        fontSize: '0.8rem',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        border: '1px solid #444'
                      }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#FFF' }}>🔧 ELK Debug Info</h4>
                        
                        <div style={{ marginBottom: '15px' }}>
                          <strong style={{ color: '#4CAF50' }}>Overview:</strong>
                          <div>Total Nodes: {debugInfo.nodeCount}</div>
                          <div>Bloodline Nodes (in ELK): {debugInfo.bloodlineNodeCount}</div>
                          <div>Partner-only Nodes: {debugInfo.partnerOnlyNodeCount}</div>
                          <div>Bloodline Edges (for layout): {debugInfo.edgeCount}</div>
                          <div>Fake Bloodline Edges (ignored): {debugInfo.fakeEdgeCount}</div>
                          <div>Partner Edges: {debugInfo.partnerEdgeCount}</div>
                        </div>
                        
                        <div style={{ marginBottom: '15px' }}>
                          <strong style={{ color: '#2196F3' }}>Partner Counts:</strong>
                          {debugInfo.partnerCounts.map(([nodeId, count]) => (
                            <div key={nodeId} style={{ marginLeft: '10px' }}>
                              Node {nodeId}: {count} partner{count !== 1 ? 's' : ''}
                            </div>
                          ))}
                        </div>
                        
                        <div>
                          <strong style={{ color: '#FF9800' }}>ELK Node Dimensions:</strong>
                          {debugInfo.elkNodes.map(node => (
                            <div key={node.id} style={{ 
                              marginLeft: '10px', 
                              marginBottom: '8px',
                              padding: '5px',
                              backgroundColor: '#333',
                              borderRadius: '3px'
                            }}>
                              <div><strong>Node {node.id}:</strong></div>
                              <div>• Width: {node.width}px</div>
                              <div>• Height: {node.height}px</div>
                              <div>• Partners: {node.properties.numberOfPartners}</div>
                              <div>• Birth: {node.properties.birthDate || 'Not set'}</div>
                            </div>
                          ))}
                        </div>
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
              onPersonSelect={handlePersonSelectFromGallery}
              onTaggingModeChange={handleTaggingModeChange}
            />
          )}
          
          {activeTab === 'map' && (
            <MapView 
              nodes={nodes}
              selectedNode={selectedNode}
              onPersonSelect={handlePersonSelectFromMap}
              onMapModeChange={handleMapModeChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const App = () => (
  <ReactFlowProvider>
    <AddNodeOnEdgeDrop />
  </ReactFlowProvider>
);

export default App;
