import { memo, useCallback, useState } from 'react';
import { Handle, Position } from '@xyflow/react';

interface SlicerNodeData extends Record<string, unknown> {
  label: string;
  // Extrusion settings
  extrudeHeight: number;
  wallThickness: number;
  // Slice settings
  layerHeight: number;
  extractLayer: number;
  // Infill settings
  infillPattern: 'lines' | 'grid' | 'triangles' | 'honeycomb' | 'gyroid' | 'concentric';
  infillDensity: number;
  infillAngle: number;
  // Output options
  includeWalls: boolean;
  includeInfill: boolean;
  includeTravel: boolean;
  // State
  isSlicing?: boolean;
  sliceProgress?: number;
  error?: string;
  lastSliceHash?: string;
}

type SlicerNodeProps = {
  id: string;
  data: SlicerNodeData;
};

// Pattern icons/previews
const PATTERN_ICONS: Record<string, string> = {
  lines: '═',
  grid: '╬',
  triangles: '△',
  honeycomb: '⬡',
  gyroid: '∿',
  concentric: '◎',
};

function SlicerNodeComponent({ data, id }: SlicerNodeProps) {
  const [expanded, setExpanded] = useState(false);
  
  const handleChange = useCallback((field: string, value: unknown) => {
    const event = new CustomEvent('nodeDataChange', {
      detail: { nodeId: id, field, value },
    });
    window.dispatchEvent(event);
  }, [id]);

  const handleSlice = useCallback(() => {
    // Trigger slice execution
    const event = new CustomEvent('slicerExecute', {
      detail: { nodeId: id },
    });
    window.dispatchEvent(event);
  }, [id]);

  // Calculate estimated layers
  const estimatedLayers = Math.ceil((data.extrudeHeight || 10) / (data.layerHeight || 0.2));

  return (
    <div className="rounded-lg border-2 border-indigo-500 bg-indigo-500/10 bg-slate-800 shadow-lg min-w-[200px] max-w-[260px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-indigo-400 !border-indigo-600 !w-3 !h-3"
      />

      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-mono text-indigo-400">⬢</span>
          <span className="font-medium text-white text-sm">{data.label || 'Slicer'}</span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
          title={expanded ? 'Collapse' : 'Expand settings'}
        >
          <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Error display */}
      {data.error && (
        <div className="px-3 py-1.5 bg-red-500/20 border-b border-red-500/30">
          <p className="text-[10px] text-red-400 font-mono truncate" title={data.error}>
            {data.error}
          </p>
        </div>
      )}

      {/* Progress indicator */}
      {data.isSlicing && (
        <div className="px-3 py-2 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full" />
            <span className="text-xs text-indigo-400">Slicing...</span>
          </div>
          {data.sliceProgress !== undefined && (
            <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all duration-200"
                style={{ width: `${data.sliceProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Quick Settings (always visible) */}
      <div className="p-2 space-y-2">
        {/* Pattern selector */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400 w-14">Pattern</span>
          <div className="flex gap-1 flex-1">
            {(['lines', 'grid', 'triangles', 'honeycomb', 'gyroid', 'concentric'] as const).map((pattern) => (
              <button
                key={pattern}
                onClick={() => handleChange('infillPattern', pattern)}
                className={`flex-1 py-1 text-xs rounded transition-all ${
                  data.infillPattern === pattern
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                }`}
                title={pattern}
              >
                {PATTERN_ICONS[pattern]}
              </button>
            ))}
          </div>
        </div>

        {/* Density slider */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 w-14">Density</span>
          <input
            type="range"
            min="0"
            max="100"
            value={data.infillDensity || 20}
            onChange={(e) => handleChange('infillDensity', parseInt(e.target.value))}
            className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <span className="text-xs text-slate-500 w-8 text-right">{data.infillDensity || 20}%</span>
        </div>

        {/* Toggle buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleChange('includeWalls', !data.includeWalls)}
            className={`flex-1 px-2 py-1 text-[10px] rounded transition-colors ${
              data.includeWalls
                ? 'bg-indigo-600/50 text-indigo-300'
                : 'bg-slate-700 text-slate-500'
            }`}
          >
            Walls
          </button>
          <button
            onClick={() => handleChange('includeInfill', !data.includeInfill)}
            className={`flex-1 px-2 py-1 text-[10px] rounded transition-colors ${
              data.includeInfill
                ? 'bg-indigo-600/50 text-indigo-300'
                : 'bg-slate-700 text-slate-500'
            }`}
          >
            Infill
          </button>
          <button
            onClick={() => handleChange('includeTravel', !data.includeTravel)}
            className={`flex-1 px-2 py-1 text-[10px] rounded transition-colors ${
              data.includeTravel
                ? 'bg-indigo-600/50 text-indigo-300'
                : 'bg-slate-700 text-slate-500'
            }`}
          >
            Travel
          </button>
        </div>
      </div>

      {/* Expanded Settings */}
      {expanded && (
        <div className="p-2 pt-0 space-y-2 border-t border-slate-700 mt-0">
          {/* Extrusion height */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-16">Height</label>
            <input
              type="number"
              value={data.extrudeHeight || 10}
              onChange={(e) => handleChange('extrudeHeight', parseFloat(e.target.value) || 10)}
              className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-indigo-500 focus:outline-none w-14"
              step="1"
              min="0.1"
            />
            <span className="text-xs text-slate-500">mm</span>
          </div>

          {/* Layer height */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-16">Layer H</label>
            <input
              type="number"
              value={data.layerHeight || 0.2}
              onChange={(e) => handleChange('layerHeight', parseFloat(e.target.value) || 0.2)}
              className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-indigo-500 focus:outline-none w-14"
              step="0.05"
              min="0.05"
              max="1"
            />
            <span className="text-xs text-slate-500">mm</span>
          </div>

          {/* Wall thickness */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-16">Wall</label>
            <input
              type="number"
              value={data.wallThickness || 0.8}
              onChange={(e) => handleChange('wallThickness', parseFloat(e.target.value) || 0.8)}
              className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-indigo-500 focus:outline-none w-14"
              step="0.1"
              min="0.1"
            />
            <span className="text-xs text-slate-500">mm</span>
          </div>

          {/* Infill angle */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-16">Angle</label>
            <input
              type="number"
              value={data.infillAngle || 45}
              onChange={(e) => handleChange('infillAngle', parseFloat(e.target.value) || 45)}
              className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-indigo-500 focus:outline-none w-14"
              step="15"
              min="0"
              max="180"
            />
            <span className="text-xs text-slate-500">°</span>
          </div>

          {/* Extract layer */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-16">Layer</label>
            <input
              type="number"
              value={data.extractLayer ?? -1}
              onChange={(e) => handleChange('extractLayer', parseInt(e.target.value))}
              className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-indigo-500 focus:outline-none w-14"
              min="-1"
            />
            <span className="text-xs text-slate-500 truncate" title="-1 = all layers">
              {data.extractLayer === -1 ? 'All' : `of ${estimatedLayers}`}
            </span>
          </div>
        </div>
      )}

      {/* Slice button */}
      <div className="px-2 pb-2">
        <button
          onClick={handleSlice}
          disabled={data.isSlicing}
          className={`w-full px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            data.isSlicing
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
          }`}
        >
          {data.isSlicing ? 'Slicing...' : '⬢ Generate Pattern'}
        </button>
      </div>

      {/* Stats footer */}
      <div className="px-3 py-1.5 border-t border-slate-700 bg-slate-800/50">
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>~{estimatedLayers} layers</span>
          <span>{data.infillPattern || 'grid'} @ {data.infillDensity || 20}%</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-indigo-400 !border-indigo-600 !w-3 !h-3"
      />
    </div>
  );
}

export const SlicerNode = memo(SlicerNodeComponent);
