import { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';

interface AlgorithmicNodeData {
  label: string;
  formula: string;
  count: number;
  // What the formula output controls
  mode: 'position' | 'rotation' | 'scale' | 'all';
  // Scaling factors for the output
  xScale: number;
  yScale: number;
  rotScale: number;
  sclScale: number;
  // Base offset
  baseX: number;
  baseY: number;
}

type AlgorithmicNodeProps = {
  id: string;
  data: AlgorithmicNodeData;
  selected?: boolean;
};

const PRESET_FORMULAS = [
  { name: 'Classic', formula: 't*(t>>5|t>>8)' },
  { name: 'Cascade', formula: 't*(t>>11&t>>8&123&t>>3)' },
  { name: 'Spiral', formula: '(t*5&t>>7)|(t*3&t>>10)' },
  { name: 'Waves', formula: 't*(t>>8*(t>>15|t>>8)&(20|(t>>19)*5>>t|t>>3))' },
  { name: 'Simple', formula: 't&t>>8' },
  { name: 'Mod8', formula: 't%8*t' },
  { name: 'XOR', formula: 't^(t>>4)' },
  { name: 'Stairs', formula: 't/(t%(t>>8|1)+1)' },
];

function AlgorithmicNodeComponent({ id, data, selected }: AlgorithmicNodeProps) {
  const handleChange = useCallback(
    (field: string, value: string | number) => {
      const event = new CustomEvent('nodeDataChange', {
        detail: { nodeId: id, field, value },
      });
      window.dispatchEvent(event);
    },
    [id]
  );

  const handlePresetSelect = useCallback(
    (formula: string) => {
      handleChange('formula', formula);
    },
    [handleChange]
  );

  return (
    <div
      className={`min-w-[200px] rounded-lg border-2 transition-colors ${
        selected ? 'border-pink-400' : 'border-pink-500/50'
      }`}
      style={{ backgroundColor: '#1e293b' }}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-pink-500 !border-slate-700 !w-3 !h-3"
      />

      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-2">
        <span className="text-pink-400">λ</span>
        <span className="font-medium text-pink-300 text-sm">{data.label || 'Algorithmic'}</span>
      </div>

      {/* Formula input */}
      <div className="px-3 py-2 space-y-2">
        <div>
          <label className="text-slate-400 text-xs block mb-1">Formula (t = step)</label>
          <input
            type="text"
            value={data.formula || 't*(t>>5|t>>8)'}
            onChange={(e) => handleChange('formula', e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-pink-300 font-mono"
            placeholder="t*(t>>5|t>>8)"
          />
        </div>

        {/* Presets */}
        <div>
          <label className="text-slate-400 text-xs block mb-1">Presets</label>
          <div className="flex flex-wrap gap-1">
            {PRESET_FORMULAS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handlePresetSelect(preset.formula)}
                className="px-1.5 py-0.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                title={preset.formula}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        <div className="flex items-center gap-2">
          <label className="text-slate-400 text-xs w-12">Count</label>
          <input
            type="number"
            min="1"
            max="256"
            value={data.count ?? 16}
            onChange={(e) => handleChange('count', parseInt(e.target.value) || 16)}
            className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200"
          />
        </div>

        {/* Mode */}
        <div className="flex items-center gap-2">
          <label className="text-slate-400 text-xs w-12">Mode</label>
          <select
            value={data.mode || 'position'}
            onChange={(e) => handleChange('mode', e.target.value)}
            className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200"
          >
            <option value="position">Position (X,Y)</option>
            <option value="rotation">Rotation</option>
            <option value="scale">Scale</option>
            <option value="all">All (X,Y,Rot,Scl)</option>
          </select>
        </div>

        {/* Scale factors */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1">
            <label className="text-slate-400 text-xs w-8">xScl</label>
            <input
              type="number"
              step="0.1"
              value={data.xScale ?? 0.5}
              onChange={(e) => handleChange('xScale', parseFloat(e.target.value) || 0.5)}
              className="w-14 bg-slate-700 border border-slate-600 rounded px-1 py-1 text-sm text-slate-200"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-slate-400 text-xs w-8">yScl</label>
            <input
              type="number"
              step="0.1"
              value={data.yScale ?? 0.5}
              onChange={(e) => handleChange('yScale', parseFloat(e.target.value) || 0.5)}
              className="w-14 bg-slate-700 border border-slate-600 rounded px-1 py-1 text-sm text-slate-200"
            />
          </div>
        </div>

        {/* Base position */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1">
            <label className="text-slate-400 text-xs w-8">baseX</label>
            <input
              type="number"
              value={data.baseX ?? 75}
              onChange={(e) => handleChange('baseX', parseFloat(e.target.value) || 0)}
              className="w-14 bg-slate-700 border border-slate-600 rounded px-1 py-1 text-sm text-slate-200"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-slate-400 text-xs w-8">baseY</label>
            <input
              type="number"
              value={data.baseY ?? 60}
              onChange={(e) => handleChange('baseY', parseFloat(e.target.value) || 0)}
              className="w-14 bg-slate-700 border border-slate-600 rounded px-1 py-1 text-sm text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-pink-500 !border-slate-700 !w-3 !h-3"
      />
    </div>
  );
}

export const AlgorithmicNode = memo(AlgorithmicNodeComponent);
