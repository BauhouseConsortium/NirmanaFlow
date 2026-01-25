import { useState, useEffect, useCallback, useRef } from 'react';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
export type MachineState = 'Idle' | 'Run' | 'Hold' | 'Alarm' | 'Check' | 'Home' | 'Sleep' | 'Unknown';

export interface MachinePosition {
  x: number;
  y: number;
  z: number;
}

export interface FluidNCStatus {
  connectionState: ConnectionState;
  machineState: MachineState;
  position: MachinePosition;
  feedRate: number;
  spindleSpeed: number;
  override?: {
    feed: number;
    rapid: number;
    spindle: number;
  };
  lastMessage: string;
  lastError: string | null;
}

const INITIAL_STATUS: FluidNCStatus = {
  connectionState: 'disconnected',
  machineState: 'Unknown',
  position: { x: 0, y: 0, z: 0 },
  feedRate: 0,
  spindleSpeed: 0,
  lastMessage: '',
  lastError: null,
};

export interface UseFluidNCOptions {
  autoConnect?: boolean;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  autoReport?: boolean;
  reportInterval?: number;
}

export function useFluidNC(host: string, options: UseFluidNCOptions = {}) {
  const {
    autoConnect = false,
    autoReconnect = true,
    reconnectInterval = 3000,
    autoReport = true,
    reportInterval = 200,
  } = options;

  const [status, setStatus] = useState<FluidNCStatus>(INITIAL_STATUS);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualDisconnect = useRef(false);

  // Parse FluidNC status message
  const parseStatusMessage = useCallback((data: string) => {
    // Format: <State|MPos:X,Y,Z|FS:Feed,Spindle|Ov:F,R,S|...>
    const match = data.match(/<([^|>]+)(.*)>/);
    if (!match) return;

    const state = match[1] as MachineState;
    const fields = match[2].split('|').filter(Boolean);

    const updates: Partial<FluidNCStatus> = {
      machineState: state,
      lastMessage: data,
    };

    for (const field of fields) {
      const colonIndex = field.indexOf(':');
      if (colonIndex === -1) continue;

      const key = field.substring(0, colonIndex);
      const value = field.substring(colonIndex + 1);

      switch (key) {
        case 'MPos':
        case 'WPos': {
          const [x, y, z] = value.split(',').map(Number);
          updates.position = { x, y, z };
          break;
        }
        case 'FS': {
          const [feed, spindle] = value.split(',').map(Number);
          updates.feedRate = feed;
          updates.spindleSpeed = spindle;
          break;
        }
        case 'Ov': {
          const [feed, rapid, spindle] = value.split(',').map(Number);
          updates.override = { feed, rapid, spindle };
          break;
        }
      }
    }

    setStatus(prev => ({ ...prev, ...updates }));
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    isManualDisconnect.current = false;

    // Convert HTTP URL to WebSocket URL on port 81
    const wsUrl = host
      .replace(/^https?:\/\//, 'ws://')
      .replace(/:\d+$/, '') + ':81';

    setStatus(prev => ({ ...prev, connectionState: 'connecting', lastError: null }));

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setStatus(prev => ({ ...prev, connectionState: 'connected', lastError: null }));

        // Enable auto-reporting if configured
        if (autoReport) {
          ws.send(`$Report/Interval=${reportInterval}\n`);
        }

        // Query initial status
        ws.send('?');
      };

      ws.onmessage = (event) => {
        const data = event.data;

        // Handle multiline messages - split and process each line
        const lines = data.split('\n').map((l: string) => l.trim()).filter(Boolean);

        for (const line of lines) {
          // Check for status report: <State|...>
          if (line.startsWith('<') && line.includes('|')) {
            parseStatusMessage(line);
          } else if (line.startsWith('error:')) {
            // Error message
            setStatus(prev => ({ ...prev, lastError: line, lastMessage: line }));
          } else if (line === 'ok' || line.startsWith('[') || line.startsWith('$')) {
            // ok response, info messages, or settings
            setStatus(prev => ({ ...prev, lastMessage: line }));
          } else {
            // Other messages
            setStatus(prev => ({ ...prev, lastMessage: line }));
          }
        }
      };

      ws.onerror = () => {
        setStatus(prev => ({
          ...prev,
          connectionState: 'error',
          lastError: 'WebSocket connection error'
        }));
      };

      ws.onclose = () => {
        setStatus(prev => ({ ...prev, connectionState: 'disconnected' }));
        wsRef.current = null;

        // Auto-reconnect if enabled and not manually disconnected
        if (autoReconnect && !isManualDisconnect.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        connectionState: 'error',
        lastError: error instanceof Error ? error.message : 'Connection failed'
      }));
    }
  }, [host, autoReport, reportInterval, autoReconnect, reconnectInterval, parseStatusMessage]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    isManualDisconnect.current = true;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      // Disable auto-reporting before disconnect
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send('$Report/Interval=0\n');
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus(INITIAL_STATUS);
  }, []);

  // Send a line-oriented command (adds \n if needed)
  const send = useCallback((command: string): boolean => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return false;
    }
    wsRef.current.send(command.endsWith('\n') ? command : command + '\n');
    return true;
  }, []);

  // Send a real-time command (single character, no \n)
  const sendRealtime = useCallback((char: string): boolean => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return false;
    }
    wsRef.current.send(char);
    return true;
  }, []);

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
    // Use $J= jog command for safe jogging (can be cancelled)
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

  // Go to specific Z position
  const goToZ = useCallback((z: number, feedRate = 500): boolean => {
    return send(`G0 Z${z.toFixed(3)} F${feedRate}`);
  }, [send]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
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
    goToZ,
    isConnected: status.connectionState === 'connected',
  };
}
