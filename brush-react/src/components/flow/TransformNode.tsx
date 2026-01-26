import { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';

interface TransformNodeData {
  label: string;
  // Translate
  dx?: number;
  dy?: number;
  // Rotate
  angle?: number;
  cx?: number;
  cy?: number;
  // Scale
  sx?: number;
  sy?: number;
}

type TransformNodeProps = {
  id: string;
  data: TransformNodeData;
  selected?: boolean;
};

function TransformNodeComponent({ id, data, selected }: TransformNodeProps) {
  const label = (data.label || '').toLowerCase();

  const handleChange = useCallback(
    (field: string, value: number) => {
      const event = new CustomEvent('nodeDataChange', {
        detail: { nodeId: id, field, value },
      });
      window.dispatchEvent(event);
    },
    [id]
  );

  const renderFields = () => {
    switch (label) {
      case 'translate':
        return (
          <>
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-xs w-6">dx</label>
              <input
                type="number"
                value={data.dx ?? 0}
                onChange={(e) => handleChange('dx', parseFloat(e.target.value) || 0)}
                className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-xs w-6">dy</label>
              <input
                type="number"
                value={data.dy ?? 0}
                onChange={(e) => handleChange('dy', parseFloat(e.target.value) || 0)}
                className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200"
              />
            </div>
          </>
        );

      case 'rotate':
        return (
          <>
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-xs w-6">deg</label>
              <input
                type="number"
                value={data.angle ?? 0}
                onChange={(e) => handleChange('angle', parseFloat(e.target.value) || 0)}
                className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-xs w-6">cx</label>
              <input
                type="number"
                value={data.cx ?? 0}
                onChange={(e) => handleChange('cx', parseFloat(e.target.value) || 0)}
                className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-xs w-6">cy</label>
              <input
                type="number"
                value={data.cy ?? 0}
                onChange={(e) => handleChange('cy', parseFloat(e.target.value) || 0)}
                className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200"
              />
            </div>
          </>
        );

      case 'scale':
        return (
          <>
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-xs w-6">sx</label>
              <input
                type="number"
                step="0.1"
                value={data.sx ?? 1}
                onChange={(e) => handleChange('sx', parseFloat(e.target.value) || 1)}
                className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-xs w-6">sy</label>
              <input
                type="number"
                step="0.1"
                value={data.sy ?? 1}
                onChange={(e) => handleChange('sy', parseFloat(e.target.value) || 1)}
                className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-xs w-6">cx</label>
              <input
                type="number"
                value={data.cx ?? 0}
                onChange={(e) => handleChange('cx', parseFloat(e.target.value) || 0)}
                className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-xs w-6">cy</label>
              <input
                type="number"
                value={data.cy ?? 0}
                onChange={(e) => handleChange('cy', parseFloat(e.target.value) || 0)}
                className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200"
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const getIcon = () => {
    switch (label) {
      case 'translate':
        return '↗';
      case 'rotate':
        return '↻';
      case 'scale':
        return '⤢';
      default:
        return '◇';
    }
  };

  return (
    <div
      className={`min-w-[140px] rounded-lg border-2 transition-colors ${
        selected ? 'border-amber-400' : 'border-amber-500/50'
      }`}
      style={{ backgroundColor: '#1e293b' }}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-amber-500 !border-slate-700 !w-3 !h-3"
      />

      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-2">
        <span className="text-amber-400">{getIcon()}</span>
        <span className="font-medium text-amber-300 text-sm">{data.label}</span>
      </div>

      {/* Fields */}
      <div className="px-3 py-2 space-y-2">{renderFields()}</div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-amber-500 !border-slate-700 !w-3 !h-3"
      />
    </div>
  );
}

export const TransformNode = memo(TransformNodeComponent);
