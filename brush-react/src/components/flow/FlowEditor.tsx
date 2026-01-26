import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  SelectionMode,
  ReactFlowProvider,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ShapeNode } from './ShapeNode';
import { IterationNode } from './IterationNode';
import { OutputNode } from './OutputNode';
import { TextNode } from './TextNode';
import { BatakTextNode } from './BatakTextNode';
import { GroupNode } from './GroupNode';
import { TransformNode } from './TransformNode';
import { AlgorithmicNode } from './AlgorithmicNode';
import { AttractorNode } from './AttractorNode';
import { LSystemNode } from './LSystemNode';
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
  batak: BatakTextNode,
  group: GroupNode,
  transform: TransformNode,
  algorithmic: AlgorithmicNode,
  attractor: AttractorNode,
  lsystem: LSystemNode,
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

function FlowEditorInner({ onChange }: FlowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const nodeIdCounter = useRef(1);
  const groupIdCounter = useRef(0);

  // Handle edge connections
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  // Track selection changes
  const onSelectionChange = useCallback(({ nodes: selectedNodesList }: { nodes: Node[] }) => {
    setSelectedNodes(selectedNodesList.map((n) => n.id));
  }, []);

  // Create group from selected nodes
  const handleCreateGroup = useCallback(() => {
    if (selectedNodes.length < 2) return;

    const selectedNodeObjects = nodes.filter((n) => selectedNodes.includes(n.id) && n.type !== 'output');
    if (selectedNodeObjects.length < 2) return;

    // Calculate bounding box of selected nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedNodeObjects.forEach((node) => {
      const width = 160; // Approximate node width
      const height = 100; // Approximate node height
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + width);
      maxY = Math.max(maxY, node.position.y + height);
    });

    // Add padding
    const padding = 40;
    minX -= padding;
    minY -= padding + 30; // Extra space for header
    maxX += padding;
    maxY += padding;

    // Create group node
    const groupId = `group-${++groupIdCounter.current}`;
    const groupNode: Node = {
      id: groupId,
      type: 'group',
      position: { x: minX, y: minY },
      style: { width: maxX - minX, height: maxY - minY },
      data: { label: `Group ${groupIdCounter.current}` },
    };

    // Update selected nodes to be children of the group
    setNodes((nds) => {
      const updatedNodes = nds.map((node) => {
        if (selectedNodes.includes(node.id) && node.type !== 'output') {
          return {
            ...node,
            position: {
              x: node.position.x - minX,
              y: node.position.y - minY,
            },
            parentId: groupId,
            extent: 'parent' as const,
          };
        }
        return node;
      });
      // Add group node at the beginning (so it renders behind children)
      return [groupNode, ...updatedNodes];
    });

    setSelectedNodes([]);
  }, [selectedNodes, nodes, setNodes]);

  // Ungroup nodes
  const handleUngroup = useCallback((groupId: string) => {
    const groupNode = nodes.find((n) => n.id === groupId);
    if (!groupNode) return;

    setNodes((nds) => {
      return nds
        .filter((n) => n.id !== groupId)
        .map((node) => {
          if (node.parentId === groupId) {
            return {
              ...node,
              position: {
                x: node.position.x + groupNode.position.x,
                y: node.position.y + groupNode.position.y,
              },
              parentId: undefined,
              extent: undefined,
            };
          }
          return node;
        });
    });
  }, [nodes, setNodes]);

  // Add new node
  const handleAddNode = useCallback(
    (type: string) => {
      const id = `${type}-${++nodeIdCounter.current}`;
      const defaults = nodeDefaults[type] || { label: type };

      // Determine node category for React Flow type
      let nodeType = 'shape';
      if (['repeat', 'grid', 'radial'].includes(type)) {
        nodeType = 'iteration';
      } else if (['translate', 'rotate', 'scale'].includes(type)) {
        nodeType = 'transform';
      } else if (type === 'algorithmic') {
        nodeType = 'algorithmic';
      } else if (type === 'attractor') {
        nodeType = 'attractor';
      } else if (type === 'lsystem') {
        nodeType = 'lsystem';
      } else if (type === 'output') {
        nodeType = 'output';
      } else if (type === 'text') {
        nodeType = 'text';
      } else if (type === 'batak') {
        nodeType = 'batak';
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

  // Handle group collapse/expand
  useEffect(() => {
    const handleGroupCollapse = (event: Event) => {
      const { nodeId, collapsed } = (event as CustomEvent).detail;

      setNodes((nds) =>
        nds.map((node) => {
          // Update group node's collapsed state
          if (node.id === nodeId) {
            return {
              ...node,
              data: { ...node.data, collapsed },
            };
          }
          // Hide/show children of the group
          if (node.parentId === nodeId) {
            return {
              ...node,
              hidden: collapsed,
            };
          }
          return node;
        })
      );
    };

    window.addEventListener('groupCollapse', handleGroupCollapse);
    return () => window.removeEventListener('groupCollapse', handleGroupCollapse);
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

  const canCreateGroup = selectedNodes.length >= 2;

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        style={flowStyles}
        deleteKeyCode={['Backspace', 'Delete']}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]} // Middle and right mouse button to pan
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

      {/* Group Actions Toolbar */}
      {canCreateGroup && (
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={handleCreateGroup}
            className="flex items-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg shadow-lg transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
            </svg>
            Create Group ({selectedNodes.length})
          </button>
        </div>
      )}
    </div>
  );
}

// Wrapper component with ReactFlowProvider
export function FlowEditor(props: FlowEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner {...props} />
    </ReactFlowProvider>
  );
}
