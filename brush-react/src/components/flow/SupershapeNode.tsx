import { memo, useCallback, useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { generateSupershape, SUPERSHAPE_PRESETS, type SupershapeParams } from '../../utils/supershapeGenerator';
import { serializeGeometry } from '../../utils/objLoader';

interface SupershapeNodeData extends Record<string, unknown> {
  label: string;
  // First superformula
  m1: number;
  n1_1: number;
  n2_1: number;
  n3_1: number;
  a1: number;
  b1: number;
  // Second superformula
  m2: number;
  n1_2: number;
  n2_2: number;
  n3_2: number;
  a2: number;
  b2: number;
  // Resolution
  segments: number;
  // Generated data
  geometryData?: string;
  vertexCount?: number;
  edgeCount?: number;
}

type SupershapeNodeProps = {
  id: string;
  data: SupershapeNodeData;
};

function SupershapeNodeComponent({ data, id }: SupershapeNodeProps) {
  const [expanded, setExpanded] = useState(false);

  const handleChange = useCallback((field: string, value: unknown) => {
    const event = new CustomEvent('nodeDataChange', {
      detail: { nodeId: id, field, value },
    });
    window.dispatchEvent(event);
  }, [id]);

  // Generate geometry when parameters change
  useEffect(() => {
    const params: SupershapeParams = {
      m1: data.m1 ?? 4,
      n1_1: data.n1_1 ?? 1,
      n2_1: data.n2_1 ?? 1,
      n3_1: data.n3_1 ?? 1,
      a1: data.a1 ?? 1,
      b1: data.b1 ?? 1,
      m2: data.m2 ?? 4,
      n1_2: data.n1_2 ?? 1,
      n2_2: data.n2_2 ?? 1,
      n3_2: data.n3_2 ?? 1,
      a2: data.a2 ?? 1,
      b2: data.b2 ?? 1,
      segments: data.segments ?? 20,
    };

    try {
      const geometry = generateSupershape(params);
      handleChange('geometryData', serializeGeometry(geometry));
      handleChange('vertexCount', geometry.vertices.length);
      handleChange('edgeCount', geometry.edges.length);
    } catch (err) {
      console.error('Supershape generation error:', err);
    }
  }, [
    data.m1, data.n1_1, data.n2_1, data.n3_1, data.a1, data.b1,
    data.m2, data.n1_2, data.n2_2, data.n3_2, data.a2, data.b2,
    data.segments, handleChange
  ]);

  const applyPreset = useCallback((presetName: string) => {
    const preset = SUPERSHAPE_PRESETS[presetName];
    if (preset) {
      Object.entries(preset).forEach(([key, value]) => {
        handleChange(key, value);
      });
    }
  }, [handleChange]);

  return (
    <div className="rounded-lg border-2 border-pink-500 bg-pink-500/10 bg-slate-800 shadow-lg min-w-[220px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-400 !border-slate-600 !w-3 !h-3"
      />

      <div 
        className="px-3 py-2 border-b border-slate-700 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg text-pink-400">✦</span>
          <span className="font-medium text-white text-sm">{data.label || 'Supershape'}</span>
        </div>
        <span className="text-slate-400 text-xs">{expanded ? '▲' : '▼'}</span>
      </div>

      <div className="p-2 space-y-2">
        {/* Presets */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">Preset</label>
          <div className="flex flex-wrap gap-1">
            {['sphere', 'star', 'flower', 'crystal', 'organic'].map((preset) => (
              <button
                key={preset}
                onClick={(e) => { e.stopPropagation(); applyPreset(preset); }}
                className="px-2 py-0.5 text-xs bg-slate-700 hover:bg-pink-600 text-slate-300 hover:text-white rounded transition-colors capitalize"
              >
                {preset}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {['shell', 'pillow', 'gear', 'blob'].map((preset) => (
              <button
                key={preset}
                onClick={(e) => { e.stopPropagation(); applyPreset(preset); }}
                className="px-2 py-0.5 text-xs bg-slate-700 hover:bg-pink-600 text-slate-300 hover:text-white rounded transition-colors capitalize"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Main Parameters */}
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Shape 1 (Latitude)</label>
          <div className="grid grid-cols-4 gap-1">
            <div>
              <span className="text-[9px] text-slate-500 block text-center">m</span>
              <input
                type="number"
                value={data.m1 ?? 4}
                onChange={(e) => handleChange('m1', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-700 text-white text-xs px-1 py-1 rounded border border-slate-600 focus:border-pink-500 focus:outline-none text-center nodrag"
                step="1"
              />
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block text-center">n1</span>
              <input
                type="number"
                value={data.n1_1 ?? 1}
                onChange={(e) => handleChange('n1_1', parseFloat(e.target.value) || 0.1)}
                className="w-full bg-slate-700 text-white text-xs px-1 py-1 rounded border border-slate-600 focus:border-pink-500 focus:outline-none text-center nodrag"
                step="0.1"
              />
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block text-center">n2</span>
              <input
                type="number"
                value={data.n2_1 ?? 1}
                onChange={(e) => handleChange('n2_1', parseFloat(e.target.value) || 0.1)}
                className="w-full bg-slate-700 text-white text-xs px-1 py-1 rounded border border-slate-600 focus:border-pink-500 focus:outline-none text-center nodrag"
                step="0.1"
              />
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block text-center">n3</span>
              <input
                type="number"
                value={data.n3_1 ?? 1}
                onChange={(e) => handleChange('n3_1', parseFloat(e.target.value) || 0.1)}
                className="w-full bg-slate-700 text-white text-xs px-1 py-1 rounded border border-slate-600 focus:border-pink-500 focus:outline-none text-center nodrag"
                step="0.1"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-400">Shape 2 (Longitude)</label>
          <div className="grid grid-cols-4 gap-1">
            <div>
              <span className="text-[9px] text-slate-500 block text-center">m</span>
              <input
                type="number"
                value={data.m2 ?? 4}
                onChange={(e) => handleChange('m2', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-700 text-white text-xs px-1 py-1 rounded border border-slate-600 focus:border-pink-500 focus:outline-none text-center nodrag"
                step="1"
              />
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block text-center">n1</span>
              <input
                type="number"
                value={data.n1_2 ?? 1}
                onChange={(e) => handleChange('n1_2', parseFloat(e.target.value) || 0.1)}
                className="w-full bg-slate-700 text-white text-xs px-1 py-1 rounded border border-slate-600 focus:border-pink-500 focus:outline-none text-center nodrag"
                step="0.1"
              />
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block text-center">n2</span>
              <input
                type="number"
                value={data.n2_2 ?? 1}
                onChange={(e) => handleChange('n2_2', parseFloat(e.target.value) || 0.1)}
                className="w-full bg-slate-700 text-white text-xs px-1 py-1 rounded border border-slate-600 focus:border-pink-500 focus:outline-none text-center nodrag"
                step="0.1"
              />
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block text-center">n3</span>
              <input
                type="number"
                value={data.n3_2 ?? 1}
                onChange={(e) => handleChange('n3_2', parseFloat(e.target.value) || 0.1)}
                className="w-full bg-slate-700 text-white text-xs px-1 py-1 rounded border border-slate-600 focus:border-pink-500 focus:outline-none text-center nodrag"
                step="0.1"
              />
            </div>
          </div>
        </div>

        {/* Resolution */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500">Segments</label>
            <input
              type="number"
              value={data.segments ?? 20}
              onChange={(e) => handleChange('segments', parseInt(e.target.value) || 10)}
              className="w-full bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-pink-500 focus:outline-none nodrag"
              min="5"
              max="100"
              step="5"
            />
          </div>
          <div className="flex items-end">
            <div className="text-[10px] text-slate-500 pb-1">
              {data.vertexCount || 0} verts • {data.edgeCount || 0} edges
            </div>
          </div>
        </div>

        {/* Expanded: Scale parameters */}
        {expanded && (
          <div className="space-y-2 pt-2 border-t border-slate-700">
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Scale (a, b)</label>
              <div className="grid grid-cols-4 gap-1">
                <div>
                  <span className="text-[9px] text-slate-500 block text-center">a1</span>
                  <input
                    type="number"
                    value={data.a1 ?? 1}
                    onChange={(e) => handleChange('a1', parseFloat(e.target.value) || 1)}
                    className="w-full bg-slate-700 text-white text-xs px-1 py-1 rounded border border-slate-600 focus:border-pink-500 focus:outline-none text-center nodrag"
                    step="0.1"
                    min="0.1"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block text-center">b1</span>
                  <input
                    type="number"
                    value={data.b1 ?? 1}
                    onChange={(e) => handleChange('b1', parseFloat(e.target.value) || 1)}
                    className="w-full bg-slate-700 text-white text-xs px-1 py-1 rounded border border-slate-600 focus:border-pink-500 focus:outline-none text-center nodrag"
                    step="0.1"
                    min="0.1"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block text-center">a2</span>
                  <input
                    type="number"
                    value={data.a2 ?? 1}
                    onChange={(e) => handleChange('a2', parseFloat(e.target.value) || 1)}
                    className="w-full bg-slate-700 text-white text-xs px-1 py-1 rounded border border-slate-600 focus:border-pink-500 focus:outline-none text-center nodrag"
                    step="0.1"
                    min="0.1"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block text-center">b2</span>
                  <input
                    type="number"
                    value={data.b2 ?? 1}
                    onChange={(e) => handleChange('b2', parseFloat(e.target.value) || 1)}
                    className="w-full bg-slate-700 text-white text-xs px-1 py-1 rounded border border-slate-600 focus:border-pink-500 focus:outline-none text-center nodrag"
                    step="0.1"
                    min="0.1"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="text-[10px] text-slate-500 pt-1">
          Connect to Wireframe node →
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-orange-500 !border-orange-600 !w-3 !h-3"
      />
    </div>
  );
}

export const SupershapeNode = memo(SupershapeNodeComponent);
