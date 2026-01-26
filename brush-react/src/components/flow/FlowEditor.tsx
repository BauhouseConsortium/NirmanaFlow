import { useCallback, useEffect, useMemo, useRef, useState, ChangeEvent } from 'react';
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
import { PathNode } from './PathNode';
import { CodeNode } from './CodeNode';
import { CustomEdge } from './CustomEdge';
import { NodePalette } from './NodePalette';
import { GlyphEditor } from './GlyphEditor';
import { CodeEditorModal } from './CodeEditorModal';
import { nodeDefaults } from './nodeTypes';
import { executeFlow, FlowExecutionCache, type ExecutionResult } from './flowExecutor';
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
  path: PathNode,
  code: CodeNode,
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
  const [glyphEditorOpen, setGlyphEditorOpen] = useState(false);
  const [glyphEditorText, setGlyphEditorText] = useState('');
  const [codeEditorOpen, setCodeEditorOpen] = useState(false);
  const [codeEditorNodeId, setCodeEditorNodeId] = useState('');
  const [codeEditorCode, setCodeEditorCode] = useState('');
  const nodeIdCounter = useRef(1);
  const groupIdCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [flowName, setFlowName] = useState('untitled');

  // Persistent execution cache - survives across renders
  const executionCacheRef = useRef<FlowExecutionCache>(new FlowExecutionCache());

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
      } else if (type === 'path') {
        nodeType = 'path';
      } else if (type === 'code') {
        nodeType = 'code';
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

  // Execute flow when nodes or edges change (with persistent cache)
  useEffect(() => {
    const result = executeFlow(nodes, edges, executionCacheRef.current);
    onChange?.(result.paths, result);

    // Log cache stats in development
    if (import.meta.env.DEV && result.cacheStats) {
      const { hits, misses, hitRate, size } = result.cacheStats;
      if (hits + misses > 0) {
        console.debug(
          `[FlowCache] hits: ${hits}, misses: ${misses}, rate: ${(hitRate * 100).toFixed(1)}%, size: ${size}`
        );
      }
    }
  }, [nodes, edges, onChange]);

  // Listen for glyph editor open event
  useEffect(() => {
    const handleOpenGlyphEditor = (event: Event) => {
      const { latinText } = (event as CustomEvent).detail;
      setGlyphEditorText(latinText);
      setGlyphEditorOpen(true);
    };

    window.addEventListener('openGlyphEditor', handleOpenGlyphEditor);
    return () => window.removeEventListener('openGlyphEditor', handleOpenGlyphEditor);
  }, []);

  // Listen for code editor open event
  useEffect(() => {
    const handleOpenCodeEditor = (event: Event) => {
      const { nodeId, code } = (event as CustomEvent).detail;
      setCodeEditorNodeId(nodeId);
      setCodeEditorCode(code);
      setCodeEditorOpen(true);
    };

    window.addEventListener('openCodeEditor', handleOpenCodeEditor);
    return () => window.removeEventListener('openCodeEditor', handleOpenCodeEditor);
  }, []);

  // Save flow to JSON file
  const handleSaveFlow = useCallback(() => {
    const flowData = {
      version: 1,
      name: flowName,
      nodes: nodes,
      edges: edges,
      counters: {
        nodeId: nodeIdCounter.current,
        groupId: groupIdCounter.current,
      },
      savedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(flowData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${flowName}.nirmana.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [nodes, edges, flowName]);

  // Load flow from JSON file
  const handleLoadFlow = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const flowData = JSON.parse(content);

        // Validate the flow data
        if (!flowData.nodes || !flowData.edges) {
          alert('Invalid flow file: missing nodes or edges');
          return;
        }

        // Clear the execution cache when loading a new flow
        executionCacheRef.current.clear();

        // Load the flow
        setNodes(flowData.nodes);
        setEdges(flowData.edges);

        // Restore counters if available
        if (flowData.counters) {
          nodeIdCounter.current = flowData.counters.nodeId || 1;
          groupIdCounter.current = flowData.counters.groupId || 0;
        }

        // Set the flow name
        if (flowData.name) {
          setFlowName(flowData.name);
        } else {
          // Extract name from filename
          const name = file.name.replace('.nirmana.json', '').replace('.json', '');
          setFlowName(name);
        }
      } catch (err) {
        alert('Failed to load flow file: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);

    // Reset the input so the same file can be loaded again
    event.target.value = '';
  }, [setNodes, setEdges]);

  // Clear flow (reset to initial state)
  const handleClearFlow = useCallback(() => {
    if (confirm('Clear all nodes? This cannot be undone.')) {
      executionCacheRef.current.clear();
      setNodes(initialNodes);
      setEdges(initialEdges);
      nodeIdCounter.current = 1;
      groupIdCounter.current = 0;
      setFlowName('untitled');
    }
  }, [setNodes, setEdges]);

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

      {/* Bottom Toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/95 backdrop-blur-sm rounded-lg shadow-lg border border-slate-700">
          {/* Flow name input */}
          <input
            type="text"
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            className="w-32 px-2 py-1 text-sm bg-slate-700 text-white rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
            placeholder="Flow name"
          />

          <div className="w-px h-6 bg-slate-600" />

          {/* Load button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="Load flow (JSON)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Load
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.nirmana.json"
            onChange={handleLoadFlow}
            className="hidden"
          />

          {/* Save button */}
          <button
            onClick={handleSaveFlow}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="Save flow (JSON)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Save
          </button>

          <div className="w-px h-6 bg-slate-600" />

          {/* Clear button */}
          <button
            onClick={handleClearFlow}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
            title="Clear all nodes"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear
          </button>

          <div className="w-px h-6 bg-slate-600" />

          {/* Node count */}
          <span className="text-xs text-slate-500 px-2">
            {nodes.length} nodes · {edges.length} edges
          </span>
        </div>
      </div>

      {/* Global Glyph Editor Modal */}
      <GlyphEditor
        isOpen={glyphEditorOpen}
        onClose={() => setGlyphEditorOpen(false)}
        latinText={glyphEditorText}
      />

      {/* Global Code Editor Modal */}
      <CodeEditorModal
        isOpen={codeEditorOpen}
        onClose={() => setCodeEditorOpen(false)}
        nodeId={codeEditorNodeId}
        initialCode={codeEditorCode}
      />
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
