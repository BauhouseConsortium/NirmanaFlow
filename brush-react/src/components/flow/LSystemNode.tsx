import { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';

interface LSystemNodeData {
  label: string;
  axiom: string;
  rules: string; // Format: "F=FF+[+F-F-F]-[-F+F+F]"
  iterations: number;
  angle: number;
  stepSize: number;
  startX: number;
  startY: number;
  startAngle: number;
  scalePerIter: number;
}

type LSystemNodeProps = {
  id: string;
  data: LSystemNodeData;
  selected?: boolean;
};

const LSYSTEM_PRESETS = [
  { name: 'Koch', axiom: 'F', rules: 'F=F+F-F-F+F', angle: 90, iterations: 3 },
  { name: 'Sierpinski', axiom: 'F-G-G', rules: 'F=F-G+F+G-F,G=GG', angle: 120, iterations: 4 },
  { name: 'Dragon', axiom: 'FX', rules: 'X=X+YF+,Y=-FX-Y', angle: 90, iterations: 8 },
  { name: 'Plant', axiom: 'X', rules: 'X=F+[[X]-X]-F[-FX]+X,F=FF', angle: 25, iterations: 4 },
  { name: 'Binary Tree', axiom: '0', rules: '1=11,0=1[0]0', angle: 45, iterations: 5 },
  { name: 'Hilbert', axiom: 'A', rules: 'A=-BF+AFA+FB-,B=+AF-BFB-FA+', angle: 90, iterations: 4 },
  { name: 'Penrose', axiom: '[7]++[7]++[7]++[7]++[7]', rules: '6=81++91----71[-81----61]++,7=+81--91[---61--71]+,8=-61++71[+++81++91]-,9=--81++++61[+91++++71]--71,1=', angle: 36, iterations: 3 },
];

function LSystemNodeComponent({ id, data, selected }: LSystemNodeProps) {
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
    (preset: typeof LSYSTEM_PRESETS[0]) => {
      handleChange('axiom', preset.axiom);
      setTimeout(() => handleChange('rules', preset.rules), 0);
      setTimeout(() => handleChange('angle', preset.angle), 0);
      setTimeout(() => handleChange('iterations', preset.iterations), 0);
    },
    [handleChange]
  );

  return (
    <div
      className={`min-w-[200px] rounded-lg border-2 transition-colors ${
        selected ? 'border-teal-400' : 'border-teal-500/50'
      }`}
      style={{ backgroundColor: '#1e293b' }}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-teal-500 !border-slate-700 !w-3 !h-3"
      />

      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-2">
        <span className="text-teal-400">🌿</span>
        <span className="font-medium text-teal-300 text-sm">{data.label || 'L-System'}</span>
      </div>

      {/* Fields */}
      <div className="px-3 py-2 space-y-2">
        {/* Presets */}
        <div>
          <label className="text-slate-400 text-xs block mb-1">Presets</label>
          <div className="flex flex-wrap gap-1">
            {LSYSTEM_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handlePresetSelect(preset)}
                className="px-1.5 py-0.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                title={`${preset.axiom} → ${preset.rules}`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Axiom */}
        <div>
          <label className="text-slate-400 text-xs block mb-1">Axiom</label>
          <input
            type="text"
            value={data.axiom || 'F'}
            onChange={(e) => handleChange('axiom', e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-teal-300 font-mono"
            placeholder="F"
          />
        </div>

        {/* Rules */}
        <div>
          <label className="text-slate-400 text-xs block mb-1">Rules (comma separated)</label>
          <input
            type="text"
            value={data.rules || 'F=F+F-F-F+F'}
            onChange={(e) => handleChange('rules', e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-teal-300 font-mono text-xs"
            placeholder="F=F+F-F-F+F"
          />
        </div>

        {/* Iterations and Angle */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1">
            <label className="text-slate-400 text-xs w-8">iter</label>
            <input
              type="number"
              min="1"
              max="8"
              value={data.iterations ?? 3}
              onChange={(e) => handleChange('iterations', parseInt(e.target.value) || 3)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-1 text-sm text-slate-200"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-slate-400 text-xs w-8">angle</label>
            <input
              type="number"
              value={data.angle ?? 90}
              onChange={(e) => handleChange('angle', parseFloat(e.target.value) || 90)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-1 text-sm text-slate-200"
            />
          </div>
        </div>

        {/* Step size and scale */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1">
            <label className="text-slate-400 text-xs w-8">step</label>
            <input
              type="number"
              step="1"
              value={data.stepSize ?? 10}
              onChange={(e) => handleChange('stepSize', parseFloat(e.target.value) || 10)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-1 text-sm text-slate-200"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-slate-400 text-xs w-8">scale</label>
            <input
              type="number"
              step="0.1"
              value={data.scalePerIter ?? 1}
              onChange={(e) => handleChange('scalePerIter', parseFloat(e.target.value) || 1)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-1 text-sm text-slate-200"
            />
          </div>
        </div>

        {/* Start position */}
        <div className="grid grid-cols-3 gap-1">
          <div className="flex items-center gap-1">
            <label className="text-slate-400 text-xs w-4">x</label>
            <input
              type="number"
              value={data.startX ?? 75}
              onChange={(e) => handleChange('startX', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-1 text-sm text-slate-200"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-slate-400 text-xs w-4">y</label>
            <input
              type="number"
              value={data.startY ?? 100}
              onChange={(e) => handleChange('startY', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-1 text-sm text-slate-200"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-slate-400 text-xs w-4">dir</label>
            <input
              type="number"
              value={data.startAngle ?? -90}
              onChange={(e) => handleChange('startAngle', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-1 text-sm text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-teal-500 !border-slate-700 !w-3 !h-3"
      />
    </div>
  );
}

export const LSystemNode = memo(LSystemNodeComponent);
