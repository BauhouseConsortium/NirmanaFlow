import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ShapeNode } from './ShapeNode';
import { IterationNode } from './IterationNode';
import { OutputNode } from './OutputNode';
import { TextNode } from './TextNode';
import { CustomEdge } from './CustomEdge';
import { NodePalette } from './NodePalette';
import { nodeDefaults } from './nodeTypes';
import { executeFlow, type ExecutionResult } from './flowExecutor';
import type { Path } from '../../utils/drawingApi';

// Define custom node types
const nodeTypes = {
  shape: ShapeNode,
  iteration: IterationNode,
  output: OutputNode,
  text: TextNode,
};

// Define custom edge types
const edgeTypes = {
  custom: CustomEdge,
};

// Initial nodes with an output node
const initialNodes: Node[] = [
  {
    id: 'output-1',
    type: 'output',
    position: { x: 300, y: 400 },
    data: { label: 'Output' },
  },
];

const initialEdges: Edge[] = [];

interface FlowEditorProps {
  onChange?: (paths: Path[], result: ExecutionResult) => void;
}

export function FlowEditor({ onChange }: FlowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const nodeIdCounter = useRef(1);

  // Handle edge connections
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  // Add new node
  const handleAddNode = useCallback(
    (type: string) => {
      const id = `${type}-${++nodeIdCounter.current}`;
      const defaults = nodeDefaults[type] || { label: type };

      // Determine node category for React Flow type
      let nodeType = 'shape';
      if (['repeat', 'grid', 'radial'].includes(type)) {
        nodeType = 'iteration';
      } else if (type === 'output') {
        nodeType = 'output';
      } else if (type === 'text') {
        nodeType = 'text';
      }

      const newNode: Node = {
        id,
        type: nodeType,
        position: { x: 100 + Math.random() * 200, y: 50 + Math.random() * 100 },
        data: { ...defaults },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  // Handle node data changes from custom events
  useEffect(() => {
    const handleDataChange = (event: Event) => {
      const { nodeId, field, value } = (event as CustomEvent).detail;
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                [field]: value,
              },
            };
          }
          return node;
        })
      );
    };

    window.addEventListener('nodeDataChange', handleDataChange);
    return () => window.removeEventListener('nodeDataChange', handleDataChange);
  }, [setNodes]);

  // Execute flow when nodes or edges change
  useEffect(() => {
    const result = executeFlow(nodes, edges);
    onChange?.(result.paths, result);
  }, [nodes, edges, onChange]);

  // Memoize the dark theme styles
  const flowStyles = useMemo(
    () => ({
      backgroundColor: '#1e293b',
    }),
    []
  );

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        style={flowStyles}
        deleteKeyCode={['Backspace', 'Delete']}
        defaultEdgeOptions={{
          style: { stroke: '#64748b', strokeWidth: 2 },
          type: 'custom',
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
        <Controls className="!bg-slate-800 !border-slate-700 !shadow-lg [&>button]:!bg-slate-700 [&>button]:!border-slate-600 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-600" />
      </ReactFlow>

      {/* Node Palette */}
      <div className="absolute top-4 left-4 z-10">
        <NodePalette onAddNode={handleAddNode} />
      </div>
    </div>
  );
}
