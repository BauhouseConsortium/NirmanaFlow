import { memo, useCallback, useRef, useEffect, useState } from 'react';
import { Handle, Position } from '@xyflow/react';

interface MaskNodeData extends Record<string, unknown> {
  label: string;
  threshold: number;
  invert: boolean;
  feather: number;
  color?: 1 | 2 | 3 | 4;
}

// Default colors for the 4 color wells
const COLOR_WELL_COLORS = ['#1e40af', '#dc2626', '#16a34a', '#171717'];

type MaskNodeProps = {
  id: string;
  data: MaskNodeData;
};

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  field: string;
  unit?: string;
  onChange: (field: string, value: number) => void;
}

function SliderField({ label, value, min, max, step, field, unit, onChange }: SliderFieldProps) {
  const [localValue, setLocalValue] = useState<number>(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    setLocalValue(newValue);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(field, newValue);
    }, 200);
  };
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <label className="text-slate-400">{label}</label>
        <span className="text-slate-300">{localValue}{unit || ''}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={localValue}
        onChange={handleChange}
        className="nodrag w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
      />
    </div>
  );
}

function MaskNodeComponent({ data, id }: MaskNodeProps) {
  const handleChange = useCallback((field: string, value: number | boolean | string) => {
    const event = new CustomEvent('nodeDataChange', {
      detail: { nodeId: id, field, value },
    });
    window.dispatchEvent(event);
  }, [id]);

  const handleColorChange = useCallback((colorIndex: 1 | 2 | 3 | 4 | undefined) => {
    const event = new CustomEvent('nodeDataChange', {
      detail: { nodeId: id, field: 'color', value: colorIndex },
    });
    window.dispatchEvent(event);
  }, [id]);

  const {
    threshold = 0.5,
    invert = false,
    feather = 0,
    color,
  } = data;

  return (
    <div className="bg-slate-800 border-2 border-violet-500 bg-violet-500/10 rounded-lg shadow-lg min-w-[200px]">
      {/* Input handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="paths"
        className="w-3 h-3 bg-violet-500 border-2 border-slate-800"
        style={{ left: '30%' }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="mask"
        className="w-3 h-3 bg-blue-500 border-2 border-slate-800"
        style={{ left: '70%' }}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-violet-400 text-xs font-mono">◐</span>
          <span className="text-sm font-medium text-slate-200">{data.label || 'Mask'}</span>
        </div>
        {/* Color selector */}
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((idx) => (
            <button
              key={idx}
              onClick={() => handleColorChange(color === idx ? undefined : idx as 1 | 2 | 3 | 4)}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                color === idx ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
              style={{ backgroundColor: COLOR_WELL_COLORS[idx - 1] }}
              title={`Color ${idx}`}
            />
          ))}
        </div>
      </div>

      {/* Input labels */}
      <div className="flex justify-between px-3 py-1 text-xs text-slate-500">
        <span style={{ marginLeft: '10%' }}>Paths</span>
        <span style={{ marginRight: '10%' }}>Mask</span>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3 nodrag">
        {/* Threshold */}
        <SliderField
          label="Threshold"
          value={threshold}
          min={0}
          max={1}
          step={0.05}
          field="threshold"
          onChange={handleChange}
        />

        {/* Feather/blur */}
        <SliderField
          label="Feather"
          value={feather}
          min={0}
          max={10}
          step={0.5}
          field="feather"
          unit="px"
          onChange={handleChange}
        />

        {/* Invert toggle */}
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-400">Invert Mask</label>
          <button
            onClick={() => handleChange('invert', !invert)}
            className={`nodrag w-10 h-5 rounded-full transition-colors ${
              invert ? 'bg-violet-500' : 'bg-slate-600'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                invert ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Info */}
        <div className="text-xs text-slate-500 border-t border-slate-700 pt-2">
          <p>White areas = keep paths</p>
          <p>Black areas = remove paths</p>
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="source"
        className="w-3 h-3 bg-violet-500 border-2 border-slate-800"
      />
    </div>
  );
}

export const MaskNode = memo(MaskNodeComponent);
