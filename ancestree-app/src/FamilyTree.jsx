import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  Background,
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useUpdateNodeInternals,
} from '@xyflow/react';
import ELK from 'elkjs/lib/elk.bundled.js';
import PersonNode from './PersonNode';
import FamilyNode from './FamilyNode';
import PartnerEdge from './PartnerEdge';
import BloodlineEdge from './BloodlineEdge';
import BloodlineEdgeHidden from './BloodlineEdgeHidden';
import BloodlineEdgeFake from './BloodlineEdgeFake';
import ElkDebugOverlay from './ElkDebugOverlay';
import { api } from './api';
import { useSocket } from './hooks/useSocket';
import { useDebounce } from './hooks/useDebounce';

import '@xyflow/react/dist/style.css';

const nodeTypes = {
  person: PersonNode,
  family: FamilyNode,
};

const edgeTypes = {
  partner: PartnerEdge,
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

// Helper function to check if a node is on the bloodline
// Family nodes are always considered bloodline nodes
const isBloodlineNode = (node) => {
  return node.type === 'family' || node.data.bloodline;
};

const FamilyTree = ({ 
  selectedNode, 
  setSelectedNode, 
  showDebug, 
  setDebugInfo, 
  isTaggingMode, 
  isMapMode,
  onNodeUpdate 
}) => {
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [elkDebugData, setElkDebugData] = useState(null);
  const [showElkDebug, setShowElkDebug] = useState(false);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  // Real-time collaboration setup
  const { socket, isConnected, userCount, isCollaborating } = useSocket('http://localhost:3001');
  const [recentChanges, setRecentChanges] = useState(new Set());

  // Debounced position update for real-time collaboration
  const [debouncedPositionUpdate] = useDebounce((nodeId, position) => {
    if (socket && isCollaborating) {
      socket.emit('node:position', { nodeId, position });
    }
  }, 300);

  // Update edges with debug mode information when showDebug changes
  useEffect(() => {
    setEdges((currentEdges) =>
      currentEdges.map((edge) => ({
        ...edge,
        data: { ...edge.data, isDebugMode: showDebug }
      }))
    );
    
    // Clear ELK debug data when debug mode is turned off
    if (!showDebug) {
      setElkDebugData(null);
      setShowElkDebug(false);
    }
  }, [showDebug, setEdges]);

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
    socket.on('node:created', (remoteNode) => {
      console.log('Remote node created:', remoteNode);
      setNodes(nds => {
        // Check if node already exists to prevent duplicates
        if (nds.find(n => n.id === remoteNode.id)) return nds;
        return [...nds, remoteNode];
      });
      addRecentChangeIndicator(remoteNode.id);
    });

    // Listen for remote node updates
    socket.on('node:updated', (remoteNode) => {
      console.log('Remote node updated:', remoteNode);
      setNodes(nds => nds.map(n => 
        n.id === remoteNode.id 
          ? { 
              ...n, 
              ...remoteNode, 
              data: { 
                ...n.data, 
                ...remoteNode.data, 
                isRecentChange: true 
              } 
            }
          : n
      ));
      addRecentChangeIndicator(remoteNode.id);
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
      
      setNodes(nds => nds.map(n => 
        n.id === nodeId 
          ? { ...n, position }
          : n
      ));
    });

    // Listen for remote edge creation
    socket.on('edge:created', (remoteEdge) => {
      console.log('Remote edge created:', remoteEdge);
      setEdges(eds => {
        // Check if edge already exists to prevent duplicates
        if (eds.find(e => e.id === remoteEdge.id)) return eds;
        return [...eds, remoteEdge];
      });
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
              await api.updateNode(change.id, { 
                position: change.position, 
                data: node.data 
              });
            }
          } catch (error) {
            console.error('Failed to update node position:', error);
          }
        }
      } else if (change.type === 'remove') {
        // Handle node deletions - only delete from database
        // React Flow will only allow deletion if no edges are connected
        try {
          await api.deleteNode(change.id);
        } catch (error) {
          console.error('Failed to delete node:', error);
        }
      }
    }
  }, [onNodesChange, nodes, debouncedPositionUpdate]);

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
            disabledHandles: node.data.disabledHandles || [],
            isRecentChange: false // Initialize recent change indicator
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
        
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [setNodes, setEdges]);

  // Function to refresh data from database (for ensuring sync)
  const refreshData = useCallback(async () => {
    try {
      const [nodesData, edgesData] = await Promise.all([
        api.loadNodes(),
        api.loadEdges()
      ]);
      
      // Process nodes with React Flow properties
      const processedNodes = nodesData.map(node => ({
        ...node,
        deletable: true,
        selectable: true,
        data: {
          ...node.data,
          bloodline: node.type === 'family' ? true : (node.data.bloodline !== undefined ? node.data.bloodline : true),
          disabledHandles: node.data.disabledHandles || [],
          isRecentChange: false // Initialize recent change indicator
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
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  }, [setNodes, setEdges, showDebug]);

  // Auto layout using ELK with Y-axis constraint based on birth year
  const autoLayout = useCallback(async () => {
    if (nodes.length === 0) return;

    try {
      const elk = new ELK();
      
      // Helper function to get birth year from a node
      const getBirthYear = (node) => {
        if (!node.data.birthDate) return 1950; // Default fallback
        const year = parseInt(node.data.birthDate.split('-')[0]);
        return isNaN(year) ? 1950 : year;
      };

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
          edge.type === 'partner' && 
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
        const clusterEdges = [];
        
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
          bounds: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY },
          birthYear: getBirthYear(bloodlineNode)
        });

        processedNodes.add(bloodlineNode.id);
      }

      // Sort clusters by birth year for Y positioning
      elkClusters.sort((a, b) => a.birthYear - b.birthYear);

      // Calculate Y positions based on birth years
      const minBirthYear = Math.min(...elkClusters.map(c => c.birthYear));
      const maxBirthYear = Math.max(...elkClusters.map(c => c.birthYear));
      const yearRange = maxBirthYear - minBirthYear || 1;
      const ySpacing = 70; // Reduced pixels per year for more compact layout
      const baseY = 0;

      // Create ELK graph with clusters as nodes and bloodline connections as edges
      const elkGraph = {
        id: "root",
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'DOWN',
          'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
          'elk.layered.crossingMinimization.semiInteractive': 'true',
          'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
          'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
          'elk.separateConnectedComponents': 'false',
          'elk.layered.thoroughness': '1'
        },
        children: [],
        edges: []
      };

      // Add clusters as ELK nodes with ports for family nodes
      elkClusters.forEach((cluster, index) => {
        const clusterY = ((cluster.birthYear - minBirthYear) / Math.max(yearRange, 1)) * ySpacing;
        
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
            
            let primaryTargetCluster = null;
            let primaryTargetType = 'external';
            
            if (targetClusterIndex !== -1) {
              primaryTargetCluster = elkClusters[targetClusterIndex];
              primaryTargetType = `cluster-${targetClusterIndex}`;
            }
            
            // Determine port side and position based on family node position and target direction
            let portSide = 'SOUTH';
            let basePortX = familyNode.x - cluster.bounds.minX + 50;
            let portY = cluster.bounds.height + 100;
            
            if (primaryTargetCluster) {
              if (primaryTargetCluster.birthYear > cluster.birthYear) {
                // Target is younger - port on bottom edge
                portSide = 'SOUTH';
                portY = cluster.bounds.height + 100;
              } else {
                // Target is older - port on top edge  
                portSide = 'NORTH';
                portY = 0;
              }
            }
            
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
                'elk.port.index': `${portIndex}`,
                'elk.port.anchor': `(${portX}, ${portY})`
              },
              // Store metadata for debug purposes and edge mapping
              metadata: {
                familyNodes: [familyNode.id],
                targetGroup: primaryTargetType,
                groupSize: 1,
                familyNodeX: familyNode.x,
                familyNodeY: familyNode.y,
                edgeId: edge.id, // Store the edge ID for mapping
                targetNodeId: otherNodeId
              }
            });
            
            portIndex++;
          });
        });
        
        elkGraph.children.push({
          id: `cluster-${index}`,
          width: cluster.bounds.width + 100,
          height: cluster.bounds.height + 100,
          ports: ports,
          layoutOptions: {
            'elk.position': `(0,${clusterY})`,
            'elk.priority': `${Math.max(1, connectionCount)}`,
            'elk.layered.priority': `${cluster.birthYear}`,
            'elk.layered.layerConstraint': 'FIRST_SEPARATE'
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
            
            // Determine direction based on birth years (older -> younger)
            const sourceCluster = elkClusters[sourceClusterIndex];
            const targetCluster = elkClusters[targetClusterIndex];
            const isDownward = sourceCluster.birthYear <= targetCluster.birthYear;
            
            const finalSourceIndex = isDownward ? sourceClusterIndex : targetClusterIndex;
            const finalTargetIndex = isDownward ? targetClusterIndex : sourceClusterIndex;
            
            // Determine which nodes are involved in the correctly oriented edge
            const effectiveSourceNode = isDownward ? sourceNode : targetNode;
            const effectiveTargetNode = isDownward ? targetNode : sourceNode;
            
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
            
            // Create edge with unique ID based on the original edge
            const elkEdge = {
              id: `edge-inter-${edge.id}`,
              sources: [sourcePort ? `${sourcePort}` : `cluster-${finalSourceIndex}`],
              targets: [targetPort ? `${targetPort}` : `cluster-${finalTargetIndex}`],
              layoutOptions: {
                'elk.layered.priority': '5',
                'elk.layered.crossingMinimization.positionChoiceConstraint': '0'
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
      
      remainingNodes.forEach((node, index) => {
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
          // Position standalone person nodes based on birth year
          const birthYear = getBirthYear(node);
          const nodeY = ((birthYear - minBirthYear) / Math.max(yearRange, 1)) * ySpacing;
          finalPositions.set(node.id, { x: maxClusterX + 200 + standaloneX, y: nodeY });
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
            await api.updateNode(nodeId, { 
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
  }, [nodes, edges, setNodes, fitView]);

  // Fit tree to view
  const fitTreeToView = useCallback(() => {
    fitView({ 
      padding: 0.2,
      duration: 800
    });
  }, [fitView]);

  // Simplified validation - allow all connections
  const isValidConnection = useCallback((connection) => {
    return true;
  }, []);

  const onConnect = useCallback(
    async (params) => {
      // Get source and target nodes to validate connection
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);
      
      if (!sourceNode || !targetNode) return;
      
      // Validate connection rules
      const isValidConnection = validateConnection(
        sourceNode, 
        targetNode, 
        params.sourceHandle, 
        params.targetHandle
      );
      
      if (!isValidConnection) {
        console.log('Connection prohibited by family tree rules');
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
          await api.deleteEdge(existingHiddenEdge.id);
          
          const replacementEdge = {
            ...existingHiddenEdge,
            type: edgeType, // Use the determined edge type (bloodline, bloodlinefake, or partner)
            id: getId(), // Generate new ID
            data: { isDebugMode: showDebug }
          };
          
          await api.createEdge(replacementEdge);
          // Edge replacement will be handled by socket listeners:
          // 1. Deletion event will remove the old edge
          // 2. Creation event will add the new edge
        } else {
          // Create new edge normally
          await api.createEdge(newEdge);
          // Note: Edge will be added to state via socket listener when backend confirms creation
        }
        
        // Special case: When connecting two bloodline nodes with partner edge
        // (applies to both new edges and replaced hidden edges)
        if (edgeType === 'partner' && isBloodlineNode(sourceNode) && isBloodlineNode(targetNode)) {
          // Use a timeout to ensure the partner edge is added to state first
          setTimeout(async () => {
            try {
              // Set target node bloodline status to false
              const updatedTargetNode = {
                ...targetNode,
                data: { ...targetNode.data, bloodline: false }
              };
              
              await api.updateNode(targetNode.id, { 
                position: targetNode.position, 
                data: updatedTargetNode.data 
              });
              
              setNodes((nds) => 
                nds.map(n => n.id === targetNode.id ? updatedTargetNode : n)
              );
              
              // Get current edges including the newly created partner edge
              setEdges((currentEdges) => {
                // Find all family connections from the target node and convert to fake bloodline edges
                const targetFamilyEdges = currentEdges.filter(edge => 
                  (edge.source === targetNode.id && (edge.sourceHandle === 'child' || edge.sourceHandle === 'parent')) ||
                  (edge.target === targetNode.id && (edge.targetHandle === 'child' || edge.targetHandle === 'parent'))
                );
                
                // Convert family edges to fake bloodline edges and collect family nodes
                const affectedFamilyNodes = [];
                let updatedEdges = [...currentEdges];
                
                for (const familyEdge of targetFamilyEdges) {
                  if (familyEdge.type === 'bloodline') {
                    // Delete old edge and create new fake bloodline edge
                    api.deleteEdge(familyEdge.id);
                    
                    const updatedFamilyEdge = { 
                      ...familyEdge, 
                      type: 'bloodlinefake',
                      id: getId() // Generate new ID for the replacement edge
                    };
                    
                    api.createEdge(updatedFamilyEdge);
                    
                    // Note: Edge updates will be handled by socket listeners
                    // Remove old edge from local state immediately to prevent display issues
                    updatedEdges = updatedEdges.filter(e => e.id !== familyEdge.id);
                    
                    // Collect family node for hidden edge creation
                    const familyNodeId = familyEdge.source === targetNode.id ? familyEdge.target : familyEdge.source;
                    const familyNode = nodes.find(n => n.id === familyNodeId);
                    if (familyNode && familyNode.type === 'family') {
                      affectedFamilyNodes.push({ familyNode, familyEdge: updatedFamilyEdge });
                    }
                  }
                }
                
                // Create hidden bloodline edges from source bloodline node to family nodes
                affectedFamilyNodes.forEach(({ familyNode, familyEdge }) => {
                  // Check if family node already has hidden or true bloodline edges (excluding the one we just converted)
                  const existingBloodlineEdges = updatedEdges.filter(edge => 
                    (edge.source === familyNode.id || edge.target === familyNode.id) &&
                    (edge.type === 'bloodline' || edge.type === 'bloodlinehidden') &&
                    edge.id !== familyEdge.id
                  );
                  
                  if (existingBloodlineEdges.length === 0) {
                    // Create hidden bloodline edge from source bloodline node to family
                    const hiddenEdgeId = getId();
                    let hiddenEdge;
                    
                    if (familyEdge.source === targetNode.id && familyEdge.sourceHandle === 'child') {
                      // Source node child -> Family parentconnection (hidden)
                      hiddenEdge = {
                        id: hiddenEdgeId,
                        source: sourceNode.id,
                        target: familyNode.id,
                        sourceHandle: 'child',
                        targetHandle: 'parentconnection',
                        type: 'bloodlinehidden',
                        data: { isDebugMode: showDebug }
                      };
                    } else if (familyEdge.target === targetNode.id && familyEdge.targetHandle === 'parent') {
                      // Family childrenconnection -> Source node parent (hidden)
                      hiddenEdge = {
                        id: hiddenEdgeId,
                        source: familyNode.id,
                        target: sourceNode.id,
                        sourceHandle: 'childrenconnection',
                        targetHandle: 'parent',
                        type: 'bloodlinehidden',
                        data: { isDebugMode: showDebug }
                      };
                    }
                    
                    if (hiddenEdge) {
                      api.createEdge(hiddenEdge);
                      // Note: Hidden edge will be added to state via socket listener
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
    [setEdges, showDebug, nodes],
  );

  // Validation function for connection rules
  const validateConnection = (sourceNode, targetNode, sourceHandle, targetHandle) => {
    // Prohibit direct Family-to-Family connections
    if (sourceNode.type === 'family' && targetNode.type === 'family') {
      return false;
    }
    
    // Prohibit direct Person parent-to-child connections
    if (sourceNode.type === 'person' && targetNode.type === 'person') {
      if ((sourceHandle === 'parent' && targetHandle === 'child') ||
          (sourceHandle === 'child' && targetHandle === 'parent')) {
        return false;
      }
    }
    
    return true;
  };

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isSelected: n.id === node.id }
      }))
    );
  }, [setNodes, setSelectedNode]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isSelected: false }
      }))
    );
  }, [setNodes]);

  const onConnectEnd = useCallback(
    async (event, connectionState) => {
      if (!connectionState.isValid && connectionState.fromNode && connectionState.fromHandle) {
        try {
          const sourceHandle = connectionState.fromHandle.id;
          const sourceNode = connectionState.fromNode;
          
          const newId = getId();
          const { clientX, clientY } =
            'changedTouches' in event ? event.changedTouches[0] : event;
          
          let dropPosition = screenToFlowPosition({ x: clientX, y: clientY });
          
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
                name: `Familie ${familyEstablishmentYear}`,
                surname: sourceNode.data.surname || '',
                birthDate: `${familyEstablishmentYear}-01-01`,
                street: sourceNode.data.street || '',
                city: sourceNode.data.city || '',
                zip: sourceNode.data.zip || '',
                country: sourceNode.data.country || '',
                sourcePersonBirthYear: sourcePersonBirthYear,
                isSelected: false,
                bloodline: true // Family nodes are always on the bloodline
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
                name: 'Partner',
                surname: sourceNode.data.surname || '',
                birthDate: `${partnerBirthYear}-01-01`,
                deathDate: '',
                street: sourceNode.data.street || '',
                city: sourceNode.data.city || '',
                zip: sourceNode.data.zip || '',
                country: sourceNode.data.country || '',
                phone: '',
                numberOfPartners: 0,
                isSelected: false,
                bloodline: false,
                disabledHandles: sourceHandle === 'partner-left' ? ['partner-left'] : ['partner-right']
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
              personName = 'Kind';
            } else {
              personName = 'Eltern';
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
            
            const personNodeData = {
              name: personName,
              surname: sourceNode.data.surname || '',
              birthDate: `${personBirthYear}-01-01`,
              deathDate: '',
              street: sourceNode.data.street || '',
              city: sourceNode.data.city || '',
              zip: sourceNode.data.zip || '',
              country: sourceNode.data.country || '',
              phone: '',
              numberOfPartners: 0,
              isSelected: false,
              bloodline: true,
              disabledHandles: []
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
          
          if (newNode && newEdge) {
            // Save to database and add to UI
            await api.createNode(newNode);
            setNodes((nds) => [...nds, newNode]);

            // Create edge after a short delay
            setTimeout(async () => {
              try {
                await api.createEdge(newEdge);
                // Note: Edge will be added to state via socket listener when backend confirms creation
                
                // Special case: If creating family from partner node, also create hidden bloodline edge from connected bloodline node
                if (newNode.type === 'family' && sourceNode.type === 'person' && !isBloodlineNode(sourceNode)) {
                  // Find the bloodline node connected to this partner
                  const partnerEdge = edges.find(edge => 
                    edge.type === 'partner' && 
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
                          await api.createEdge(hiddenEdge);
                          // Note: Edge will be added to state via socket listener when backend confirms creation
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
          }
          
        } catch (error) {
          console.error('Error creating new node:', error);
        }
      }
    },
    [screenToFlowPosition, setNodes, setEdges, showDebug, nodes, edges],
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
        updateNode,
        refreshData
      });
    }
  }, [nodes, edges, autoLayout, fitTreeToView, updateNode, refreshData, onNodeUpdate]);

  if (loading) {
    return <div>Loading family tree...</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
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
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        fitView
        fitViewOptions={{ padding: 2 }}
        nodeOrigin={nodeOrigin}
      >
        <Background />
      </ReactFlow>
      
      {/* Real-time Collaboration Indicator */}
      {isConnected && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px', // Moved to top-left (was ELK debug button position)
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
            ? `🤝 ${userCount} users collaborating`
            : `👤 ${userCount} user online`
          }
        </div>
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
