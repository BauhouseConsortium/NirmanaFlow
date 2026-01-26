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
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Run button */}
      <button
        onClick={onRun}
        disabled={isLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500
                   disabled:bg-green-800 disabled:opacity-50 text-white rounded-lg
                   transition-colors text-sm font-medium"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
        </svg>
        Run
      </button>

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
