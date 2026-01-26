import { memo } from 'react';

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

      {/* Export SVG */}
      <button
        onClick={onExportSVG}
        disabled={!hasOutput}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600
                   disabled:opacity-50 disabled:hover:bg-slate-700 text-slate-200
                   rounded-lg transition-colors text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        SVG
      </button>

      {/* Export G-code */}
      <button
        onClick={onExportGCode}
        disabled={!hasOutput}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600
                   disabled:opacity-50 disabled:hover:bg-slate-700 text-slate-200
                   rounded-lg transition-colors text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        G-Code
      </button>

      {/* Upload to plotter (HTTP) */}
      <button
        onClick={onUpload}
        disabled={!hasOutput}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600
                   disabled:opacity-50 disabled:hover:bg-slate-700 text-slate-200
                   rounded-lg transition-colors text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        Upload
      </button>

      {/* Stream via WebSocket */}
      <button
        onClick={onStream}
        disabled={!hasOutput || !isConnected || isStreaming}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500
                   disabled:bg-purple-800 disabled:opacity-50 text-white rounded-lg
                   transition-colors text-sm font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        {isStreaming ? 'Streaming...' : 'Stream'}
      </button>
    </div>
  );
}

// Memoize to prevent re-renders when parent state changes
export const Toolbar = memo(ToolbarComponent);
