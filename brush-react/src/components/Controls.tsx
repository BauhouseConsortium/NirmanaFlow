interface ControlsProps {
  onGenerate: () => void;
  onUpload: () => void;
  onRun: () => void;
  onUploadAndRun: () => void;
  onTest: () => void;
  hasGCode: boolean;
  isLoading: boolean;
}

export function Controls({
  onGenerate,
  onUpload,
  onRun,
  onUploadAndRun,
  onTest,
  hasGCode,
  isLoading,
}: ControlsProps) {
  return (
    <div className="space-y-3">
      <button
        onClick={onGenerate}
        disabled={isLoading}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700
                   disabled:text-slate-500 text-white font-medium rounded-lg
                   transition-colors"
      >
        Generate G-Code
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onUpload}
          disabled={!hasGCode || isLoading}
          className="py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800
                     disabled:text-slate-600 text-slate-200 text-sm rounded-lg
                     transition-colors"
        >
          Upload
        </button>
        <button
          onClick={onRun}
          disabled={!hasGCode || isLoading}
          className="py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800
                     disabled:text-slate-600 text-slate-200 text-sm rounded-lg
                     transition-colors"
        >
          Run
        </button>
      </div>

      <button
        onClick={onUploadAndRun}
        disabled={!hasGCode || isLoading}
        className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-slate-800
                   disabled:text-slate-600 text-white font-medium rounded-lg
                   transition-colors"
      >
        Upload & Run
      </button>

      <button
        onClick={onTest}
        disabled={isLoading}
        className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600
                   text-slate-300 text-sm rounded-lg transition-colors"
      >
        Test Connection
      </button>
    </div>
  );
}
