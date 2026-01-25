import { useState } from 'react';
import type { MachinePosition, MachineState } from '../hooks/useFluidNC';

interface JogControlProps {
  isConnected: boolean;
  machineState: MachineState;
  position: MachinePosition;
  onJog: (axis: 'X' | 'Y' | 'Z', distance: number) => void;
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

export function JogControl({
  isConnected,
  machineState,
  position,
  onJog,
  onHome,
  onUnlock,
  onSetZero,
  onGoToZero,
  onStop,
}: JogControlProps) {
  const [stepSize, setStepSize] = useState(10);
  const [feedRate, setFeedRate] = useState(1000);

  const isIdle = machineState === 'Idle';
  const isAlarm = machineState === 'Alarm';
  const isRunning = machineState === 'Run' || machineState === 'Hold' || machineState === 'Home';
  // Allow jog when connected and not actively running/holding/homing/alarm
  const canJog = isConnected && !isRunning && !isAlarm;

  const JogButton = ({
    axis,
    direction,
    icon,
    className = '',
  }: {
    axis: 'X' | 'Y' | 'Z';
    direction: 1 | -1;
    icon: React.ReactNode;
    className?: string;
  }) => (
    <button
      onClick={() => onJog(axis, stepSize * direction)}
      disabled={!canJog}
      className={`
        w-12 h-12 flex items-center justify-center rounded-lg
        text-white font-bold text-lg transition-all
        ${canJog
          ? 'bg-slate-700 hover:bg-slate-600 active:bg-slate-500 active:scale-95'
          : 'bg-slate-800 text-slate-600 cursor-not-allowed'
        }
        ${className}
      `}
      title={`${axis}${direction > 0 ? '+' : '-'}${stepSize}mm`}
    >
      {icon}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">Jog Control</h3>
        {isAlarm && (
          <button
            onClick={onUnlock}
            disabled={!isConnected}
            className="px-2 py-1 text-xs bg-yellow-600 hover:bg-yellow-500
                       disabled:bg-slate-700 disabled:text-slate-500
                       text-white rounded transition-colors"
          >
            Unlock
          </button>
        )}
      </div>

      {/* Position Display */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-slate-800 rounded-lg p-2">
          <div className="text-slate-500">X</div>
          <div className="font-mono text-blue-400">{position.x.toFixed(2)}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-2">
          <div className="text-slate-500">Y</div>
          <div className="font-mono text-green-400">{position.y.toFixed(2)}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-2">
          <div className="text-slate-500">Z</div>
          <div className="font-mono text-red-400">{position.z.toFixed(2)}</div>
        </div>
      </div>

      {/* Jog Buttons */}
      <div className="flex gap-4">
        {/* XY Pad */}
        <div className="grid grid-cols-3 gap-1">
          {/* Top row */}
          <div />
          <JogButton
            axis="Y"
            direction={1}
            icon={<span>Y+</span>}
          />
          <div />

          {/* Middle row */}
          <JogButton
            axis="X"
            direction={-1}
            icon={<span>X-</span>}
          />
          <button
            onClick={onGoToZero}
            disabled={!canJog}
            className={`
              w-12 h-12 flex items-center justify-center rounded-lg
              text-xs font-medium transition-all
              ${canJog
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }
            `}
            title="Go to X0 Y0"
          >
            XY0
          </button>
          <JogButton
            axis="X"
            direction={1}
            icon={<span>X+</span>}
          />

          {/* Bottom row */}
          <div />
          <JogButton
            axis="Y"
            direction={-1}
            icon={<span>Y-</span>}
          />
          <div />
        </div>

        {/* Z Column */}
        <div className="flex flex-col gap-1">
          <JogButton
            axis="Z"
            direction={1}
            icon={<span>Z+</span>}
            className="bg-slate-600"
          />
          <button
            onClick={() => onJog('Z', 0)}
            disabled={!canJog}
            className={`
              w-12 h-12 flex items-center justify-center rounded-lg
              text-xs font-medium transition-all
              ${canJog
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }
            `}
            title="Go to Z0"
          >
            Z0
          </button>
          <JogButton
            axis="Z"
            direction={-1}
            icon={<span>Z-</span>}
            className="bg-slate-600"
          />
        </div>
      </div>

      {/* Step Size */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Step Size</span>
          <span className="text-xs font-mono text-slate-400">{stepSize} mm</span>
        </div>
        <div className="flex gap-1">
          {STEP_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => setStepSize(size)}
              className={`
                flex-1 py-1.5 text-xs rounded transition-colors
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
          <span className="text-xs font-mono text-slate-400">{feedRate} mm/min</span>
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
          className="py-2 text-sm bg-slate-700 hover:bg-slate-600
                     disabled:bg-slate-800 disabled:text-slate-600
                     text-slate-200 rounded-lg transition-colors"
        >
          Home All
        </button>
        <button
          onClick={onSetZero}
          disabled={!canJog}
          className="py-2 text-sm bg-slate-700 hover:bg-slate-600
                     disabled:bg-slate-800 disabled:text-slate-600
                     text-slate-200 rounded-lg transition-colors"
        >
          Set Zero
        </button>
      </div>

      {/* Emergency Stop */}
      <button
        onClick={onStop}
        disabled={!isConnected}
        className="w-full py-3 text-sm font-bold bg-red-600 hover:bg-red-500
                   disabled:bg-slate-800 disabled:text-slate-600
                   text-white rounded-lg transition-colors uppercase tracking-wide"
      >
        Stop
      </button>

      {/* Status */}
      {!isConnected ? (
        <p className="text-xs text-center text-slate-500">
          Connect to FluidNC to enable jog controls
        </p>
      ) : (
        <p className="text-xs text-center text-slate-500">
          State: <span className={machineStateColors[machineState]}>{machineState}</span>
          {!canJog && !isAlarm && (
            <span className="text-yellow-500 ml-2">(Jog disabled while {machineState})</span>
          )}
        </p>
      )}
    </div>
  );
}
