import { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';

// Path types for future expansion
export type PathType = 'circle' | 'arc' | 'line' | 'wave' | 'spiral';

interface PathNodeData extends Record<string, unknown> {
  label: string;
  pathType: PathType;
  // Circle/Arc params
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;  // degrees
  endAngle: number;    // degrees
  // Line params
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  // Wave params
  amplitude: number;
  frequency: number;
  // Spiral params
  turns: number;
  growth: number;
  // Layout options
  align: 'start' | 'center' | 'end';
  spacing: number;  // character spacing multiplier
  reverse: boolean; // reverse direction
}

type PathNodeProps = {
  id: string;
  data: PathNodeData;
};

const pathTypeOptions: { value: PathType; label: string }[] = [
  { value: 'circle', label: 'Circle' },
  { value: 'arc', label: 'Arc' },
  { value: 'line', label: 'Line' },
  { value: 'wave', label: 'Wave' },
  { value: 'spiral', label: 'Spiral' },
];

function PathNodeComponent({ id, data }: PathNodeProps) {
  const handleChange = useCallback(
    (field: string, value: string | number | boolean) => {
      const event = new CustomEvent('nodeDataChange', {
        detail: { nodeId: id, field, value },
      });
      window.dispatchEvent(event);
    },
    [id]
  );

  const pathType = data.pathType || 'circle';

  return (
    <div className="rounded-lg border-2 border-cyan-500 bg-cyan-500/10 bg-slate-800 shadow-lg min-w-[200px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-cyan-500 !border-slate-700 !w-3 !h-3"
      />

      <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-2">
        <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3 Q 20 12 12 21" />
        </svg>
        <span className="font-medium text-white text-sm">{data.label || 'Path Layout'}</span>
      </div>

      <div className="p-2 space-y-2">
        {/* Path Type */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">Path Type</label>
          <select
            value={pathType}
            onChange={(e) => handleChange('pathType', e.target.value)}
            className="w-full bg-slate-700 text-white text-xs px-2 py-1.5 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none"
          >
            {pathTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Circle/Arc params */}
        {(pathType === 'circle' || pathType === 'arc') && (
          <>
            <div className="grid grid-cols-2 gap-1">
              <div className="flex items-center gap-1">
                <label className="text-xs text-slate-400 w-6">cx</label>
                <input
                  type="number"
                  value={data.cx ?? 75}
                  onChange={(e) => handleChange('cx', parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none w-14"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-slate-400 w-6">cy</label>
                <input
                  type="number"
                  value={data.cy ?? 60}
                  onChange={(e) => handleChange('cy', parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none w-14"
                />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs text-slate-400 w-12">radius</label>
              <input
                type="number"
                value={data.radius ?? 40}
                onChange={(e) => handleChange('radius', parseFloat(e.target.value) || 1)}
                className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </>
        )}

        {/* Arc-specific: start/end angles */}
        {pathType === 'arc' && (
          <div className="grid grid-cols-2 gap-1">
            <div className="flex items-center gap-1">
              <label className="text-xs text-slate-400 w-8">start</label>
              <input
                type="number"
                value={data.startAngle ?? 0}
                onChange={(e) => handleChange('startAngle', parseFloat(e.target.value) || 0)}
                className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none w-12"
              />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs text-slate-400 w-8">end</label>
              <input
                type="number"
                value={data.endAngle ?? 180}
                onChange={(e) => handleChange('endAngle', parseFloat(e.target.value) || 0)}
                className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none w-12"
              />
            </div>
          </div>
        )}

        {/* Line params */}
        {pathType === 'line' && (
          <>
            <div className="grid grid-cols-2 gap-1">
              <div className="flex items-center gap-1">
                <label className="text-xs text-slate-400 w-6">x1</label>
                <input
                  type="number"
                  value={data.x1 ?? 10}
                  onChange={(e) => handleChange('x1', parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none w-14"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-slate-400 w-6">y1</label>
                <input
                  type="number"
                  value={data.y1 ?? 60}
                  onChange={(e) => handleChange('y1', parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none w-14"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="flex items-center gap-1">
                <label className="text-xs text-slate-400 w-6">x2</label>
                <input
                  type="number"
                  value={data.x2 ?? 140}
                  onChange={(e) => handleChange('x2', parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none w-14"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-slate-400 w-6">y2</label>
                <input
                  type="number"
                  value={data.y2 ?? 60}
                  onChange={(e) => handleChange('y2', parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none w-14"
                />
              </div>
            </div>
          </>
        )}

        {/* Wave params */}
        {pathType === 'wave' && (
          <>
            <div className="grid grid-cols-2 gap-1">
              <div className="flex items-center gap-1">
                <label className="text-xs text-slate-400 w-6">cx</label>
                <input
                  type="number"
                  value={data.cx ?? 75}
                  onChange={(e) => handleChange('cx', parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none w-14"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-slate-400 w-6">cy</label>
                <input
                  type="number"
                  value={data.cy ?? 60}
                  onChange={(e) => handleChange('cy', parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none w-14"
                />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs text-slate-400 w-12">amp</label>
              <input
                type="number"
                value={data.amplitude ?? 20}
                onChange={(e) => handleChange('amplitude', parseFloat(e.target.value) || 1)}
                className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs text-slate-400 w-12">freq</label>
              <input
                type="number"
                step="0.1"
                value={data.frequency ?? 2}
                onChange={(e) => handleChange('frequency', parseFloat(e.target.value) || 1)}
                className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </>
        )}

        {/* Spiral params */}
        {pathType === 'spiral' && (
          <>
            <div className="grid grid-cols-2 gap-1">
              <div className="flex items-center gap-1">
                <label className="text-xs text-slate-400 w-6">cx</label>
                <input
                  type="number"
                  value={data.cx ?? 75}
                  onChange={(e) => handleChange('cx', parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none w-14"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-slate-400 w-6">cy</label>
                <input
                  type="number"
                  value={data.cy ?? 60}
                  onChange={(e) => handleChange('cy', parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none w-14"
                />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs text-slate-400 w-12">turns</label>
              <input
                type="number"
                step="0.5"
                value={data.turns ?? 3}
                onChange={(e) => handleChange('turns', parseFloat(e.target.value) || 1)}
                className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs text-slate-400 w-12">growth</label>
              <input
                type="number"
                step="0.5"
                value={data.growth ?? 5}
                onChange={(e) => handleChange('growth', parseFloat(e.target.value) || 1)}
                className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </>
        )}

        {/* Layout options */}
        <div className="border-t border-slate-700 pt-2 mt-2">
          <div className="flex items-center gap-2 mb-1">
            <label className="text-xs text-slate-400 w-12">align</label>
            <select
              value={data.align || 'start'}
              onChange={(e) => handleChange('align', e.target.value)}
              className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none"
            >
              <option value="start">Start</option>
              <option value="center">Center</option>
              <option value="end">End</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-slate-400 w-12">spacing</label>
            <input
              type="number"
              step="0.1"
              value={data.spacing ?? 1}
              onChange={(e) => handleChange('spacing', parseFloat(e.target.value) || 1)}
              className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 mt-1 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={data.reverse || false}
              onChange={(e) => handleChange('reverse', e.target.checked)}
              className="rounded bg-slate-700 border-slate-600"
            />
            Reverse direction
          </label>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-cyan-500 !border-slate-700 !w-3 !h-3"
      />
    </div>
  );
}

export const PathNode = memo(PathNodeComponent);
