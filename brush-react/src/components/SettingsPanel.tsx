import { useState } from 'react';
import type { Settings } from '../types';

interface SettingsPanelProps {
  settings: Settings;
  onUpdate: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onReset: () => void;
}

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

function NumberInput({ label, value, onChange, min, max, step = 1, unit }: NumberInputProps) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">
        {label} {unit && <span className="text-slate-500">({unit})</span>}
      </label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md
                   text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, children, defaultOpen = false }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-slate-800/50 flex items-center justify-between
                   text-left hover:bg-slate-800 transition-colors"
      >
        <span className="text-sm font-medium text-slate-200">{title}</span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

export function SettingsPanel({ settings, onUpdate, onReset }: SettingsPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">Settings</h3>
        <button
          onClick={onReset}
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          Reset to Defaults
        </button>
      </div>

      <Section title="Layout" defaultOpen>
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="Target Width"
            value={settings.targetWidth}
            onChange={v => onUpdate('targetWidth', v)}
            min={10}
            max={500}
            unit="mm"
          />
          <NumberInput
            label="Kerning"
            value={settings.kerning}
            onChange={v => onUpdate('kerning', v)}
            step={0.01}
            unit="units"
          />
          <NumberInput
            label="Offset X"
            value={settings.offsetX}
            onChange={v => onUpdate('offsetX', v)}
            unit="mm"
          />
          <NumberInput
            label="Offset Y"
            value={settings.offsetY}
            onChange={v => onUpdate('offsetY', v)}
            unit="mm"
          />
        </div>
      </Section>

      <Section title="Machine">
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="Feed Rate"
            value={settings.feedRate}
            onChange={v => onUpdate('feedRate', v)}
            min={100}
            max={10000}
            unit="mm/min"
          />
          <NumberInput
            label="Safe Z"
            value={settings.safeZ}
            onChange={v => onUpdate('safeZ', v)}
            min={1}
            max={50}
            unit="mm"
          />
          <NumberInput
            label="Backlash X"
            value={settings.backlashX}
            onChange={v => onUpdate('backlashX', v)}
            min={0}
            max={5}
            step={0.1}
            unit="mm"
          />
          <NumberInput
            label="Backlash Y"
            value={settings.backlashY}
            onChange={v => onUpdate('backlashY', v)}
            min={0}
            max={5}
            step={0.1}
            unit="mm"
          />
        </div>
      </Section>

      <Section title="Ink Dipping">
        <div className="mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.continuousPlot}
              onChange={e => onUpdate('continuousPlot', e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800
                         text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
            />
            <span className="text-sm text-slate-300">Continuous Plot (no dipping)</span>
          </label>
        </div>
        {!settings.continuousPlot && (
          <div className="grid grid-cols-3 gap-3">
            <NumberInput
              label="Dip Interval"
              value={settings.dipInterval}
              onChange={v => onUpdate('dipInterval', v)}
              min={10}
              max={500}
              unit="mm"
            />
            <NumberInput
              label="Dip X"
              value={settings.dipX}
              onChange={v => onUpdate('dipX', v)}
              unit="mm"
            />
            <NumberInput
              label="Dip Y"
              value={settings.dipY}
              onChange={v => onUpdate('dipY', v)}
              unit="mm"
            />
          </div>
        )}
      </Section>

      <Section title="Filtering">
        <NumberInput
          label="Artefact Threshold"
          value={settings.artefactThreshold}
          onChange={v => onUpdate('artefactThreshold', v)}
          min={0}
          max={1}
          step={0.01}
          unit="mm"
        />
      </Section>

      <Section title="Path Optimization (Clipper2)">
        <div className="mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.optimizePaths}
              onChange={e => onUpdate('optimizePaths', e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800
                         text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
            />
            <span className="text-sm text-slate-300">Enable Path Optimization</span>
          </label>
          <p className="text-xs text-slate-500 mt-1 ml-6">
            Uses Clipper2 WASM for boolean operations
          </p>
        </div>
        {settings.optimizePaths && (
          <>
            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.mergeOverlapping}
                  onChange={e => onUpdate('mergeOverlapping', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800
                             text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                />
                <span className="text-sm text-slate-300">Merge Overlapping Paths</span>
              </label>
              <p className="text-xs text-slate-500 mt-1 ml-6">
                Union closed paths that overlap
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="Simplify Tolerance"
                value={settings.simplifyTolerance}
                onChange={v => onUpdate('simplifyTolerance', v)}
                min={0}
                max={2}
                step={0.01}
                unit="mm"
              />
              <NumberInput
                label="Min Segment Length"
                value={settings.minSegmentLength}
                onChange={v => onUpdate('minSegmentLength', v)}
                min={0}
                max={5}
                step={0.1}
                unit="mm"
              />
            </div>
          </>
        )}
      </Section>

      <Section title="Hardware">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Controller Host</label>
          <input
            type="text"
            value={settings.controllerHost}
            onChange={e => onUpdate('controllerHost', e.target.value)}
            placeholder="http://192.168.1.100"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md
                       text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500
                       font-mono"
          />
        </div>
      </Section>
    </div>
  );
}
