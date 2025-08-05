import React, { useCallback, useRef, useState } from 'react';
import {
  Background,
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import PersonNode from './PersonNode';
import NodeEditor from './NodeEditor';

import '@xyflow/react/dist/style.css';

const nodeTypes = {
  person: PersonNode,
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
      gender: 'female'
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
 
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialNodes.map(node => ({
      ...node,
      data: { ...node.data, isSelected: false }
    }))
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition } = useReactFlow();
  
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [],
  );

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
    // Update all nodes to mark which one is selected
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isSelected: n.id === node.id }
      }))
    );
  }, [setNodes]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    // Mark all nodes as not selected
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
      if (!connectionState.isValid) {
        const newId = getId();
        const { clientX, clientY } =
          'changedTouches' in event ? event.changedTouches[0] : event;
        const newNode = {
          id: newId,
          type: 'person',
          position: screenToFlowPosition({
            x: clientX,
            y: clientY,
          }),
          data: { 
            name: `Noa`,
            surname: `Erler`,
            birthDate: null,
            deathDate: null,
            street: '',
            city: '',
            zip: '',
            country: '',
            gender: 'male',
            isSelected: false
          },
          origin: [0.5, 0.0],
        };

        setNodes((nds) => nds.concat(newNode));
        setEdges((eds) =>
          eds.concat({ id: newId, source: connectionState.fromNode.id, target: newId }),
        );
      }
    },
    [screenToFlowPosition],
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
          <div>
            <h3>Select a node to edit</h3>
            <p>Click on any person node to edit their information.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default () => (
  <ReactFlowProvider>
    <AddNodeOnEdgeDrop />
  </ReactFlowProvider>
);
