import React, { useCallback, useRef, useState } from 'react';
import {
  Background,
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  useUpdateNodeInternals, // Add this import
} from '@xyflow/react';
import PersonNode from './PersonNode';
import NodeEditor from './NodeEditor';
import PartnerEdge from './PartnerEdge';
import BloodlineEdge from './BloodlineEdge';

import '@xyflow/react/dist/style.css';

const nodeTypes = {
  person: PersonNode,
};

const edgeTypes = {
  partner: PartnerEdge,
  bloodline: BloodlineEdge,
};

const initialNodes = [
  {
    id: '0',
    type: 'person',
    data: {
      name: 'Moidal',
      surname: 'Erler',
      birthDate: '1950-01-01',
      deathDate: '1950-01-01',
      street: 'Hauptstraße 123',
      city: 'Tux',
      zip: '6293',
      country: 'AT',
      phone: '+43 5287 87123', // Add phone number
      gender: 'female',
      isSelected: false
    },
    position: { x: 0, y: 50 },
  },
];

let id = 1;
const getId = () => `${id++}`;
const nodeOrigin = [0.5, 0];

const AddNodeOnEdgeDrop = () => {
  const reactFlowWrapper = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals(); // Add this hook

  // Strict connection validation
  const isValidConnection = useCallback((connection) => {
    const { sourceHandle, targetHandle } = connection;

    console.log('Validating connection:', sourceHandle, '->', targetHandle);

    // Family connections: child handle -> parent handle ONLY
    if (sourceHandle === 'child' && targetHandle === 'parent') {
      return true;
    }

    // Partner connections: partner handles can only connect to other partner handles
    if ((sourceHandle === 'partner-left' && targetHandle === 'partner-right') ||
      (sourceHandle === 'partner-right' && targetHandle === 'partner-left')) {
      return true;
    }

    // Block all other combinations
    console.log('Connection blocked:', sourceHandle, '->', targetHandle);
    return false;
  }, []);

  const onConnect = useCallback(
    (params) => {
      console.log('Connection attempt:', params);
      if (isValidConnection(params)) {
        // Determine edge type based on handles
        const edgeType = (params.sourceHandle?.includes('partner') || params.targetHandle?.includes('partner'))
          ? 'partner'
          : 'bloodline';

        setEdges((eds) => addEdge({ ...params, type: edgeType }, eds));
      }
    },
    [isValidConnection],
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

  const updateNodeData = useCallback((nodeId, newData) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...newData } }
          : node
      )
    );
  }, [setNodes]);

  const onConnectEnd = useCallback(
    (event, connectionState) => {
      if (!connectionState.isValid && connectionState.fromNode && connectionState.fromHandle) {
        try {
          const newId = getId();
          const { clientX, clientY } =
            'changedTouches' in event ? event.changedTouches[0] : event;
          
          const sourceHandle = connectionState.fromHandle.id;
          const sourceNode = connectionState.fromNode;
          
          console.log('Creating new node from handle:', sourceHandle);
          

          // Base new node data - inherit from source node
          const newNodeData = {
            name: 'Name',
            surname: sourceNode.data.surname, // Copy surname from source node
            birthDate: '',
            deathDate: '',
            street: sourceNode.data.street || '', // Copy street from source node
            city: sourceNode.data.city || '',     // Copy city from source node
            zip: sourceNode.data.zip || '',       // Copy zip from source node
            country: sourceNode.data.country || '', // Copy country from source node
            phone: '', 
            gender: Math.random() > 0.5 ? 'male' : 'female',
            isSelected: false
          };      

          // Use the actual drop position instead of fixed positions
          const newPosition = screenToFlowPosition({ x: clientX, y: clientY });
          
          // Only set the name based on connection type, keep the drop position
          if (sourceHandle === 'parent') {
            newNodeData.name = 'Elternteil';
            newPosition.y -= 50; // Adjust position for children
          } else if (sourceHandle === 'child') {
            newNodeData.name = 'Kind';
            
          } else if (sourceHandle === 'partner-left') {
            newNodeData.name = 'Partner'; 
            newPosition.x -= 75; // Adjust position for left partner
            newPosition.y -= 25
          } else if (sourceHandle === 'partner-right') {
            newNodeData.name = 'Partner';
            newPosition.x += 75; // Adjust position for right partner
            newPosition.y -= 25; // Adjust position for right partner
          }

          const newNode = {
            id: newId,
            type: 'person',
            position: newPosition, // Use actual drop position
            data: newNodeData,
          };

          // Add the node first
          setNodes((nds) => [...nds, newNode]);

          // Update node internals to ensure handles are properly registered
          setTimeout(() => {
            updateNodeInternals(newId);

            // Then create the edge
            setTimeout(() => {
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
                console.log('Creating edge:', newEdge);
                setEdges((eds) => [...eds, newEdge]);
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
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
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

      {/* Right panel for node editing */}
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
          />
        ) : (
          <div style={{ color: 'white' }}>
            <h3>Wähle eine Person</h3>
            <p>Klicke auf eine beliebige Person, um ihre Informationen zu bearbeiten.</p>
            <p>Ziehe von einem farbigen Punkt ins leere, um eine neue Person hinzuzufügen.</p>
            <div style={{ marginTop: '20px', fontSize: '0.9rem' }}>
              <h4>Verbindungsregeln:</h4>
              <p>🔴 Rot (oben): Eltern hinzufügen</p>
              <p>🟠 Orange (unten): Kinder hinzufügen</p>
              <p>🔵 Blau (links/rechts): Partner hinzufügen</p>
              <br />             
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
