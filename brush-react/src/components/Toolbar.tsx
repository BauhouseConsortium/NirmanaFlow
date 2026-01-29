import { memo, useState, useRef, useEffect } from 'react';

interface ToolbarProps {
  onRun: () => void;
  onExportSVG: () => void;
  onExportGCode: () => void;
  onUpload: () => void;
  onStream: () => void;
  hasOutput: boolean;
  isLoading: boolean;
  isConnected: boolean;
  isStreaming: boolean;
  // Machine control callbacks
  onHome?: () => void;
  onUnlock?: () => void;
  onPark?: () => void;
  onPenUp?: () => void;
  onPenDown?: () => void;
  onStop?: () => void;
  onOpenJog?: () => void;
  machineState?: string;
}

interface DropdownProps {
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: 'default' | 'primary';
}

function Dropdown({ label, icon, disabled, children, variant = 'default' }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const baseClasses = variant === 'primary'
    ? 'bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white font-medium'
    : 'bg-slate-700 hover:bg-slate-600 disabled:hover:bg-slate-700 text-slate-200';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm
                   disabled:opacity-50 ${baseClasses}`}
      >
        {icon}
        {label}
        <svg className={`w-3 h-3 ml-0.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[140px] bg-slate-800 border border-slate-600
                       rounded-lg shadow-xl z-50 py-1 overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}

interface DropdownItemProps {
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  variant?: 'default' | 'danger';
}

function DropdownItem({ onClick, disabled, icon, children, variant = 'default' }: DropdownItemProps) {
  const variantClasses = variant === 'danger'
    ? 'text-red-400 hover:bg-red-900/30'
    : 'text-slate-200 hover:bg-slate-700';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${variantClasses}`}
    >
      {icon}
      {children}
    </button>
  );
}

function ToolbarComponent({
  onRun,
  onExportSVG,
  onExportGCode,
  onUpload,
  onStream,
  hasOutput,
  isLoading,
  isConnected,
  isStreaming,
  onHome,
  onUnlock,
  onPark,
  onPenUp,
  onPenDown,
  onStop,
  onOpenJog,
  machineState,
}: ToolbarProps) {
  const isAlarm = machineState === 'Alarm';
  const canControl = isConnected && !isStreaming;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Regenerate G-code button */}
      <button
        onClick={onRun}
        disabled={isLoading}
        title="Regenerate G-code with current settings"
        className="flex items-center justify-center w-8 h-8 bg-slate-700 hover:bg-slate-600
                   disabled:bg-slate-800 disabled:opacity-50 text-white rounded-lg
                   transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      <div className="h-6 w-px bg-slate-700" />

      {/* Tool dropdown - Machine controls */}
      <Dropdown
        label="Tool"
        disabled={!isConnected}
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
      >
        {/* Jog Control */}
        <DropdownItem
          onClick={() => onOpenJog?.()}
          disabled={!isConnected}
          icon={
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          }
        >
          Jog Control...
        </DropdownItem>

        <div className="my-1 border-t border-slate-700" />

        {/* Homing section */}
        <div className="px-2 py-1 text-xs text-slate-500 uppercase tracking-wide">Homing</div>
        <DropdownItem
          onClick={() => onHome?.()}
          disabled={!canControl}
          icon={
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          }
        >
          Home All
        </DropdownItem>
        {isAlarm && (
          <DropdownItem
            onClick={() => onUnlock?.()}
            disabled={!isConnected}
            icon={
              <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            }
          >
            Unlock
          </DropdownItem>
        )}
        <DropdownItem
          onClick={() => onPark?.()}
          disabled={!canControl}
          icon={
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          }
        >
          Park
        </DropdownItem>

        <div className="my-1 border-t border-slate-700" />

        {/* Pen controls */}
        <div className="px-2 py-1 text-xs text-slate-500 uppercase tracking-wide">Pen</div>
        <DropdownItem
          onClick={() => onPenUp?.()}
          disabled={!canControl}
          icon={
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          }
        >
          Pen Up
        </DropdownItem>
        <DropdownItem
          onClick={() => onPenDown?.()}
          disabled={!canControl}
          icon={
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          }
        >
          Pen Down
        </DropdownItem>

        <div className="my-1 border-t border-slate-700" />

        {/* Emergency stop */}
        <DropdownItem
          onClick={() => onStop?.()}
          disabled={!isConnected}
          variant="danger"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
          }
        >
          Emergency Stop
        </DropdownItem>
      </Dropdown>

      <div className="h-6 w-px bg-slate-700" />

      {/* Export dropdown */}
      <Dropdown
        label="Export"
        disabled={!hasOutput}
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        }
      >
        <DropdownItem
          onClick={onExportSVG}
          disabled={!hasOutput}
          icon={
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        >
          SVG Image
        </DropdownItem>
        <DropdownItem
          onClick={onExportGCode}
          disabled={!hasOutput}
          icon={
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          }
        >
          G-Code File
        </DropdownItem>
      </Dropdown>

      {/* Print dropdown */}
      <Dropdown
        label={isStreaming ? 'Printing...' : 'Print'}
        disabled={!hasOutput}
        variant="primary"
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
        }
      >
        <DropdownItem
          onClick={onUpload}
          disabled={!hasOutput}
          icon={
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          }
        >
          Upload to SD
        </DropdownItem>
        <DropdownItem
          onClick={onStream}
          disabled={!hasOutput || !isConnected || isStreaming}
          icon={
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        >
          {isStreaming ? 'Printing...' : 'Print Now'}
        </DropdownItem>
      </Dropdown>
    </div>
  );
}

// Memoize to prevent re-renders when parent state changes
export const Toolbar = memo(ToolbarComponent);
