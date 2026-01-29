import { useState, useRef, useEffect } from 'react';
import type { VectorSettings } from '../hooks/useVectorSettings';
import { getColorWells } from '../hooks/useVectorSettings';

interface VectorSettingsPanelProps {
  settings: VectorSettings;
  onUpdate: <K extends keyof VectorSettings>(key: K, value: VectorSettings[K]) => void;
  onReset: () => void;
  onLoad: (settings: Partial<VectorSettings>) => void;
  onSetColorWellPosition?: (colorIndex: 1 | 2 | 3 | 4) => void;
  onJogToPosition?: (x: number, y: number) => void;
  isConnected?: boolean;
}

type SectionId = 'canvas' | 'output' | 'machine' | 'ink' | 'palette' | 'hardware';

// Text input with local state to prevent focus loss during typing
function TextInput({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [localValue, setLocalValue] = useState(value);
  const isFocusedRef = useRef(false);

  // Sync local value when prop changes, but only when not focused
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(value);
    }
  }, [value]);

  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-xs text-slate-400">{label}</label>
      <input
        type="text"
        value={localValue}
        onChange={e => {
          setLocalValue(e.target.value);
          onChange(e.target.value);
        }}
        onFocus={() => { isFocusedRef.current = true; }}
        onBlur={() => {
          isFocusedRef.current = false;
          setLocalValue(value); // Sync back to prop value on blur
        }}
        className={className || "flex-1 px-2 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-white"}
      />
    </div>
  );
}

