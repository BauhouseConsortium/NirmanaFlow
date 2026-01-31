import { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';

interface HalftoneNodeData extends Record<string, unknown> {
  label: string;
  mode: 'sine' | 'zigzag' | 'square' | 'triangle';
  lineSpacing: number;
  waveLength: number;
  minAmplitude: number;
  maxAmplitude: number;
  angle: number;
  sampleResolution: number;
  invert: boolean;
  outputWidth: number;
  outputHeight: number;
  color?: 1 | 2 | 3 | 4;
}

// Default colors for the 4 color wells
const COLOR_WELL_COLORS = ['#1e40af', '#dc2626', '#16a34a', '#171717'];

type HalftoneNodeProps = {
  id: string;
  data: HalftoneNodeData;
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
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <label className="text-slate-400">{label}</label>
        <span className="text-slate-300">{value}{unit || ''}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(field, parseFloat(e.target.value))}
        className="nodrag w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
      />
    </div>
  );
}

function HalftoneNodeComponent({ data, id }: HalftoneNodeProps) {
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
    mode = 'sine',
    lineSpacing = 2,
    waveLength = 4,
    minAmplitude = 0.1,
    maxAmplitude = 1.5,
    angle = 0,
    sampleResolution = 100,
    invert = false,
    outputWidth = 100,
    outputHeight = 100,
    color,
  } = data;

  return (
    <div className="bg-slate-800 border-2 border-rose-500 bg-rose-500/10 rounded-lg shadow-lg min-w-[220px]">
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        className="w-3 h-3 bg-rose-500 border-2 border-slate-800"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-rose-400 text-xs font-mono">∿</span>
          <span className="text-sm font-medium text-slate-200">{data.label || 'Halftone'}</span>
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
        {/* Wave mode selector */}
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Wave Mode</label>
          <div className="grid grid-cols-4 gap-1">
            {(['sine', 'zigzag', 'square', 'triangle'] as const).map((m) => (
              <button
                key={m}
                onClick={() => handleChange('mode', m)}
                className={`nodrag px-2 py-1.5 text-xs rounded transition-colors ${
                  mode === m
                    ? 'bg-rose-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {m === 'sine' ? '∿' : m === 'zigzag' ? '⋀⋁' : m === 'square' ? '⊓⊔' : '△▽'}
              </button>
            ))}
          </div>
        </div>

        {/* Output size */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Width</label>
            <input
              type="number"
              value={outputWidth}
              onChange={(e) => handleChange('outputWidth', Math.max(10, parseFloat(e.target.value) || 100))}
              className="nodrag w-full bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-rose-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Height</label>
            <input
              type="number"
              value={outputHeight}
              onChange={(e) => handleChange('outputHeight', Math.max(10, parseFloat(e.target.value) || 100))}
              className="nodrag w-full bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-rose-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Spacing controls */}
        <div className="grid grid-cols-2 gap-2">
          <SliderField
            label="Line Gap"
            value={lineSpacing}
            min={0.5}
            max={10}
            step={0.1}
            field="lineSpacing"
            unit="mm"
            onChange={handleChange}
          />
          <SliderField
            label="Wave Length"
            value={waveLength}
            min={0.5}
            max={20}
            step={0.5}
            field="waveLength"
            unit="mm"
            onChange={handleChange}
          />
        </div>

        {/* Amplitude range */}
        <div className="space-y-2">
          <div className="text-xs text-slate-400">Amplitude Range</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Min (light)</label>
              <input
                type="number"
                value={minAmplitude}
                min={0}
                max={maxAmplitude}
                step={0.05}
                onChange={(e) => handleChange('minAmplitude', parseFloat(e.target.value) || 0)}
                className="nodrag w-full bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Max (dark)</label>
              <input
                type="number"
                value={maxAmplitude}
                min={minAmplitude}
                max={10}
                step={0.05}
                onChange={(e) => handleChange('maxAmplitude', parseFloat(e.target.value) || 1)}
                className="nodrag w-full bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Angle */}
        <SliderField
          label="Angle"
          value={angle}
          min={-90}
          max={90}
          step={5}
          field="angle"
          unit="°"
          onChange={handleChange}
        />

        {/* Sample resolution */}
        <SliderField
          label="Resolution"
          value={sampleResolution}
          min={20}
          max={300}
          step={10}
          field="sampleResolution"
          onChange={handleChange}
        />

        {/* Invert toggle */}
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-400">Invert (dark↔light)</label>
          <button
            onClick={() => handleChange('invert', !invert)}
            className={`nodrag w-10 h-5 rounded-full transition-colors ${
              invert ? 'bg-rose-500' : 'bg-slate-600'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                invert ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="source"
        className="w-3 h-3 bg-rose-500 border-2 border-slate-800"
      />
    </div>
  );
}

export const HalftoneNode = memo(HalftoneNodeComponent);
