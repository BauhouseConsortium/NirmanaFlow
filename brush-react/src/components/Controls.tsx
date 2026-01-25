interface ControlsProps {
  onGenerate: () => void;
  onUpload: () => void;
  onRun: () => void;
  onUploadAndRun: () => void;
  onStream: () => void;
  onTest: () => void;
  hasGCode: boolean;
  isLoading: boolean;
  isConnected: boolean;
  isStreaming: boolean;
}

export function Controls({
  onGenerate,
  onUpload,
  onRun,
  onUploadAndRun,
  onStream,
  onTest,
  hasGCode,
  isLoading,
  isConnected,
  isStreaming,
}: ControlsProps) {
  return (
    <div className="space-y-3">
      <button
        onClick={onGenerate}
        disabled={isLoading || isStreaming}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700
                   disabled:text-slate-500 text-white font-medium rounded-lg
                   transition-colors"
      >
        Generate G-Code
      </button>

      {/* WebSocket Stream Button - Primary when connected */}
      {isConnected && (
        <button
          onClick={onStream}
          disabled={!hasGCode || isLoading || isStreaming}
          className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-800
                     disabled:text-slate-600 text-white font-medium rounded-lg
                     transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Stream via WebSocket
        </button>
      )}

      {/* HTTP fallback buttons */}
      <div className="space-y-2">
        {!isConnected && (
          <p className="text-xs text-slate-500 text-center">
            Connect to FluidNC for real-time streaming, or use HTTP:
          </p>
        )}
        {isConnected && (
          <p className="text-xs text-slate-500 text-center">
            Or use HTTP fallback:
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onUpload}
            disabled={!hasGCode || isLoading || isStreaming}
            className="py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800
                       disabled:text-slate-600 text-slate-200 text-sm rounded-lg
                       transition-colors"
          >
            Upload
          </button>
          <button
            onClick={onRun}
            disabled={!hasGCode || isLoading || isStreaming}
            className="py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800
                       disabled:text-slate-600 text-slate-200 text-sm rounded-lg
                       transition-colors"
          >
            Run
          </button>
        </div>

        <button
          onClick={onUploadAndRun}
          disabled={!hasGCode || isLoading || isStreaming}
          className="w-full py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800
                     disabled:text-slate-600 text-slate-200 text-sm rounded-lg
                     transition-colors"
        >
          Upload & Run (HTTP)
        </button>
      </div>

      <button
        onClick={onTest}
        disabled={isLoading || isStreaming}
        className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600
                   text-slate-300 text-sm rounded-lg transition-colors"
      >
        Test Connection
      </button>
    </div>
  );
}