// Moved outside to prevent re-creation on every render
// Uses local state to prevent focus loss during typing
function NumberInput({
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
}) {
  const [localValue, setLocalValue] = useState(String(value));
  const isFocusedRef = useRef(false);

  // Sync local value when prop changes, but only when not focused
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(String(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    const num = Number(newValue);
    if (!isNaN(num) && newValue !== '') {
      onChange(num);
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    // On blur, ensure we have a valid value
    const num = Number(localValue);
    if (isNaN(num) || localValue === '') {
      setLocalValue(String(value));
    }
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-xs text-slate-400">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={localValue}
          onChange={handleChange}
          onFocus={() => { isFocusedRef.current = true; }}
          onBlur={handleBlur}
          min={min}
          max={max}
          step={step}
          className="w-20 px-2 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-white text-right"
        />
        {unit && <span className="text-xs text-slate-500 w-8">{unit}</span>}
      </div>
    </div>
  );
}

// Collapsible section component - moved outside
function CollapsibleSection({
  id,
  title,
  expandedSection,
  onToggle,
  children,
}: {
  id: SectionId;
  title: string;
  expandedSection: SectionId | null;
  onToggle: (id: SectionId) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-700 last:border-b-0">
      <button
        onClick={() => onToggle(id)}
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
}

export function VectorSettingsPanel({ settings, onUpdate, onReset, onLoad, onSetColorWellPosition, onJogToPosition, isConnected }: VectorSettingsPanelProps) {
  const colorWells = getColorWells(settings);
  const [expandedSection, setExpandedSection] = useState<SectionId | null>('canvas');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nirmana-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const loadedSettings = JSON.parse(content) as Partial<VectorSettings>;
        onLoad(loadedSettings);
      } catch (err) {
        alert('Failed to load settings: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const toggle = (section: SectionId) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">Settings</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-slate-500 hover:text-slate-300"
            title="Load settings from file"
          >
            Load
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleLoadFile}
            className="hidden"
          />
          <button
            onClick={handleSave}
            className="text-xs text-slate-500 hover:text-slate-300"
            title="Save settings to file"
          >
            Save
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={onReset}
            className="text-xs text-slate-500 hover:text-slate-300"
            title="Reset to defaults"
          >
            Reset
          </button>
        </div>
      </div>

      <CollapsibleSection id="canvas" title="Canvas" expandedSection={expandedSection} onToggle={toggle}>
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
      </CollapsibleSection>

      <CollapsibleSection id="output" title="Output" expandedSection={expandedSection} onToggle={toggle}>
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
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-400">Clip to Work Area</label>
          <input
            type="checkbox"
            checked={settings.clipToWorkArea}
            onChange={e => onUpdate('clipToWorkArea', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs text-slate-400">Default Ink Color</label>
          <div className="flex items-center justify-center gap-3 py-2 px-3 bg-slate-900/50 rounded-lg">
            {colorWells.map((well) => {
              const isSelected = settings.mainColor === well.id;
              return (
                <button
                  key={well.id}
                  onClick={() => onUpdate('mainColor', well.id)}
                  className={`relative group transition-all duration-200 ${
                    isSelected ? 'scale-110' : 'hover:scale-105'
                  }`}
                  title={`Ink well ${well.id}`}
                >
                  {/* Glow effect */}
                  {isSelected && (
                    <div
                      className="absolute inset-0 rounded-full blur-md opacity-60"
                      style={{ backgroundColor: well.color }}
                    />
                  )}
                  {/* Outer ring */}
                  <div
                    className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isSelected
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: well.color }}
                  >
                    {/* Ink drop icon */}
                    <svg
                      className={`w-4 h-4 transition-all ${
                        isSelected ? 'text-white' : 'text-white/70'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2c-5.33 8.33-8 12.67-8 16a8 8 0 1 0 16 0c0-3.33-2.67-7.67-8-16z" />
                    </svg>
                  </div>
                  {/* Number badge */}
                  <span
                    className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-white text-slate-900'
                        : 'bg-slate-700 text-slate-300 group-hover:bg-slate-600'
                    }`}
                  >
                    {well.id}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="machine" title="Machine" expandedSection={expandedSection} onToggle={toggle}>
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
      </CollapsibleSection>

      <CollapsibleSection id="ink" title="Ink" expandedSection={expandedSection} onToggle={toggle}>
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
      </CollapsibleSection>

      <CollapsibleSection id="palette" title="Color Palette" expandedSection={expandedSection} onToggle={toggle}>
        <div className="rounded-lg border border-slate-700/50 overflow-hidden">
            {colorWells.map((well, index) => (
              <div
                key={well.id}
                className={`flex items-center gap-3 py-2 px-3 ${
                  index !== colorWells.length - 1 ? 'border-b border-slate-700/30' : ''
                } hover:bg-slate-800/30 transition-colors`}
              >
                {/* Color indicator */}
                <div className="relative">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold text-white shadow-sm"
                    style={{ backgroundColor: well.color }}
                  >
                    {well.id}
                  </div>
                  {/* Color picker overlay */}
                  <input
                    type="color"
                    value={well.color}
                    onChange={e => onUpdate(`colorWell${well.id}Color` as keyof VectorSettings, e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    title="Change color"
                  />
                </div>

                {/* Coordinates */}
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">x</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={well.x}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) onUpdate(`colorWell${well.id}X` as keyof VectorSettings, val);
                    }}
                    className="w-10 px-1 py-0.5 text-xs bg-slate-800/60 border border-slate-700/50 rounded text-white text-center focus:border-slate-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide ml-1">y</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={well.y}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) onUpdate(`colorWell${well.id}Y` as keyof VectorSettings, val);
                    }}
                    className="w-10 px-1 py-0.5 text-xs bg-slate-800/60 border border-slate-700/50 rounded text-white text-center focus:border-slate-500 focus:outline-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => onSetColorWellPosition?.(well.id)}
                    className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-slate-700/50 transition-colors"
                    title="Pick on preview"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onJogToPosition?.(well.x, well.y)}
                    disabled={!isConnected}
                    className={`p-1.5 rounded transition-colors ${
                      isConnected
                        ? 'text-slate-500 hover:text-green-400 hover:bg-green-500/10'
                        : 'text-slate-700 cursor-not-allowed'
                    }`}
                    title={isConnected ? "Jog to position" : "Connect first"}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
      </CollapsibleSection>

      <CollapsibleSection id="hardware" title="Hardware" expandedSection={expandedSection} onToggle={toggle}>
        <TextInput
          label="Controller"
          value={settings.controllerHost}
          onChange={v => onUpdate('controllerHost', v)}
        />
      </CollapsibleSection>
    </div>
  );
}
