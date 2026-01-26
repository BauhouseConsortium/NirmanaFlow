import { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';

interface AttractorNodeData {
  label: string;
  type: 'clifford' | 'dejong' | 'bedhead' | 'tinkerbell' | 'gumowski';
  iterations: number;
  a: number;
  b: number;
  c: number;
  d: number;
  scale: number;
  centerX: number;
  centerY: number;
}

type AttractorNodeProps = {
  id: string;
  data: AttractorNodeData;
  selected?: boolean;
};

const ATTRACTOR_PRESETS = {
  clifford: [
    { name: 'Classic', a: -1.4, b: 1.6, c: 1.0, d: 0.7 },
    { name: 'Spiral', a: 1.7, b: 1.7, c: 0.6, d: 1.2 },
    { name: 'Leaf', a: -1.7, b: 1.3, c: -0.1, d: -1.2 },
    { name: 'Wings', a: 1.5, b: -1.8, c: 1.6, d: 0.9 },
  ],
  dejong: [
    { name: 'Classic', a: -2.0, b: -2.0, c: -1.2, d: 2.0 },
    { name: 'Swirl', a: 1.4, b: -2.3, c: 2.4, d: -2.1 },
    { name: 'Heart', a: -2.7, b: -0.09, c: -0.86, d: -2.2 },
  ],
  bedhead: [
    { name: 'Classic', a: -0.81, b: -0.92, c: 0, d: 0 },
    { name: 'Swirl', a: 0.06, b: 0.98, c: 0, d: 0 },
  ],
  tinkerbell: [
    { name: 'Classic', a: 0.9, b: -0.6, c: 2.0, d: 0.5 },
    { name: 'Tight', a: 0.3, b: 0.6, c: 2.0, d: 0.27 },
  ],
  gumowski: [
    { name: 'Classic', a: -0.2, b: 0.01, c: 0, d: 0 },
    { name: 'Complex', a: 0.008, b: 0.05, c: 0, d: 0 },
  ],
};

function AttractorNodeComponent({ id, data, selected }: AttractorNodeProps) {
  const attractorType = data.type || 'clifford';

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
    (preset: { a: number; b: number; c: number; d: number }) => {
      handleChange('a', preset.a);
      setTimeout(() => handleChange('b', preset.b), 0);
      setTimeout(() => handleChange('c', preset.c), 0);
      setTimeout(() => handleChange('d', preset.d), 0);
    },
    [handleChange]
  );

  const presets = ATTRACTOR_PRESETS[attractorType] || ATTRACTOR_PRESETS.clifford;

  return (
    <div
      className={`min-w-[180px] rounded-lg border-2 transition-colors ${
        selected ? 'border-purple-400' : 'border-purple-500/50'
      }`}
      style={{ backgroundColor: '#1e293b' }}
    >
      {/* No input handle - generates its own paths */}

      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-2">
        <span className="text-purple-400">∞</span>
        <span className="font-medium text-purple-300 text-sm">{data.label || 'Attractor'}</span>
      </div>

      {/* Fields */}
      <div className="px-3 py-2 space-y-2">
        {/* Type selector */}
        <div className="flex items-center gap-2">
          <label className="text-slate-400 text-xs w-10">Type</label>
          <select
            value={attractorType}
            onChange={(e) => handleChange('type', e.target.value)}
            className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200"
          >
            <option value="clifford">Clifford</option>
            <option value="dejong">De Jong</option>
            <option value="bedhead">Bedhead</option>
            <option value="tinkerbell">Tinkerbell</option>
            <option value="gumowski">Gumowski-Mira</option>
          </select>
        </div>

        {/* Presets */}
        <div>
          <label className="text-slate-400 text-xs block mb-1">Presets</label>
          <div className="flex flex-wrap gap-1">
            {presets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handlePresetSelect(preset)}
                className="px-1.5 py-0.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Iterations */}
        <div className="flex items-center gap-2">
          <label className="text-slate-400 text-xs w-10">Iter</label>
          <input
            type="number"
            min="100"
            max="50000"
            step="100"
            value={data.iterations ?? 5000}
            onChange={(e) => handleChange('iterations', parseInt(e.target.value) || 5000)}
            className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200"
          />
        </div>

        {/* Parameters a, b, c, d */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1">
            <label className="text-slate-400 text-xs w-4">a</label>
            <input
              type="number"
              step="0.1"
              value={data.a ?? -1.4}
              onChange={(e) => handleChange('a', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-1 text-sm text-slate-200"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-slate-400 text-xs w-4">b</label>
            <input
              type="number"
              step="0.1"
              value={data.b ?? 1.6}
              onChange={(e) => handleChange('b', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-1 text-sm text-slate-200"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-slate-400 text-xs w-4">c</label>
            <input
              type="number"
              step="0.1"
              value={data.c ?? 1.0}
              onChange={(e) => handleChange('c', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-1 text-sm text-slate-200"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-slate-400 text-xs w-4">d</label>
            <input
              type="number"
              step="0.1"
              value={data.d ?? 0.7}
              onChange={(e) => handleChange('d', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-1 text-sm text-slate-200"
            />
          </div>
        </div>

        {/* Scale and Center */}
        <div className="grid grid-cols-3 gap-1">
          <div className="flex items-center gap-1">
            <label className="text-slate-400 text-xs w-6">scl</label>
            <input
              type="number"
              step="1"
              value={data.scale ?? 20}
              onChange={(e) => handleChange('scale', parseFloat(e.target.value) || 20)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-1 text-sm text-slate-200"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-slate-400 text-xs w-4">cx</label>
            <input
              type="number"
              value={data.centerX ?? 75}
              onChange={(e) => handleChange('centerX', parseFloat(e.target.value) || 75)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-1 text-sm text-slate-200"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-slate-400 text-xs w-4">cy</label>
            <input
              type="number"
              value={data.centerY ?? 60}
              onChange={(e) => handleChange('centerY', parseFloat(e.target.value) || 60)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-1 text-sm text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-purple-500 !border-slate-700 !w-3 !h-3"
      />
    </div>
  );
}

export const AttractorNode = memo(AttractorNodeComponent);
