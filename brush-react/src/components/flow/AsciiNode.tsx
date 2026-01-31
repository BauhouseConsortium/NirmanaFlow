import { memo, useCallback, useRef, useEffect, useState } from 'react';
import { Handle, Position } from '@xyflow/react';

interface AsciiNodeData extends Record<string, unknown> {
  label: string;
  charset: string;
  cellWidth: number;
  cellHeight: number;
  fontSize: number;
  outputWidth: number;
  outputHeight: number;
  invert: boolean;
  flipX: boolean;
  flipY: boolean;
  color?: 1 | 2 | 3 | 4;
}

// Default colors for the 4 color wells
const COLOR_WELL_COLORS = ['#1e40af', '#dc2626', '#16a34a', '#171717'];

// Preset character sets (ordered from light to dark)
const CHARSET_PRESETS: Record<string, string> = {
  standard: ' .:-=+*#%@',
  detailed: ' .\'`^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  blocks: ' ░▒▓█',
  simple: ' .*#',
  dots: ' .·•●',
  slashes: ' /\\|X#',
  custom: '',
};

type AsciiNodeProps = {
  id: string;
  data: AsciiNodeData;
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
        className="nodrag w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
      />
    </div>
  );
}

function AsciiNodeComponent({ data, id }: AsciiNodeProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>('standard');
  
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

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    if (preset !== 'custom') {
      handleChange('charset', CHARSET_PRESETS[preset]);
    }
  };

  const {
    charset = ' .:-=+*#%@',
    cellWidth = 3,
    cellHeight = 4,
    fontSize = 3,
    outputWidth = 100,
    outputHeight = 100,
    invert = false,
    flipX = false,
    flipY = true,
    color,
  } = data;

  return (
    <div className="bg-slate-800 border-2 border-emerald-500 bg-emerald-500/10 rounded-lg shadow-lg min-w-[240px]">
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        className="w-3 h-3 bg-emerald-500 border-2 border-slate-800"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 text-xs font-mono">Aa</span>
          <span className="text-sm font-medium text-slate-200">{data.label || 'ASCII'}</span>
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

      {/* Content */}
      <div className="p-3 space-y-3 nodrag">
        {/* Charset preset selector */}
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Character Set</label>
          <div className="grid grid-cols-3 gap-1">
            {Object.keys(CHARSET_PRESETS).filter(k => k !== 'custom').map((preset) => (
              <button
                key={preset}
                onClick={() => handlePresetChange(preset)}
                className={`nodrag px-2 py-1 text-xs rounded transition-colors ${
                  selectedPreset === preset
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Custom charset input */}
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Characters (light → dark)</label>
          <input
            type="text"
            value={charset}
            onChange={(e) => {
              setSelectedPreset('custom');
              handleChange('charset', e.target.value);
            }}
            className="nodrag w-full bg-slate-700 text-white text-xs px-2 py-1.5 rounded border border-slate-600 focus:border-emerald-500 focus:outline-none font-mono"
            placeholder=" .:-=+*#%@"
          />
          <div className="text-xs text-slate-500">
            Preview: {charset.split('').map((c, i) => (
              <span key={i} className="inline-block w-3 text-center">{c === ' ' ? '·' : c}</span>
            ))}
          </div>
        </div>

        {/* Output size */}
        <div className="grid grid-cols-2 gap-2">
          <SliderField
            label="Width"
            value={outputWidth}
            min={20}
            max={200}
            step={10}
            field="outputWidth"
            unit="mm"
            onChange={handleChange}
          />
          <SliderField
            label="Height"
            value={outputHeight}
            min={20}
            max={200}
            step={10}
            field="outputHeight"
            unit="mm"
            onChange={handleChange}
          />
        </div>

        {/* Cell size */}
        <div className="grid grid-cols-2 gap-2">
          <SliderField
            label="Cell Width"
            value={cellWidth}
            min={1}
            max={10}
            step={0.5}
            field="cellWidth"
            unit="mm"
            onChange={handleChange}
          />
          <SliderField
            label="Cell Height"
            value={cellHeight}
            min={1}
            max={15}
            step={0.5}
            field="cellHeight"
            unit="mm"
            onChange={handleChange}
          />
        </div>

        {/* Font size */}
        <SliderField
          label="Font Size"
          value={fontSize}
          min={1}
          max={10}
          step={0.5}
          field="fontSize"
          unit="mm"
          onChange={handleChange}
        />

        {/* Toggles */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Invert</label>
            <button
              onClick={() => handleChange('invert', !invert)}
              className={`nodrag w-8 h-4 rounded-full transition-colors ${
                invert ? 'bg-emerald-500' : 'bg-slate-600'
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full bg-white shadow transform transition-transform ${
                  invert ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Flip X</label>
            <button
              onClick={() => handleChange('flipX', !flipX)}
              className={`nodrag w-8 h-4 rounded-full transition-colors ${
                flipX ? 'bg-emerald-500' : 'bg-slate-600'
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full bg-white shadow transform transition-transform ${
                  flipX ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Flip Y</label>
            <button
              onClick={() => handleChange('flipY', !flipY)}
              className={`nodrag w-8 h-4 rounded-full transition-colors ${
                flipY ? 'bg-emerald-500' : 'bg-slate-600'
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full bg-white shadow transform transition-transform ${
                  flipY ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="source"
        className="w-3 h-3 bg-emerald-500 border-2 border-slate-800"
      />
    </div>
  );
}

export const AsciiNode = memo(AsciiNodeComponent);
