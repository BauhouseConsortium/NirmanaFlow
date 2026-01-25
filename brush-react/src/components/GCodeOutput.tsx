import type { GeneratedGCode } from '../types';

interface GCodeOutputProps {
  result: GeneratedGCode | null;
  onDownload: () => void;
  onCopy: () => void;
}

export function GCodeOutput({ result, onDownload, onCopy }: GCodeOutputProps) {
  if (!result || !result.gcode) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-sm">
        Generate G-code to see output
      </div>
    );
  }

  const { gcode, stats } = result;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-300">G-Code Output</h3>
        <div className="flex gap-2">
          <button
            onClick={onCopy}
            className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600
                       text-slate-300 rounded transition-colors"
          >
            Copy
          </button>
          <button
            onClick={onDownload}
            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500
                       text-white rounded transition-colors"
          >
            Download
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
        <div className="bg-slate-800/50 rounded px-2 py-1.5">
          <div className="text-slate-500">Paths</div>
          <div className="text-white font-mono">{stats.pathCount}</div>
        </div>
        <div className="bg-slate-800/50 rounded px-2 py-1.5">
          <div className="text-slate-500">Scale</div>
          <div className="text-white font-mono">{stats.scale.toFixed(2)}x</div>
        </div>
        <div className="bg-slate-800/50 rounded px-2 py-1.5">
          <div className="text-slate-500">Dips</div>
          <div className="text-white font-mono">{stats.dipCount}</div>
        </div>
        <div className="bg-slate-800/50 rounded px-2 py-1.5">
          <div className="text-slate-500">Cleaned</div>
          <div className="text-white font-mono">{stats.artefactsRemoved}</div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <textarea
          readOnly
          value={gcode}
          className="w-full h-full px-3 py-2 bg-slate-900 border border-slate-700
                     rounded-lg text-green-400 text-xs font-mono resize-none
                     focus:outline-none"
        />
      </div>
    </div>
  );
}
