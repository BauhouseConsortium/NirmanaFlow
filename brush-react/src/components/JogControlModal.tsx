import { useState, useEffect, useCallback } from 'react';
import type { MachinePosition, MachineState } from '../hooks/useFluidNC';

interface JogControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
  machineState: MachineState;
  position: MachinePosition;
  onJog: (axis: 'X' | 'Y' | 'Z', distance: number, feedRate?: number) => void;
  onHome: () => void;
  onUnlock: () => void;
  onSetZero: () => void;
  onGoToZero: () => void;
  onStop: () => void;
}

const STEP_SIZES = [0.1, 1, 10, 50, 100];

const machineStateColors: Record<MachineState, string> = {
  Idle: 'text-green-400',
  Run: 'text-blue-400',
  Hold: 'text-yellow-400',
  Alarm: 'text-red-400',
  Check: 'text-purple-400',
  Home: 'text-cyan-400',
  Sleep: 'text-slate-400',
  Unknown: 'text-slate-500',
};

export function JogControlModal({
  isOpen,
  onClose,
  isConnected,
  machineState,
  position,
  onJog,
  onHome,
  onUnlock,
  onSetZero,
  onGoToZero,
  onStop,
}: JogControlModalProps) {
  const [stepSize, setStepSize] = useState(10);
  const [feedRate, setFeedRate] = useState(1000);

  const isIdle = machineState === 'Idle';
  const isAlarm = machineState === 'Alarm';
  const isRunning = machineState === 'Run' || machineState === 'Hold' || machineState === 'Home';
  const canJog = isConnected && !isRunning && !isAlarm;

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if typing in an input
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (canJog) onJog('Y', stepSize, feedRate);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (canJog) onJog('Y', -stepSize, feedRate);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (canJog) onJog('X', -stepSize, feedRate);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (canJog) onJog('X', stepSize, feedRate);
          break;
        case 'PageUp':
          e.preventDefault();
          if (canJog) onJog('Z', stepSize, feedRate);
          break;
        case 'PageDown':
          e.preventDefault();
          if (canJog) onJog('Z', -stepSize, feedRate);
          break;
        case 'Escape':
          onClose();
          break;
        case ' ':
          e.preventDefault();
          onStop();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, canJog, stepSize, feedRate, onJog, onStop, onClose]);

  const handleJog = useCallback((axis: 'X' | 'Y' | 'Z', direction: 1 | -1) => {
    onJog(axis, stepSize * direction, feedRate);
  }, [onJog, stepSize, feedRate]);

  if (!isOpen) return null;

  const JogButton = ({
    axis,
    direction,
    label,
    className = '',
  }: {
    axis: 'X' | 'Y' | 'Z';
    direction: 1 | -1;
    label: string;
    className?: string;
  }) => (
    <button
      onClick={() => handleJog(axis, direction)}
      disabled={!canJog}
      className={`
        w-14 h-14 flex items-center justify-center rounded-lg
        text-white font-bold text-sm transition-all
        ${canJog
          ? 'bg-slate-700 hover:bg-slate-600 active:bg-slate-500 active:scale-95'
          : 'bg-slate-800 text-slate-600 cursor-not-allowed'
        }
        ${className}
      `}
      title={`${axis}${direction > 0 ? '+' : '-'}${stepSize}mm`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            <h2 className="text-lg font-semibold text-slate-100">Jog Control</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Status bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-slate-400">
                {isConnected ? (
                  <>State: <span className={machineStateColors[machineState]}>{machineState}</span></>
                ) : (
                  'Disconnected'
                )}
              </span>
            </div>
            {isAlarm && (
              <button
                onClick={onUnlock}
                disabled={!isConnected}
                className="px-3 py-1 text-xs bg-yellow-600 hover:bg-yellow-500
                           disabled:bg-slate-700 disabled:text-slate-500
                           text-white rounded-lg transition-colors font-medium"
              >
                Unlock
              </button>
            )}
          </div>

          {/* Position Display */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">X</div>
              <div className="font-mono text-lg text-blue-400">{position.x.toFixed(2)}</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Y</div>
              <div className="font-mono text-lg text-green-400">{position.y.toFixed(2)}</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Z</div>
              <div className="font-mono text-lg text-red-400">{position.z.toFixed(2)}</div>
            </div>
          </div>

          {/* Jog Buttons */}
          <div className="flex justify-center gap-6">
            {/* XY Pad */}
            <div className="grid grid-cols-3 gap-1">
              <div />
              <JogButton axis="Y" direction={1} label="Y+" />
              <div />
              <JogButton axis="X" direction={-1} label="X-" />
              <button
                onClick={onGoToZero}
                disabled={!canJog}
                className={`
                  w-14 h-14 flex items-center justify-center rounded-lg
                  text-xs font-bold transition-all
                  ${canJog
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }
                `}
                title="Go to X0 Y0"
              >
                XY0
              </button>
              <JogButton axis="X" direction={1} label="X+" />
              <div />
              <JogButton axis="Y" direction={-1} label="Y-" />
              <div />
            </div>

            {/* Z Column */}
            <div className="flex flex-col gap-1">
              <JogButton axis="Z" direction={1} label="Z+" className="bg-slate-600" />
              <button
                onClick={() => onJog('Z', -position.z, feedRate)}
                disabled={!canJog}
                className={`
                  w-14 h-14 flex items-center justify-center rounded-lg
                  text-xs font-bold transition-all
                  ${canJog
                    ? 'bg-orange-600 hover:bg-orange-500 text-white'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }
                `}
                title="Go to Z0"
              >
                Z0
              </button>
              <JogButton axis="Z" direction={-1} label="Z-" className="bg-slate-600" />
            </div>
          </div>

          {/* Step Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Step Size</span>
              <span className="text-xs font-mono text-slate-300">{stepSize} mm</span>
            </div>
            <div className="flex gap-1">
              {STEP_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => setStepSize(size)}
                  className={`
                    flex-1 py-2 text-xs rounded-lg transition-colors font-medium
                    ${stepSize === size
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }
                  `}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Feed Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Feed Rate</span>
              <span className="text-xs font-mono text-slate-300">{feedRate} mm/min</span>
            </div>
            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={feedRate}
              onChange={(e) => setFeedRate(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                         [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-500
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onHome}
              disabled={!isConnected || (!isIdle && !isAlarm)}
              className="py-2.5 text-sm bg-slate-700 hover:bg-slate-600
                         disabled:bg-slate-800 disabled:text-slate-600
                         text-slate-200 rounded-lg transition-colors font-medium"
            >
              Home All
            </button>
            <button
              onClick={onSetZero}
              disabled={!canJog}
              className="py-2.5 text-sm bg-slate-700 hover:bg-slate-600
                         disabled:bg-slate-800 disabled:text-slate-600
                         text-slate-200 rounded-lg transition-colors font-medium"
            >
              Set Zero
            </button>
          </div>

          {/* Emergency Stop */}
          <button
            onClick={onStop}
            disabled={!isConnected}
            className="w-full py-3.5 text-sm font-bold bg-red-600 hover:bg-red-500
                       disabled:bg-slate-800 disabled:text-slate-600
                       text-white rounded-lg transition-colors uppercase tracking-wide"
          >
            Emergency Stop
          </button>

          {/* Keyboard shortcuts hint */}
          <div className="text-xs text-slate-500 text-center space-y-1">
            <p>Arrow keys: XY jog | PageUp/Down: Z jog | Space: Stop</p>
          </div>
        </div>
      </div>
    </div>
  );
}
