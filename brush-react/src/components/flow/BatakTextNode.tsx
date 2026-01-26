import { memo, useCallback, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { transliterateToba } from '../../utils/transliteration';

interface BatakTextNodeData extends Record<string, unknown> {
  label: string;
  text: string;
  x: number;
  y: number;
  size: number;
}

type BatakTextNodeProps = {
  id: string;
  data: BatakTextNodeData;
};

function BatakTextNodeComponent({ id, data }: BatakTextNodeProps) {
  const handleChange = useCallback(
    (field: string, value: string | number) => {
      const event = new CustomEvent('nodeDataChange', {
        detail: { nodeId: id, field, value },
      });
      window.dispatchEvent(event);
    },
    [id]
  );

  // Preview the transliterated text
  const batakText = useMemo(() => {
    try {
      return transliterateToba(data.text || '');
    } catch {
      return '';
    }
  }, [data.text]);

  return (
    <div className="rounded-lg border-2 border-orange-500 bg-orange-500/10 bg-slate-800 shadow-lg min-w-[180px]">
      {/* No input handle - generates its own paths */}

      <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-2">
        <span className="text-lg font-bold text-orange-400">ᯀ</span>
        <span className="font-medium text-white text-sm">{data.label || 'Batak Text'}</span>
      </div>

      <div className="p-2 space-y-2">
        {/* Text input */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">Latin Text</label>
          <input
            type="text"
            value={data.text || ''}
            onChange={(e) => handleChange('text', e.target.value)}
            placeholder="horas"
            className="w-full bg-slate-700 text-white text-sm px-2 py-1.5 rounded border border-slate-600 focus:border-orange-500 focus:outline-none"
          />
        </div>

        {/* Batak preview */}
        {batakText && (
          <div className="bg-slate-700/50 rounded px-2 py-1 text-center">
            <span className="text-orange-200 text-sm">{batakText}</span>
          </div>
        )}

        {/* Position */}
        <div className="grid grid-cols-2 gap-1">
          <div className="flex items-center gap-1">
            <label className="text-xs text-slate-400 w-4">x</label>
            <input
              type="number"
              value={data.x || 0}
              onChange={(e) => handleChange('x', parseFloat(e.target.value) || 0)}
              className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-orange-500 focus:outline-none w-12"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-slate-400 w-4">y</label>
            <input
              type="number"
              value={data.y || 0}
              onChange={(e) => handleChange('y', parseFloat(e.target.value) || 0)}
              className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-orange-500 focus:outline-none w-12"
            />
          </div>
        </div>

        {/* Size */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-slate-400 w-6">size</label>
          <input
            type="number"
            value={data.size || 30}
            onChange={(e) => handleChange('size', parseFloat(e.target.value) || 30)}
            className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-orange-500 focus:outline-none w-12"
          />
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-orange-500 !border-slate-700 !w-3 !h-3"
      />
    </div>
  );
}

export const BatakTextNode = memo(BatakTextNodeComponent);
