import { useState, useRef } from 'react';
import type { VectorSettings } from '../hooks/useVectorSettings';
import { getColorWells } from '../hooks/useVectorSettings';

interface VectorSettingsPanelProps {
  settings: VectorSettings;
  onUpdate: <K extends keyof VectorSettings>(key: K, value: VectorSettings[K]) => void;
  onReset: () => void;
  onLoad: (settings: Partial<VectorSettings>) => void;
  onSetColorWellPosition?: (colorIndex: 1 | 2 | 3 | 4) => void;
}

type Section = 'canvas' | 'output' | 'machine' | 'ink' | 'palette' | 'hardware';

export function VectorSettingsPanel({ settings, onUpdate, onReset, onSetColorWellPosition }: VectorSettingsPanelProps) {
  const colorWells = getColorWells(settings);
  const [expandedSection, setExpandedSection] = useState<Section | null>('canvas');

  const toggle = (section: Section) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const Section = ({ id, title, children }: { id: Section; title: string; children: React.ReactNode }) => (
    <div className="border-b border-slate-700 last:border-b-0">
      <button
        onClick={() => toggle(id)}
        className="w-full px-3 py-2 flex items-center justify-between text-sm text-slate-300 hover:bg-slate-700/50"
      >
        {title}
        <svg
          className={`w-4 h-4 transition-transform ${expandedSection === id ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expandedSection === id && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );

  const NumberInput = ({
    label,
    value,
    onChange,
    min,
    max,
    step = 1,
    unit,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
  }) => (
    <div className="flex items-center justify-between gap-2">
      <label className="text-xs text-slate-400">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="w-20 px-2 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-white text-right"
        />
        {unit && <span className="text-xs text-slate-500 w-8">{unit}</span>}
      </div>
    </div>
  );

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">Settings</h3>
        <button
          onClick={onReset}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          Reset
        </button>
      </div>

      <Section id="canvas" title="Canvas">
        <NumberInput
          label="Width"
          value={settings.canvasWidth}
          onChange={v => onUpdate('canvasWidth', v)}
          min={10}
          max={500}
          unit="px"
        />
        <NumberInput
          label="Height"
          value={settings.canvasHeight}
          onChange={v => onUpdate('canvasHeight', v)}
          min={10}
          max={500}
          unit="px"
        />
      </Section>

      <Section id="output" title="Output">
        <NumberInput
          label="Target Width"
          value={settings.targetWidth}
          onChange={v => onUpdate('targetWidth', v)}
          min={10}
          max={200}
          unit="mm"
        />
        <NumberInput
          label="Target Height"
          value={settings.targetHeight}
          onChange={v => onUpdate('targetHeight', v)}
          min={10}
          max={200}
          unit="mm"
        />
        <NumberInput
          label="Offset X"
          value={settings.offsetX}
          onChange={v => onUpdate('offsetX', v)}
          min={0}
          max={50}
          unit="mm"
        />
        <NumberInput
          label="Offset Y"
          value={settings.offsetY}
          onChange={v => onUpdate('offsetY', v)}
          min={0}
          max={100}
          unit="mm"
        />
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Ink Well</label>
          <div className="flex gap-1">
            {colorWells.map((well) => (
              <button
                key={well.id}
                onClick={() => onUpdate('mainColor', well.id)}
                className={`flex-1 py-2 rounded-lg border-2 transition-all ${
                  settings.mainColor === well.id
                    ? 'border-white scale-105'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: well.color }}
                title={`Ink well ${well.id}`}
              >
                <span className="text-white text-xs font-bold drop-shadow-md">{well.id}</span>
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section id="machine" title="Machine">
        <NumberInput
          label="Feed Rate"
          value={settings.feedRate}
          onChange={v => onUpdate('feedRate', v)}
          min={100}
          max={5000}
          step={100}
          unit="mm/m"
        />
        <NumberInput
          label="Safe Z"
          value={settings.safeZ}
          onChange={v => onUpdate('safeZ', v)}
          min={1}
          max={20}
          unit="mm"
        />
        <NumberInput
          label="Backlash X"
          value={settings.backlashX}
          onChange={v => onUpdate('backlashX', v)}
          min={0}
          max={2}
          step={0.1}
          unit="mm"
        />
        <NumberInput
          label="Backlash Y"
          value={settings.backlashY}
          onChange={v => onUpdate('backlashY', v)}
          min={0}
          max={2}
          step={0.1}
          unit="mm"
        />
        <NumberInput
          label="Artefact Filter"
          value={settings.artefactThreshold}
          onChange={v => onUpdate('artefactThreshold', v)}
          min={0}
          max={1}
          step={0.01}
          unit="mm"
        />
      </Section>

      <Section id="ink" title="Ink">
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-400">Continuous Plot</label>
          <input
            type="checkbox"
            checked={settings.continuousPlot}
            onChange={e => onUpdate('continuousPlot', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500"
          />
        </div>
        {!settings.continuousPlot && (
          <>
            <NumberInput
              label="Dip Interval"
              value={settings.dipInterval}
              onChange={v => onUpdate('dipInterval', v)}
              min={10}
              max={200}
              unit="mm"
            />
            <NumberInput
              label="Dip X"
              value={settings.dipX}
              onChange={v => onUpdate('dipX', v)}
              min={0}
              max={150}
              unit="mm"
            />
            <NumberInput
              label="Dip Y"
              value={settings.dipY}
              onChange={v => onUpdate('dipY', v)}
              min={0}
              max={150}
              unit="mm"
            />
          </>
        )}
      </Section>

      <Section id="palette" title="Color Palette">
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-400">Multi-Color Mode</label>
          <input
            type="checkbox"
            checked={settings.colorPaletteEnabled}
            onChange={e => onUpdate('colorPaletteEnabled', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500"
          />
        </div>
        {settings.colorPaletteEnabled && (
          <div className="space-y-3 mt-2">
            {colorWells.map((well) => (
              <div key={well.id} className="bg-slate-900/50 rounded-lg p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white/30"
                    style={{ backgroundColor: well.color }}
                  />
                  <span className="text-xs text-slate-300 font-medium">Color {well.id}</span>
                  <input
                    type="color"
                    value={well.color}
                    onChange={e => onUpdate(`colorWell${well.id}Color` as keyof VectorSettings, e.target.value)}
                    className="ml-auto w-6 h-6 rounded cursor-pointer bg-transparent"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-xs text-slate-500">X:</span>
                    <input
                      type="number"
                      value={well.x}
                      onChange={e => onUpdate(`colorWell${well.id}X` as keyof VectorSettings, Number(e.target.value))}
                      className="w-14 px-1 py-0.5 text-xs bg-slate-800 border border-slate-600 rounded text-white text-right"
                    />
                  </div>
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-xs text-slate-500">Y:</span>
                    <input
                      type="number"
                      value={well.y}
                      onChange={e => onUpdate(`colorWell${well.id}Y` as keyof VectorSettings, Number(e.target.value))}
                      className="w-14 px-1 py-0.5 text-xs bg-slate-800 border border-slate-600 rounded text-white text-right"
                    />
                  </div>
                  <button
                    onClick={() => onSetColorWellPosition?.(well.id)}
                    className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded flex items-center gap-1"
                    title="Click to set position on canvas"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Set
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section id="hardware" title="Hardware">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs text-slate-400">Controller</label>
          <input
            type="text"
            value={settings.controllerHost}
            onChange={e => onUpdate('controllerHost', e.target.value)}
            className="flex-1 px-2 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-white"
          />
        </div>
      </Section>
    </div>
  );
}
