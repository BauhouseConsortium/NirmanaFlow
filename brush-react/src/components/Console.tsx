import { useRef, useEffect, memo } from 'react';
import type { LogEntry } from '../hooks/useConsole';

interface ConsoleProps {
  logs: LogEntry[];
  onClear: () => void;
}

const typeStyles: Record<LogEntry['type'], string> = {
  info: 'text-slate-400',
  success: 'text-green-400',
  error: 'text-red-400',
  warning: 'text-yellow-400',
};

function ConsoleComponent({ logs, onClear }: ConsoleProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-300">Console</h3>
        <button
          onClick={onClear}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Clear
        </button>
      </div>
      <div
        ref={containerRef}
        className="flex-1 min-h-0 bg-slate-900 rounded-lg p-3 overflow-auto
                   font-mono text-xs space-y-1"
      >
        {logs.length === 0 ? (
          <div className="text-slate-600">Console output will appear here...</div>
        ) : (
          logs.map(log => (
            <div key={log.id} className={typeStyles[log.type]}>
              <span className="text-slate-600">
                [{log.timestamp.toLocaleTimeString()}]
              </span>{' '}
              {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Memoize to prevent re-renders when unrelated parent state changes
export const Console = memo(ConsoleComponent);
