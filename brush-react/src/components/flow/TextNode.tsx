import { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';

interface TextNodeData extends Record<string, unknown> {
  label: string;
  text: string;
  x: number;
  y: number;
  size: number;
  spacing: number;
}

type TextNodeProps = {
  id: string;
  data: TextNodeData;
};

function TextNodeComponent({ data, id }: TextNodeProps) {
  const handleChange = useCallback((field: string, value: string | number) => {
    const event = new CustomEvent('nodeDataChange', {
      detail: { nodeId: id, field, value },
    });
    window.dispatchEvent(event);
  }, [id]);

  return (
    <div className="rounded-lg border-2 border-indigo-500 bg-indigo-500/10 bg-slate-800 shadow-lg min-w-[180px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-400 !border-slate-600 !w-3 !h-3"
      />

      <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-2">
        <span className="text-lg font-mono text-slate-300">Aa</span>
        <span className="font-medium text-white text-sm">{data.label || 'Text'}</span>
      </div>

      <div className="p-2 space-y-2">
        {/* Text input */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">Text</label>
          <input
            type="text"
            value={data.text || ''}
            onChange={(e) => handleChange('text', e.target.value)}
            placeholder="Enter text..."
            className="w-full bg-slate-700 text-white text-sm px-2 py-1.5 rounded border border-slate-600 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Position */}
        <div className="grid grid-cols-2 gap-1">
          <div className="flex items-center gap-1">
            <label className="text-xs text-slate-400 w-4">x</label>
            <input
              type="number"
              value={data.x || 0}
              onChange={(e) => handleChange('x', parseFloat(e.target.value) || 0)}
              className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-indigo-500 focus:outline-none w-12"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-slate-400 w-4">y</label>
            <input
              type="number"
              value={data.y || 0}
              onChange={(e) => handleChange('y', parseFloat(e.target.value) || 0)}
              className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-indigo-500 focus:outline-none w-12"
            />
          </div>
        </div>

        {/* Size and spacing */}
        <div className="grid grid-cols-2 gap-1">
          <div className="flex items-center gap-1">
            <label className="text-xs text-slate-400 w-6">size</label>
            <input
              type="number"
              value={data.size || 10}
              onChange={(e) => handleChange('size', parseFloat(e.target.value) || 10)}
              className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-indigo-500 focus:outline-none w-12"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-slate-400 w-6">spc</label>
            <input
              type="number"
              value={data.spacing || 1.2}
              step="0.1"
              onChange={(e) => handleChange('spacing', parseFloat(e.target.value) || 1.2)}
              className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-indigo-500 focus:outline-none w-12"
            />
          </div>
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

export const TextNode = memo(TextNodeComponent);
