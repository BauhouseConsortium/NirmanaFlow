import { useState } from 'react';

interface Macro {
  id: string;
  name: string;
  description: string;
  gcode: string[];
  icon?: React.ReactNode;
  color?: string;
}

interface MacroPanelProps {
  isConnected: boolean;
  isStreaming: boolean;
  onRunMacro: (gcode: string[]) => void;
}

const MACROS: Macro[] = [
  {
    id: 'homing',
    name: 'Homing',
    description: 'Custom homing sequence - moves to corner, finds zero',
    color: 'bg-purple-600 hover:bg-purple-500',
    gcode: [
      'G10 P0 L20 X0 Y0 Z0',
      'G0 Z10 F800',
      'G90',
      'G0 X160 Y160 Z32 F1900',
      'G0 X0 Y0 Z27 F1900',
      'G10 P0 L20 X0 Y0 Z10',
      'G1 Z15 F300',
      'G1 Z10 F300',
      'G0 X-10 Y-10 F800',
      'G0 X-6 Y-6 F500',
      'G10 P0 L20 X0 Y0 Z14',
    ],
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: 'park',
    name: 'Park',
    description: 'Move to safe park position',
    color: 'bg-slate-600 hover:bg-slate-500',
    gcode: [
      'G0 Z20 F800',
      'G0 X10 Y130 F2000',
    ],
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
  {
    id: 'pen-up',
    name: 'Pen Up',
    description: 'Raise pen to safe height',
    color: 'bg-green-600 hover:bg-green-500',
    gcode: ['G0 Z10 F500'],
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    ),
  },
  {
    id: 'pen-down',
    name: 'Pen Down',
    description: 'Lower pen to drawing height',
    color: 'bg-red-600 hover:bg-red-500',
    gcode: ['G1 Z0 F300'],
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    ),
  },
  {
    id: 'dip-ink',
    name: 'Dip Ink',
    description: 'Go to ink well and dip',
    color: 'bg-indigo-600 hover:bg-indigo-500',
    gcode: [
      'G0 Z5 F500',
      'G0 X41 Y5 F2000',
      'G1 Z0 F500',
      'G4 P0.5',
      'G0 Z5 F500',
    ],
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
];

export function MacroPanel({ isConnected, isStreaming, onRunMacro }: MacroPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [runningMacro, setRunningMacro] = useState<string | null>(null);

  const handleRunMacro = (macro: Macro) => {
    if (!isConnected || isStreaming) return;
    setRunningMacro(macro.id);
    onRunMacro(macro.gcode);
    // Reset running state after a delay
    setTimeout(() => setRunningMacro(null), 1000);
  };

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-sm font-medium text-slate-300 hover:text-white"
      >
        <span>Macros</span>
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="grid grid-cols-2 gap-2">
          {MACROS.map((macro) => (
            <button
              key={macro.id}
              onClick={() => handleRunMacro(macro)}
              disabled={!isConnected || isStreaming}
              title={macro.description}
              className={`
                py-2 px-3 text-sm font-medium rounded-lg transition-all
                flex items-center justify-center gap-2
                disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed
                ${runningMacro === macro.id ? 'ring-2 ring-white ring-opacity-50 scale-95' : ''}
                ${macro.color || 'bg-slate-700 hover:bg-slate-600'} text-white
              `}
            >
              {macro.icon}
              {macro.name}
            </button>
          ))}
        </div>
      )}

      {!isConnected && (
        <p className="text-xs text-center text-slate-500">
          Connect to FluidNC to use macros
        </p>
      )}
    </div>
  );
}
