import type { StreamingProgress as StreamingProgressType } from '../hooks/useFluidNC';

interface StreamingProgressProps {
  streaming: StreamingProgressType;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function StreamingProgress({
  streaming,
  onPause,
  onResume,
  onCancel,
}: StreamingProgressProps) {
  const { state, currentLine, totalLines, percentage, currentCommand, elapsedTime, errors } = streaming;

  if (state === 'idle') return null;

  const isStreaming = state === 'streaming';
  const isPaused = state === 'paused';
  const isCompleted = state === 'completed';
  const isError = state === 'error';

  // Estimate remaining time based on progress
  const estimatedTotal = percentage > 5 ? (elapsedTime / percentage) * 100 : 0;
  const estimatedRemaining = Math.max(0, estimatedTotal - elapsedTime);

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              Streaming
            </span>
          )}
          {isPaused && (
            <span className="flex items-center gap-1.5 text-yellow-400">
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              Paused
            </span>
          )}
          {isCompleted && (
            <span className="flex items-center gap-1.5 text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Completed
            </span>
          )}
          {isError && (
            <span className="flex items-center gap-1.5 text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              Error
            </span>
          )}
        </div>

        <div className="text-sm text-slate-400">
          {formatTime(elapsedTime)}
          {isStreaming && estimatedRemaining > 0 && (
            <span className="text-slate-500"> / ~{formatTime(estimatedRemaining)} left</span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Line {currentLine} / {totalLines}</span>
          <span>{percentage}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isCompleted
                ? 'bg-green-500'
                : isPaused
                  ? 'bg-yellow-500'
                  : isError
                    ? 'bg-red-500'
                    : 'bg-blue-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Current Command */}
      <div className="text-xs font-mono text-slate-400 truncate bg-slate-900 rounded px-2 py-1">
        {currentCommand || '...'}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1 max-h-16 overflow-y-auto">
          {errors.slice(-3).map((error, i) => (
            <div key={i}>{error}</div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        {isStreaming && (
          <button
            onClick={onPause}
            className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z" />
            </svg>
            Pause
          </button>
        )}

        {isPaused && (
          <button
            onClick={onResume}
            className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
            Resume
          </button>
        )}

        {(isStreaming || isPaused) && (
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
            Cancel
          </button>
        )}

        {isCompleted && (
          <button
            onClick={onCancel}
            className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
