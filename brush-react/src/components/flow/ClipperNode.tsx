import { memo, useCallback, useState } from 'react';
import { Handle, Position } from '@xyflow/react';

type ClipOperation = 'union' | 'intersection' | 'difference' | 'xor' | 'offset' | 'simplify' | 'delaunay' | 'delaunay-edges';

interface ClipperNodeData extends Record<string, unknown> {
  label: string;
  operation: ClipOperation;
  // Offset settings
  offsetDistance: number;
  joinType: 'round' | 'square' | 'miter';
  // Simplify settings
  simplifyTolerance: number;
  // Delaunay settings
  sampleDistance: number; // 0 = use vertices only, >0 = sample at this distance
  // Boolean operation uses both inputs (A and B)
  // Other operations only use input A
}

type ClipperNodeProps = {
  id: string;
  data: ClipperNodeData;
};

function ClipperNodeComponent({ data, id }: ClipperNodeProps) {
  const [expanded, setExpanded] = useState(false);

  const handleChange = useCallback((field: string, value: unknown) => {
    const event = new CustomEvent('nodeDataChange', {
      detail: { nodeId: id, field, value },
    });
    window.dispatchEvent(event);
  }, [id]);

  const operation = data.operation || 'union';
  const needsTwoInputs = ['union', 'intersection', 'difference', 'xor'].includes(operation);

  const operationLabels: Record<ClipOperation, string> = {
    union: '∪ Union',
    intersection: '∩ Intersect',
    difference: '− Difference',
    xor: '⊕ XOR',
    offset: '↔ Offset',
    simplify: '⌇ Simplify',
    delaunay: '△ Delaunay',
    'delaunay-edges': '⊿ Delaunay Edges',
  };

  const operationDescriptions: Record<ClipOperation, string> = {
    union: 'Merge overlapping paths',
    intersection: 'Keep only overlapping areas',
    difference: 'Subtract B from A',
    xor: 'Keep non-overlapping areas',
    offset: 'Inset or outset paths',
    simplify: 'Remove redundant points',
    delaunay: 'Triangulate points (filled)',
    'delaunay-edges': 'Triangulate points (edges only)',
  };

  return (
    <div className="rounded-lg border-2 border-emerald-500 bg-emerald-500/10 bg-slate-800 shadow-lg min-w-[200px]">
      {/* Input handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="a"
        className="!bg-slate-400 !border-slate-600 !w-3 !h-3"
        style={{ left: needsTwoInputs ? '30%' : '50%' }}
      />
      {needsTwoInputs && (
        <Handle
          type="target"
          position={Position.Top}
          id="b"
          className="!bg-orange-400 !border-orange-600 !w-3 !h-3"
          style={{ left: '70%' }}
        />
      )}

      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg text-emerald-400">✂</span>
          <span className="font-medium text-white text-sm">{data.label || 'Clipper'}</span>
        </div>
        {needsTwoInputs && (
          <div className="flex gap-1 text-[10px]">
            <span className="text-slate-400">A</span>
            <span className="text-orange-400">B</span>
          </div>
        )}
      </div>

      <div className="p-2 space-y-2">
        {/* Operation selector */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">Operation</label>
          <div className="grid grid-cols-2 gap-1">
            {(Object.keys(operationLabels) as ClipOperation[]).map((op) => (
              <button
                key={op}
                onClick={(e) => { e.stopPropagation(); handleChange('operation', op); }}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  operation === op
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                title={operationDescriptions[op]}
              >
                {operationLabels[op]}
              </button>
            ))}
          </div>
        </div>

        {/* Operation-specific settings */}
        {operation === 'offset' && (
          <div className="space-y-2 pt-2 border-t border-slate-700">
            <div>
              <label className="text-[10px] text-slate-500 block">Distance (+ outset, - inset)</label>
              <input
                type="number"
                value={data.offsetDistance ?? 1}
                onChange={(e) => handleChange('offsetDistance', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none nodrag"
                step="0.5"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block">Join Type</label>
              <div className="flex gap-1">
                {(['round', 'square', 'miter'] as const).map((jt) => (
                  <button
                    key={jt}
                    onClick={(e) => { e.stopPropagation(); handleChange('joinType', jt); }}
                    className={`flex-1 px-2 py-1 text-[10px] rounded capitalize ${
                      (data.joinType || 'round') === jt
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {jt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {operation === 'simplify' && (
          <div className="pt-2 border-t border-slate-700">
            <label className="text-[10px] text-slate-500 block">Tolerance</label>
            <input
              type="number"
              value={data.simplifyTolerance ?? 0.1}
              onChange={(e) => handleChange('simplifyTolerance', parseFloat(e.target.value) || 0.01)}
              className="w-full bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none nodrag"
              step="0.1"
              min="0.01"
            />
          </div>
        )}

        {(operation === 'delaunay' || operation === 'delaunay-edges') && (
          <div className="pt-2 border-t border-slate-700">
            <label className="text-[10px] text-slate-500 block">Sample Distance</label>
            <input
              type="number"
              value={data.sampleDistance ?? 0}
              onChange={(e) => handleChange('sampleDistance', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none nodrag"
              step="1"
              min="0"
            />
            <p className="text-[9px] text-slate-500 mt-1">
              0 = vertices only, &gt;0 = sample along paths
            </p>
          </div>
        )}

        {/* Info text */}
        <div className="text-[10px] text-slate-500 pt-1">
          {operationDescriptions[operation]}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-emerald-500 !border-emerald-600 !w-3 !h-3"
      />
    </div>
  );
}

export const ClipperNode = memo(ClipperNodeComponent);
