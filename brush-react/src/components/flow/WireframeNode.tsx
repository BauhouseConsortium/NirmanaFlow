import { memo, useCallback, useState } from 'react';
import { Handle, Position } from '@xyflow/react';

interface WireframeNodeData extends Record<string, unknown> {
  label: string;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  distance: number;
  projection: 'perspective' | 'orthographic';
  fov: number;
  scale: number;
  centerX: number;
  centerY: number;
  edgeReduction: number;
  edgeAngleThreshold: number;
}

type WireframeNodeProps = {
  id: string;
  data: WireframeNodeData;
};

// Preset camera angles
const PRESETS = {
  front: { rotationX: 0, rotationY: 0, rotationZ: 0 },
  back: { rotationX: 0, rotationY: 180, rotationZ: 0 },
  top: { rotationX: 90, rotationY: 0, rotationZ: 0 },
  bottom: { rotationX: -90, rotationY: 0, rotationZ: 0 },
  left: { rotationX: 0, rotationY: -90, rotationZ: 0 },
  right: { rotationX: 0, rotationY: 90, rotationZ: 0 },
  iso: { rotationX: 35, rotationY: 45, rotationZ: 0 },
};

function WireframeNodeComponent({ data, id }: WireframeNodeProps) {
  const [expanded, setExpanded] = useState(false);

  const handleChange = useCallback((field: string, value: unknown) => {
    const event = new CustomEvent('nodeDataChange', {
      detail: { nodeId: id, field, value },
    });
    window.dispatchEvent(event);
  }, [id]);

  const applyPreset = useCallback((preset: keyof typeof PRESETS) => {
    const values = PRESETS[preset];
    handleChange('rotationX', values.rotationX);
    handleChange('rotationY', values.rotationY);
    handleChange('rotationZ', values.rotationZ);
  }, [handleChange]);

  return (
    <div className="rounded-lg border-2 border-purple-500 bg-purple-500/10 bg-slate-800 shadow-lg min-w-[220px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-orange-500 !border-orange-600 !w-3 !h-3"
      />

      <div 
        className="px-3 py-2 border-b border-slate-700 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg text-purple-400">◇</span>
          <span className="font-medium text-white text-sm">{data.label || 'Wireframe'}</span>
        </div>
        <span className="text-slate-400 text-xs">{expanded ? '▲' : '▼'}</span>
      </div>

      <div className="p-2 space-y-2">
        {/* Camera Presets */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">View</label>
          <div className="flex flex-wrap gap-1">
            {(['front', 'top', 'iso', 'left', 'right'] as const).map((preset) => (
              <button
                key={preset}
                onClick={(e) => { e.stopPropagation(); applyPreset(preset); }}
                className="px-2 py-0.5 text-xs bg-slate-700 hover:bg-purple-600 text-slate-300 hover:text-white rounded transition-colors capitalize"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Rotation Controls */}
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Rotation</label>
          <div className="grid grid-cols-3 gap-1">
            {(['rotationX', 'rotationY', 'rotationZ'] as const).map((axis) => (
              <div key={axis} className="flex flex-col items-center">
                <span className="text-[10px] text-slate-500 uppercase">{axis.slice(-1)}</span>
                <input
                  type="number"
                  value={data[axis] || 0}
                  onChange={(e) => handleChange(axis, parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-700 text-white text-xs px-1.5 py-1 rounded border border-slate-600 focus:border-purple-500 focus:outline-none text-center nodrag"
                  step="15"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Scale & Projection */}
        <div className="grid grid-cols-2 gap-1">
          <div>
            <label className="text-[10px] text-slate-500">Scale</label>
            <input
              type="number"
              value={data.scale || 50}
              onChange={(e) => handleChange('scale', parseFloat(e.target.value) || 50)}
              className="w-full bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-purple-500 focus:outline-none nodrag"
              step="5"
              min="1"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Projection</label>
            <select
              value={data.projection || 'orthographic'}
              onChange={(e) => handleChange('projection', e.target.value)}
              className="w-full bg-slate-700 text-white text-xs px-1 py-1 rounded border border-slate-600 focus:border-purple-500 focus:outline-none nodrag"
            >
              <option value="orthographic">Ortho</option>
              <option value="perspective">Persp</option>
            </select>
          </div>
        </div>

        {/* Edge Reduction */}
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Edge Reduction</label>
          <div className="grid grid-cols-2 gap-1">
            <div>
              <label className="text-[10px] text-slate-500">Skip</label>
              <select
                value={data.edgeReduction || 0}
                onChange={(e) => handleChange('edgeReduction', parseInt(e.target.value))}
                className="w-full bg-slate-700 text-white text-xs px-1 py-1 rounded border border-slate-600 focus:border-purple-500 focus:outline-none nodrag"
              >
                <option value="0">All</option>
                <option value="1">1/2</option>
                <option value="2">1/3</option>
                <option value="3">1/4</option>
                <option value="4">1/5</option>
                <option value="9">1/10</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Angle °</label>
              <input
                type="number"
                value={data.edgeAngleThreshold || 0}
                onChange={(e) => handleChange('edgeAngleThreshold', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-purple-500 focus:outline-none nodrag"
                min="0"
                max="180"
                step="5"
                title="Only show edges where face angle > this value (0 = all)"
              />
            </div>
          </div>
        </div>

        {/* Expanded Settings */}
        {expanded && (
          <div className="space-y-2 pt-2 border-t border-slate-700">
            {/* Center Position */}
            <div className="grid grid-cols-2 gap-1">
              <div>
                <label className="text-[10px] text-slate-500">Center X</label>
                <input
                  type="number"
                  value={data.centerX || 75}
                  onChange={(e) => handleChange('centerX', parseFloat(e.target.value) || 75)}
                  className="w-full bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-purple-500 focus:outline-none nodrag"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Center Y</label>
                <input
                  type="number"
                  value={data.centerY || 60}
                  onChange={(e) => handleChange('centerY', parseFloat(e.target.value) || 60)}
                  className="w-full bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-purple-500 focus:outline-none nodrag"
                />
              </div>
            </div>

            {/* Perspective Settings */}
            {data.projection === 'perspective' && (
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="text-[10px] text-slate-500">FOV</label>
                  <input
                    type="number"
                    value={data.fov || 50}
                    onChange={(e) => handleChange('fov', parseFloat(e.target.value) || 50)}
                    className="w-full bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-purple-500 focus:outline-none nodrag"
                    min="10"
                    max="120"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Distance</label>
                  <input
                    type="number"
                    value={data.distance || 3}
                    onChange={(e) => handleChange('distance', parseFloat(e.target.value) || 3)}
                    className="w-full bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-purple-500 focus:outline-none nodrag"
                    step="0.5"
                    min="1"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="text-[10px] text-slate-500 pt-1">
          ← Connect OBJ Loader
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-400 !border-slate-600 !w-3 !h-3"
      />
    </div>
  );
}

export const WireframeNode = memo(WireframeNodeComponent);
