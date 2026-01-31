import { memo, useCallback, useRef, useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';

interface SvgNodeData extends Record<string, unknown> {
  label: string;
  svgContent?: string;
  filename?: string;
  scale: number;
  offsetX: number;
  offsetY: number;
  color?: 1 | 2 | 3 | 4;
}

// Default colors for the 4 color wells
const COLOR_WELL_COLORS = ['#1e40af', '#dc2626', '#16a34a', '#171717'];

type SvgNodeProps = {
  id: string;
  data: SvgNodeData;
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
        className="nodrag w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
      />
    </div>
  );
}

function SvgNodeComponent({ data, id }: SvgNodeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewSvg, setPreviewSvg] = useState<string | undefined>(data.svgContent);

  useEffect(() => {
    setPreviewSvg(data.svgContent);
  }, [data.svgContent]);

  const dispatchChange = useCallback((field: string, value: unknown) => {
    const event = new CustomEvent('nodeDataChange', {
      detail: { nodeId: id, field, value },
    });
    window.dispatchEvent(event);
  }, [id]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onloadend = () => {
        const svgContent = reader.result as string;
        dispatchChange('svgContent', svgContent);
        dispatchChange('filename', file.name);
      };
      reader.readAsText(file);
    }
  }, [dispatchChange]);

  const handleClearSvg = useCallback(() => {
    dispatchChange('svgContent', undefined);
    dispatchChange('filename', undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [dispatchChange]);

  const handleColorChange = useCallback((colorIndex: 1 | 2 | 3 | 4 | undefined) => {
    dispatchChange('color', colorIndex);
  }, [dispatchChange]);

  const {
    scale = 1,
    offsetX = 0,
    offsetY = 0,
    color,
  } = data;

  return (
    <div className="bg-slate-800 border-2 border-orange-500 bg-orange-500/10 rounded-lg shadow-lg min-w-[200px]">
      <Handle
        type="source"
        position={Position.Bottom}
        id="source"
        className="w-3 h-3 bg-orange-500 border-2 border-slate-800"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-orange-400 text-xs font-mono">◇</span>
          <span className="text-sm font-medium text-slate-200">{data.label || 'SVG'}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Color selector */}
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

      <div className="p-3 space-y-2">
        {previewSvg ? (
          <div className="flex flex-col items-center space-y-2">
            {data.filename && (
              <p className="text-xs text-slate-400 truncate w-full text-center">📄 {data.filename}</p>
            )}
            {/* Transform controls */}
            <div className="w-full space-y-2 nodrag">
              <SliderField
                label="Scale"
                value={scale}
                min={0.1}
                max={5}
                step={0.1}
                field="scale"
                unit="×"
                onChange={dispatchChange}
              />
              <div className="grid grid-cols-2 gap-2">
                <SliderField
                  label="Offset X"
                  value={offsetX}
                  min={-100}
                  max={100}
                  step={1}
                  field="offsetX"
                  unit="mm"
                  onChange={dispatchChange}
                />
                <SliderField
                  label="Offset Y"
                  value={offsetY}
                  min={-100}
                  max={100}
                  step={1}
                  field="offsetY"
                  unit="mm"
                  onChange={dispatchChange}
                />
              </div>
            </div>

            {/* Clear button */}
            <button
              onClick={handleClearSvg}
              className="nodrag w-full py-1.5 px-3 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded border border-red-900/50 transition-colors"
            >
              Clear SVG
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="nodrag w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded border border-slate-600 border-dashed transition-colors"
          >
            Click to load SVG
          </button>
        )}
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".svg,image/svg+xml"
        />
      </div>
    </div>
  );
}

export const SvgNode = memo(SvgNodeComponent);
