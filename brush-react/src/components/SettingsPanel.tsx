import { useState } from 'react';
import type { Settings, MachineProfile } from '../types';

interface ProfileWithBuiltIn extends MachineProfile {
  isBuiltIn: boolean;
}

interface SettingsPanelProps {
  settings: Settings;
  onUpdate: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onReset: () => void;
  // Profile management
  profiles?: ProfileWithBuiltIn[];
  activeProfileId?: string | null;
  onLoadProfile?: (id: string) => void;
  onSaveAsProfile?: (name: string) => string;
  onUpdateProfile?: (id: string) => void;
  onDeleteProfile?: (id: string) => void;
  onRenameProfile?: (id: string, name: string) => void;
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

interface ProfileSelectorProps {
  profiles: ProfileWithBuiltIn[];
  activeProfileId: string | null;
  onLoadProfile: (id: string) => void;
  onSaveAsProfile: (name: string) => string;
  onUpdateProfile: (id: string) => void;
  onDeleteProfile: (id: string) => void;
  onRenameProfile: (id: string, name: string) => void;
}

function ProfileSelector({
  profiles,
  activeProfileId,
  onLoadProfile,
  onSaveAsProfile,
  onUpdateProfile,
  onDeleteProfile,
  onRenameProfile,
}: ProfileSelectorProps) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const activeProfile = profiles.find(p => p.id === activeProfileId);
  const isModified = activeProfileId === null;
  const canUpdate = activeProfile && !activeProfile.isBuiltIn && !isModified;

  const handleSave = () => {
    if (newProfileName.trim()) {
      onSaveAsProfile(newProfileName.trim());
      setNewProfileName('');
      setShowSaveModal(false);
    }
  };

  const handleRename = (id: string) => {
    if (editingName.trim()) {
      onRenameProfile(id, editingName.trim());
      setEditingId(null);
      setEditingName('');
    }
  };

  return (
    <div className="space-y-3">
      {/* Profile Dropdown */}
      <div>
        <label className="block text-xs text-slate-400 mb-1">Machine Profile</label>
        <div className="flex gap-2">
          <select
            value={activeProfileId || ''}
            onChange={e => onLoadProfile(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-md
                       text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {isModified && (
              <option value="" disabled>
                (Modified)
              </option>
            )}
            <optgroup label="Built-in Presets">
              {profiles
                .filter(p => p.isBuiltIn)
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </optgroup>
            {profiles.filter(p => !p.isBuiltIn).length > 0 && (
              <optgroup label="Custom Profiles">
                {profiles
                  .filter(p => !p.isBuiltIn)
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      {/* Status indicator */}
      {isModified && (
        <div className="flex items-center gap-2 text-xs text-amber-400">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>Settings modified - save as new profile to keep changes</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setShowSaveModal(true)}
          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-md
                     transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Save As New
        </button>

        {canUpdate && (
          <button
            onClick={() => onUpdateProfile(activeProfileId!)}
            className="px-3 py-1.5 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded-md
                       transition-colors"
          >
            Update Profile
          </button>
        )}

        {activeProfile && !activeProfile.isBuiltIn && (
          <>
            <button
              onClick={() => {
                setEditingId(activeProfileId);
                setEditingName(activeProfile.name);
              }}
              className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-md
                         transition-colors"
            >
              Rename
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete profile "${activeProfile.name}"?`)) {
                  onDeleteProfile(activeProfileId!);
                }
              }}
              className="px-3 py-1.5 text-xs bg-red-600/80 hover:bg-red-500 text-white rounded-md
                         transition-colors"
            >
              Delete
            </button>
          </>
        )}
      </div>

      {/* Rename Modal */}
      {editingId && (
        <div className="p-3 bg-slate-800 border border-slate-600 rounded-lg space-y-2">
          <label className="block text-xs text-slate-400">Rename Profile</label>
          <input
            type="text"
            value={editingName}
            onChange={e => setEditingName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRename(editingId)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md
                       text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setEditingId(null)}
              className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={() => handleRename(editingId)}
              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-md"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="p-3 bg-slate-800 border border-slate-600 rounded-lg space-y-2">
          <label className="block text-xs text-slate-400">New Profile Name</label>
          <input
            type="text"
            value={newProfileName}
            onChange={e => setNewProfileName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="My Custom Machine"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md
                       text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowSaveModal(false)}
              className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!newProfileName.trim()}
              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-md
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Profile
            </button>
          </div>
        </div>
      )}

      {/* Auto-save indicator */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        <span>Settings auto-saved to browser</span>
      </div>
    </div>
  );
}

export function SettingsPanel({
  settings,
  onUpdate,
  onReset,
  profiles,
  activeProfileId,
  onLoadProfile,
  onSaveAsProfile,
  onUpdateProfile,
  onDeleteProfile,
  onRenameProfile,
}: SettingsPanelProps) {
  const hasProfileSupport =
    profiles &&
    onLoadProfile &&
    onSaveAsProfile &&
    onUpdateProfile &&
    onDeleteProfile &&
    onRenameProfile;

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

      {/* Machine Profile Selector */}
      {hasProfileSupport && (
        <Section title="Machine Profiles" defaultOpen>
          <ProfileSelector
            profiles={profiles}
            activeProfileId={activeProfileId ?? null}
            onLoadProfile={onLoadProfile}
            onSaveAsProfile={onSaveAsProfile}
            onUpdateProfile={onUpdateProfile}
            onDeleteProfile={onDeleteProfile}
            onRenameProfile={onRenameProfile}
          />
        </Section>
      )}

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
