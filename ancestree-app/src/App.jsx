import React, { useCallback, useRef, useState, useEffect } from 'react';
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
import PersonNode from './PersonNode';
import NodeEditor from './NodeEditor';
import PartnerEdge from './PartnerEdge';
import BloodlineEdge from './BloodlineEdge';
import { api } from './api';

import '@xyflow/react/dist/style.css';

const nodeTypes = {
  person: PersonNode,
};

const edgeTypes = {
  partner: PartnerEdge,
  bloodline: BloodlineEdge,
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
  const reactFlowWrapper = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(true);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

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

  // Auto layout functionality
  const autoLayout = useCallback(async () => {
    if (nodes.length === 0) return;

    // Build relationships from edges
    const relationships = {
      children: new Map(), // nodeId -> [childIds]
      parents: new Map(),  // nodeId -> [parentIds]
      partners: new Map()  // nodeId -> [partnerIds]
    };

    // Initialize maps
    nodes.forEach(node => {
      relationships.children.set(node.id, []);
      relationships.parents.set(node.id, []);
      relationships.partners.set(node.id, []);
    });

    // Populate relationships from edges
    edges.forEach(edge => {
      if (edge.type === 'bloodline') {
        if (edge.sourceHandle === 'child' && edge.targetHandle === 'parent') {
          relationships.children.get(edge.target)?.push(edge.source);
          relationships.parents.get(edge.source)?.push(edge.target);
        }
      } else if (edge.type === 'partner') {
        relationships.partners.get(edge.source)?.push(edge.target);
        relationships.partners.get(edge.target)?.push(edge.source);
      }
    });

    // Find root nodes (nodes with no parents)
    const rootNodes = nodes.filter(node => 
      relationships.parents.get(node.id)?.length === 0
    );

    if (rootNodes.length === 0) {
      // If no clear root, pick the oldest person or first node
      const oldestNode = nodes.reduce((oldest, current) => {
        const currentBirth = current.data.birthDate;
        const oldestBirth = oldest.data.birthDate;
        if (!currentBirth) return oldest;
        if (!oldestBirth) return current;
        return currentBirth < oldestBirth ? current : oldest;
      });
      rootNodes.push(oldestNode);
    }

    // Layout configuration
    const nodeWidth = 200;
    const nodeHeight = 150;
    const horizontalSpacing = 250;
    const verticalSpacing = 200;
    const partnerSpacing = 280;

    const layoutedNodes = new Map();
    const processedNodes = new Set();

    // Position nodes level by level
    const positionSubtree = (nodeId, x, y, generation) => {
      if (processedNodes.has(nodeId) || layoutedNodes.has(nodeId)) {
        return layoutedNodes.get(nodeId) || { x, y };
      }

      processedNodes.add(nodeId);
      
      // Position current node
      layoutedNodes.set(nodeId, { x, y });

      // Position partners next to each other
      const partners = relationships.partners.get(nodeId) || [];
      partners.forEach((partnerId, index) => {
        if (!processedNodes.has(partnerId)) {
          const partnerX = x + partnerSpacing * (index + 1);
          layoutedNodes.set(partnerId, { x: partnerX, y });
          processedNodes.add(partnerId);
        }
      });

      // Position children in the next generation
      const children = relationships.children.get(nodeId) || [];
      if (children.length > 0) {
        const childY = y + verticalSpacing;
        const totalChildrenWidth = (children.length - 1) * horizontalSpacing;
        const startX = x - totalChildrenWidth / 2;

        children.forEach((childId, index) => {
          const childX = startX + index * horizontalSpacing;
          positionSubtree(childId, childX, childY, generation + 1);
        });
      }

      return { x, y };
    };

    // Start layout from root nodes
    let currentX = 0;
    rootNodes.forEach((rootNode, index) => {
      positionSubtree(rootNode.id, currentX, 100, 0);
      currentX += 600; // Space between different family trees
    });

    // Position any remaining unconnected nodes
    let orphanX = currentX + 300;
    nodes.forEach(node => {
      if (!layoutedNodes.has(node.id)) {
        layoutedNodes.set(node.id, { x: orphanX, y: 100 });
        orphanX += horizontalSpacing;
      }
    });

    // Update all node positions
    const updatedNodes = nodes.map(node => {
      const newPosition = layoutedNodes.get(node.id) || node.position;
      return {
        ...node,
        position: newPosition
      };
    });

    // Update UI
    setNodes(updatedNodes);

    // Save all position changes to database
    try {
      await Promise.all(
        updatedNodes.map(node => 
          api.updateNode(node.id, { position: node.position, data: node.data })
        )
      );
    } catch (error) {
      console.error('Failed to save layout changes:', error);
    }
  }, [nodes, edges, setNodes]);

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
        const edgeType = (params.sourceHandle?.includes('partner') || params.targetHandle?.includes('partner')) 
          ? 'partner' 
          : 'bloodline';
        
        const newEdge = { ...params, type: edgeType };
        
        try {
          await api.createEdge(newEdge);
          setEdges((eds) => addEdge(newEdge, eds));
        } catch (error) {
          console.error('Failed to create edge:', error);
        }
      }
    },
    [isValidConnection, setEdges],
  );

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isSelected: n.id === node.id }
      }))
    );
  }, [setNodes]);

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
            ? { ...node, data: { ...node.data, ...newData } }
            : node
        )
      );
    } catch (error) {
      console.error('Failed to update node:', error);
    }
  }, [setNodes, nodes]);

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

  const onConnectEnd = useCallback(
    async (event, connectionState) => {
      if (!connectionState.isValid && connectionState.fromNode && connectionState.fromHandle) {
        try {
          const newId = getId();
          const { clientX, clientY } =
            'changedTouches' in event ? event.changedTouches[0] : event;
          
          const sourceHandle = connectionState.fromHandle.id;
          const sourceNode = connectionState.fromNode;
          
          const newNodeData = {
            name: 'Neue Person',
            surname: sourceNode.data.surname,
            birthDate: '',
            deathDate: '',
            street: sourceNode.data.street || '',
            city: sourceNode.data.city || '',
            zip: sourceNode.data.zip || '',
            country: sourceNode.data.country || '',
            phone: sourceNode.data.phone || '',
            gender: Math.random() > 0.5 ? 'male' : 'female',
            isSelected: false
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
              let newEdge = null;
              
              if (sourceHandle === 'parent') {
                newEdge = {
                  id: `edge-${newId}`,
                  source: newId,
                  target: sourceNode.id,
                  sourceHandle: 'child',
                  targetHandle: 'parent',
                  type: 'bloodline'
                };
              } else if (sourceHandle === 'child') {
                newEdge = {
                  id: `edge-${newId}`,
                  source: sourceNode.id,
                  target: newId,
                  sourceHandle: 'child',
                  targetHandle: 'parent',
                  type: 'bloodline'
                };
              } else if (sourceHandle === 'partner-left') {
                newEdge = {
                  id: `edge-${newId}`,
                  source: sourceNode.id,
                  target: newId,
                  sourceHandle: 'partner-left',
                  targetHandle: 'partner-right',
                  type: 'partner'
                };
              } else if (sourceHandle === 'partner-right') {
                newEdge = {
                  id: `edge-${newId}`,
                  source: newId,
                  target: sourceNode.id,
                  sourceHandle: 'partner-left',
                  targetHandle: 'partner-right',
                  type: 'partner'
                };
              }

              if (newEdge) {
                try {
                  await api.createEdge(newEdge);
                  setEdges((eds) => [...eds, newEdge]);
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
    [screenToFlowPosition, setNodes, setEdges, updateNodeInternals],
  );

  if (loading) {
    return <div>Loading family tree...</div>;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <div style={{ flex: 1 }}>
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
        width: '300px', 
        borderLeft: '1px solid #ccc', 
        backgroundColor: '#09380dff',
        padding: '20px'
      }}>
        {selectedNode ? (
          <NodeEditor 
            node={selectedNode} 
            onUpdate={updateNodeData}
            onDelete={deleteNode}
            hasConnections={nodeHasConnections(selectedNode.id)}
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
    </div>
  );
}

const App = () => (
  <ReactFlowProvider>
    <AddNodeOnEdgeDrop />
  </ReactFlowProvider>
);

export default App;
