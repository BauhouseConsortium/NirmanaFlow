import { useState, useEffect, useCallback, useRef } from 'react';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
export type MachineState = 'Idle' | 'Run' | 'Hold' | 'Alarm' | 'Check' | 'Home' | 'Sleep' | 'Unknown';
export type StreamingState = 'idle' | 'streaming' | 'paused' | 'completed' | 'error';

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

export interface StreamingProgress {
  state: StreamingState;
  currentLine: number;
  totalLines: number;
  percentage: number;
  currentCommand: string;
  startTime: number | null;
  elapsedTime: number;
  errors: string[];
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

const INITIAL_STREAMING: StreamingProgress = {
  state: 'idle',
  currentLine: 0,
  totalLines: 0,
  percentage: 0,
  currentCommand: '',
  startTime: null,
  elapsedTime: 0,
  errors: [],
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
  const [streaming, setStreaming] = useState<StreamingProgress>(INITIAL_STREAMING);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isManualDisconnect = useRef(false);

  // Streaming refs
  const streamingLinesRef = useRef<string[]>([]);
  const streamingIndexRef = useRef(0);
  const streamingPausedRef = useRef(false);
  const streamingActiveRef = useRef(false);
  const pendingOkCountRef = useRef(0);
  const streamingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendNextRef = useRef<(() => void) | null>(null);
  const maxPendingOks = 4; // Buffer size - send up to 4 commands ahead

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

      // Prefer text messages
      ws.binaryType = 'blob';

      ws.onopen = () => {
        setStatus(prev => ({ ...prev, connectionState: 'connected', lastError: null }));

        // Enable auto-reporting if configured
        if (autoReport) {
          ws.send(`$Report/Interval=${reportInterval}\n`);
        }

        // Query initial status
        ws.send('?');
      };

      ws.onmessage = async (event) => {
        // Handle both string and Blob data
        let data: string;
        if (typeof event.data === 'string') {
          data = event.data;
        } else if (event.data instanceof Blob) {
          data = await event.data.text();
        } else {
          console.warn('[FluidNC] Unknown message type:', typeof event.data);
          return;
        }

        // Handle multiline messages - split and process each line
        const lines = data.split('\n').map((l: string) => l.trim()).filter(Boolean);

        for (const line of lines) {
          // Debug: log all non-status messages during streaming
          if (streamingActiveRef.current && !line.startsWith('<')) {
            console.log('[FluidNC] Received:', JSON.stringify(line), 'pendingOk:', pendingOkCountRef.current);
          }

          // Check for status report: <State|...>
          if (line.startsWith('<') && line.includes('|')) {
            parseStatusMessage(line);
          } else if (line.startsWith('error:')) {
            // Error message
            setStatus(prev => ({ ...prev, lastError: line, lastMessage: line }));
            // Handle streaming error
            if (streamingActiveRef.current) {
              setStreaming(prev => ({
                ...prev,
                errors: [...prev.errors, line],
              }));
              pendingOkCountRef.current = Math.max(0, pendingOkCountRef.current - 1);
              sendNextRef.current?.();
            }
          } else if (line === 'ok' || line.toLowerCase() === 'ok') {
            // ok response - critical for streaming flow control
            setStatus(prev => ({ ...prev, lastMessage: line }));
            if (streamingActiveRef.current) {
              console.log('[FluidNC] Got OK, calling sendNext. Before:', pendingOkCountRef.current);
              pendingOkCountRef.current = Math.max(0, pendingOkCountRef.current - 1);
              sendNextRef.current?.();
              console.log('[FluidNC] After sendNext. pendingOk:', pendingOkCountRef.current);
            }
          } else if (line.startsWith('[') || line.startsWith('$')) {
            // info messages or settings
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

  // Update elapsed time during streaming
  const updateStreamingTime = useCallback(() => {
    setStreaming(prev => {
      if (prev.startTime && prev.state === 'streaming') {
        return { ...prev, elapsedTime: Date.now() - prev.startTime };
      }
      return prev;
    });
  }, []);

  // Send next lines in streaming queue (with buffering)
  const sendNextStreamingLines = useCallback(() => {
    if (!streamingActiveRef.current || streamingPausedRef.current) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const lines = streamingLinesRef.current;
    const totalLines = lines.length;

    // Send lines while we have buffer space and lines to send
    while (
      pendingOkCountRef.current < maxPendingOks &&
      streamingIndexRef.current < totalLines &&
      !streamingPausedRef.current
    ) {
      const lineIndex = streamingIndexRef.current;
      const line = lines[lineIndex].trim();

      // Skip empty lines and comments (but still count them for progress)
      if (line && !line.startsWith(';') && !line.startsWith('(') && line !== '%') {
        wsRef.current.send(line + '\n');
        pendingOkCountRef.current++;

        // Update progress
        setStreaming(prev => ({
          ...prev,
          currentLine: lineIndex + 1,
          percentage: Math.round(((lineIndex + 1) / totalLines) * 100),
          currentCommand: line,
        }));
      } else {
        // Still update progress for skipped lines
        setStreaming(prev => ({
          ...prev,
          currentLine: lineIndex + 1,
          percentage: Math.round(((lineIndex + 1) / totalLines) * 100),
        }));
      }

      streamingIndexRef.current++;
    }

    // Check for completion when all lines sent and all oks received
    if (streamingIndexRef.current >= totalLines && pendingOkCountRef.current === 0) {
      streamingActiveRef.current = false;
      if (streamingTimerRef.current) {
        clearInterval(streamingTimerRef.current);
        streamingTimerRef.current = null;
      }
      setStreaming(prev => ({
        ...prev,
        state: 'completed',
        percentage: 100,
        currentCommand: 'Complete',
      }));
    }
  }, []);

  // Keep the ref updated so WebSocket callback can call it
  useEffect(() => {
    sendNextRef.current = sendNextStreamingLines;
  }, [sendNextStreamingLines]);

  // Start streaming G-code
  const startStreaming = useCallback((gcodeLines: string[]): boolean => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }

    // Filter out empty lines but keep the array for accurate line counting
    const lines = gcodeLines.filter(line => {
      const trimmed = line.trim();
      return trimmed && trimmed !== '%';
    });

    if (lines.length === 0) return false;

    // Reset streaming state
    streamingLinesRef.current = lines;
    streamingIndexRef.current = 0;
    streamingPausedRef.current = false;
    streamingActiveRef.current = true;
    pendingOkCountRef.current = 0;

    setStreaming({
      state: 'streaming',
      currentLine: 0,
      totalLines: lines.length,
      percentage: 0,
      currentCommand: 'Starting...',
      startTime: Date.now(),
      elapsedTime: 0,
      errors: [],
    });

    // Start elapsed time timer
    if (streamingTimerRef.current) {
      clearInterval(streamingTimerRef.current);
    }
    streamingTimerRef.current = setInterval(updateStreamingTime, 1000);

    // Start sending lines
    sendNextStreamingLines();

    return true;
  }, [sendNextStreamingLines, updateStreamingTime]);

  // Pause streaming
  const pauseStreaming = useCallback(() => {
    if (!streamingActiveRef.current) return;
    streamingPausedRef.current = true;
    setStreaming(prev => ({ ...prev, state: 'paused' }));
    // Also send feed hold to machine
    sendRealtime('!');
  }, [sendRealtime]);

  // Resume streaming
  const resumeStreaming = useCallback(() => {
    if (!streamingActiveRef.current || !streamingPausedRef.current) return;
    streamingPausedRef.current = false;
    setStreaming(prev => ({ ...prev, state: 'streaming' }));
    // Resume machine
    sendRealtime('~');
    // Continue sending lines
    sendNextStreamingLines();
  }, [sendRealtime, sendNextStreamingLines]);

  // Cancel streaming
  const cancelStreaming = useCallback(() => {
    streamingActiveRef.current = false;
    streamingPausedRef.current = false;
    streamingLinesRef.current = [];
    streamingIndexRef.current = 0;
    pendingOkCountRef.current = 0;

    if (streamingTimerRef.current) {
      clearInterval(streamingTimerRef.current);
      streamingTimerRef.current = null;
    }

    setStreaming(INITIAL_STREAMING);

    // Stop the machine
    sendRealtime('\x18'); // Soft reset
  }, [sendRealtime]);

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
