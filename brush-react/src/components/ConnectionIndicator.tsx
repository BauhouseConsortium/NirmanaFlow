import { useState, useEffect, useRef } from 'react';
import type { ConnectionState, MachineState, MachinePosition } from '../hooks/useFluidNC';
import { ConnectionHelpModal } from './ConnectionHelpModal';

interface ConnectionIndicatorProps {
  connectionState: ConnectionState;
  machineState: MachineState;
  position: MachinePosition;
  host: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

const connectionColors: Record<ConnectionState, string> = {
  disconnected: 'bg-slate-500',
  connecting: 'bg-yellow-500 animate-pulse',
  connected: 'bg-green-500',
  error: 'bg-red-500',
};

const connectionLabels: Record<ConnectionState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting...',
  connected: 'Connected',
  error: 'Error',
};

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

export function ConnectionIndicator({
  connectionState,
  machineState,
  position,
  host,
  onConnect,
  onDisconnect,
}: ConnectionIndicatorProps) {
  const [showHelp, setShowHelp] = useState(false);
  const [hasShownAutoHelp, setHasShownAutoHelp] = useState(false);
  const errorCountRef = useRef(0);

  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  // Auto-show help modal on repeated connection errors when on HTTPS
  useEffect(() => {
    if (connectionState === 'error' && isHttps && !hasShownAutoHelp) {
      errorCountRef.current += 1;
      // Show help after 2 failed attempts
      if (errorCountRef.current >= 2) {
        setShowHelp(true);
        setHasShownAutoHelp(true);
      }
    } else if (connectionState === 'connected') {
      // Reset error count on successful connection
      errorCountRef.current = 0;
    }
  }, [connectionState, isHttps, hasShownAutoHelp]);

  // Extract IP from host URL
  const displayHost = host.replace(/^https?:\/\//, '').replace(/:\d+$/, '');

  // Show help button when on HTTPS and not connected
  const showHelpButton = isHttps && !isConnected;

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Machine state and position (only when connected) */}
        {isConnected && (
          <div className="hidden sm:flex items-center gap-3 text-xs">
            <span className={`font-medium ${machineStateColors[machineState]}`}>
              {machineState}
            </span>
            <span className="text-slate-500 font-mono">
              X{position.x.toFixed(1)} Y{position.y.toFixed(1)} Z{position.z.toFixed(1)}
            </span>
          </div>
        )}

        {/* Help button - shows on HTTPS when not connected */}
        {showHelpButton && (
          <button
            onClick={() => setShowHelp(true)}
            className={`p-1.5 rounded-lg transition-colors ${
              connectionState === 'error'
                ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 animate-pulse'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700'
            }`}
            title="Connection help"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}

        {/* Connection status button */}
        <button
          onClick={isConnected ? onDisconnect : onConnect}
          disabled={isConnecting}
          className={`
            flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium
            transition-all duration-200
            ${isConnected
              ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/30'
              : isConnecting
                ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 cursor-wait'
                : connectionState === 'error'
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-300 border border-slate-600'
            }
          `}
          title={`${connectionLabels[connectionState]} - ${displayHost}:81`}
        >
          {/* Status dot */}
          <span className={`w-2 h-2 rounded-full ${connectionColors[connectionState]}`} />

          {/* Label */}
          <span className="hidden sm:inline">
            {isConnected ? displayHost : connectionLabels[connectionState]}
          </span>

          {/* Icon */}
          {isConnected ? (
            <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ) : isConnecting ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          )}
        </button>
      </div>

      {/* Help Modal */}
      <ConnectionHelpModal 
        isOpen={showHelp} 
        onClose={() => setShowHelp(false)} 
      />
    </>
  );
}
