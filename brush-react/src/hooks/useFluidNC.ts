import { useState, useEffect, useCallback, useRef } from 'react';
import {
  type ConnectionState,
  type MachineState,
  type StreamingState,
  type MachinePosition,
  type PositionData,
  type PositionType,
  type FluidNCStatus,
  type StreamingProgress,
  type WorkerCommand,
  type WorkerMessage,
  INITIAL_STATUS,
  INITIAL_STREAMING,
} from '../schemas/fluidNCSchemas';

// Re-export types for consumers
export type { ConnectionState, MachineState, StreamingState, MachinePosition, PositionData, PositionType, FluidNCStatus, StreamingProgress };

export interface UseFluidNCOptions {
  autoConnect?: boolean;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  autoReport?: boolean;
  reportInterval?: number;
}

// Create worker instance (lazily)
let workerInstance: Worker | null = null;

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL('../workers/fluidNCWorker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return workerInstance;
}

export function useFluidNC(host: string, options: UseFluidNCOptions = {}) {
  const {
    autoConnect = false,
    autoReport = true,
    reportInterval = 200,
  } = options;

  const [status, setStatus] = useState<FluidNCStatus>(INITIAL_STATUS);
  const [streaming, setStreaming] = useState<StreamingProgress>(INITIAL_STREAMING);

  const workerRef = useRef<Worker | null>(null);
  const isConnectedRef = useRef(false);

  // Initialize worker and set up message handler
  useEffect(() => {
    const worker = getWorker();
    workerRef.current = worker;

    const handleMessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;

      switch (message.type) {
        case 'status':
          setStatus(prev => ({ ...prev, ...message.data }));
          break;

        case 'streaming':
          setStreaming(prev => {
            // Handle errors array specially - append rather than replace
            if (message.data.errors && prev.errors) {
              return {
                ...prev,
                ...message.data,
                errors: [...prev.errors, ...message.data.errors],
              };
            }
            return { ...prev, ...message.data };
          });
          break;

        case 'connected':
          isConnectedRef.current = true;
          break;

        case 'disconnected':
          isConnectedRef.current = false;
          break;

        case 'error':
          console.error('[FluidNC Worker]', message.message);
          break;

        case 'log':
          if (message.level === 'error') {
            console.error('[FluidNC Worker]', message.message);
          } else if (message.level === 'warn') {
            console.warn('[FluidNC Worker]', message.message);
          } else {
            console.log('[FluidNC Worker]', message.message);
          }
          break;
      }
    };

    worker.addEventListener('message', handleMessage);

    return () => {
      worker.removeEventListener('message', handleMessage);
    };
  }, []);

  // Send command to worker
  const sendCommand = useCallback((command: WorkerCommand) => {
    workerRef.current?.postMessage(command);
  }, []);

  // Connect to WebSocket (via worker)
  const connect = useCallback(() => {
    sendCommand({
      type: 'connect',
      host,
      options: { autoReport, reportInterval },
    });
  }, [host, autoReport, reportInterval, sendCommand]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    sendCommand({ type: 'disconnect' });
    setStatus(INITIAL_STATUS);
  }, [sendCommand]);

  // Send a line-oriented command
  const send = useCallback((command: string): boolean => {
    if (status.connectionState !== 'connected') {
      return false;
    }
    sendCommand({ type: 'send', command });
    return true;
  }, [status.connectionState, sendCommand]);

  // Send a real-time command (single character)
  const sendRealtime = useCallback((char: string): boolean => {
    if (status.connectionState !== 'connected') {
      return false;
    }
    sendCommand({ type: 'sendRealtime', char });
    return true;
  }, [status.connectionState, sendCommand]);

  // Real-time control shortcuts
  const pause = useCallback(() => sendRealtime('!'), [sendRealtime]);
  const resume = useCallback(() => sendRealtime('~'), [sendRealtime]);
  const stop = useCallback(() => sendRealtime('\x18'), [sendRealtime]); // Ctrl+X
  const queryStatus = useCallback(() => sendRealtime('?'), [sendRealtime]);

  // Feed override controls
  const feedOverride = useCallback((action: 'reset' | '+10' | '-10' | '+1' | '-1') => {
    const chars: Record<string, string> = {
      'reset': '\x90',
      '+10': '\x91',
      '-10': '\x92',
      '+1': '\x93',
      '-1': '\x94',
    };
    return sendRealtime(chars[action]);
  }, [sendRealtime]);

  // Jog control - move axis by distance (relative)
  const jog = useCallback((axis: 'X' | 'Y' | 'Z', distance: number, feedRate = 1000): boolean => {
    return send(`$J=G91 G21 ${axis}${distance.toFixed(3)} F${feedRate}`);
  }, [send]);

  // Cancel active jog
  const jogCancel = useCallback(() => sendRealtime('\x85'), [sendRealtime]);

  // Home all axes
  const home = useCallback((): boolean => {
    return send('$H');
  }, [send]);

  // Unlock after alarm
  const unlock = useCallback((): boolean => {
    return send('$X');
  }, [send]);

  // Set current position as zero (work coordinates)
  const setZero = useCallback((): boolean => {
    return send('G10 L20 P1 X0 Y0 Z0');
  }, [send]);

  // Go to zero position
  const goToZero = useCallback((feedRate = 1000): boolean => {
    return send(`G0 X0 Y0 F${feedRate}`);
  }, [send]);

  // Go to specific X,Y position (absolute)
  const goToXY = useCallback((x: number, y: number, feedRate = 2000): boolean => {
    return send(`G90 G0 X${x.toFixed(2)} Y${y.toFixed(2)} F${feedRate}`);
  }, [send]);

  // Go to specific Z position
  const goToZ = useCallback((z: number, feedRate = 500): boolean => {
    return send(`G0 Z${z.toFixed(3)} F${feedRate}`);
  }, [send]);

  // Start streaming G-code (via worker)
  const startStreaming = useCallback((gcodeLines: string[]): boolean => {
    if (status.connectionState !== 'connected') {
      return false;
    }
    if (gcodeLines.length === 0) {
      return false;
    }
    sendCommand({ type: 'startStreaming', lines: gcodeLines });
    return true;
  }, [status.connectionState, sendCommand]);

  // Pause streaming
  const pauseStreaming = useCallback(() => {
    sendCommand({ type: 'pauseStreaming' });
  }, [sendCommand]);

  // Resume streaming
  const resumeStreaming = useCallback(() => {
    sendCommand({ type: 'resumeStreaming' });
  }, [sendCommand]);

  // Cancel streaming
  const cancelStreaming = useCallback(() => {
    sendCommand({ type: 'cancelStreaming' });
  }, [sendCommand]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      // Note: We don't disconnect on unmount because the worker is shared
      // and may be used by other components. The worker handles auto-reconnect.
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
    streaming,
    connect,
    disconnect,
    send,
    sendRealtime,
    pause,
    resume,
    stop,
    queryStatus,
    feedOverride,
    jog,
    jogCancel,
    home,
    unlock,
    setZero,
    goToZero,
    goToXY,
    goToZ,
    // Streaming methods
    startStreaming,
    pauseStreaming,
    resumeStreaming,
    cancelStreaming,
    isConnected: status.connectionState === 'connected',
    isStreaming: streaming.state === 'streaming' || streaming.state === 'paused',
  };
}
